import * as cheerio from "cheerio";
import { readFile } from "fs/promises";
import {
  BankId,
  BankNames,
  ProductType,
  CurrencyIndex,
  Segment,
  Channel,
  SourceType,
  ExtractionMethod,
  type Offer,
  type Rate,
  type BankParseResult,
} from "@compara-tasa/core";
import { fetchWithRetry, sha256, generateOfferId, parseColombianNumber } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

const LANDING_URL = "https://www.avvillas.com.co/credito-hipotecario";

/**
 * Extracts text content from a PDF buffer using pdfjs-dist
 */
async function extractPdfText(pdfBuffer: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const pdf = await pdfjs.getDocument({ data: pdfBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(text);
  }

  return pages;
}

type ExtractedRate = {
  productType: ProductType;
  currencyIndex: CurrencyIndex;
  segment: Segment;
  channel: Channel;
  rateFrom: number;
  rateTo?: number;
  description: string;
};

/**
 * Parses AV Villas mortgage rates from PDF text
 *
 * PDF Structure (Page 1):
 * - "Créditos Hipotecarios" section:
 *   - VIS UVR: UVR + 8,90% to UVR + 10,05%
 *   - NO VIS UVR: UVR + 9,05% to UVR + 9,85%
 *   - NO VIS COP: 15,00% to 15,75% E.A.
 *
 * - "Leasing Habitacional" section:
 *   - VIS/NO VIS UVR: UVR + 9,30%
 *
 * - "Créditos Hipotecarios-Digital" section:
 *   - VIS COP: 12,20% E.A.
 *   - NO VIS COP: 12,40% E.A.
 *   - VIS/NO VIS UVR: UVR + 7,50% to UVR + 8,50%
 */
function parseRates(text: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // === Standard Hipotecario Section ===

  // VIS UVR: "VIS   UVR + 8,90%   UVR + 10,05%   NO VIS"
  const visUvrMatch = text.match(
    /Créditos\s+Hipotecarios.*?VIS\s+UVR\s*\+\s*(\d+[,.]?\d*)\s*%\s+UVR\s*\+\s*(\d+[,.]?\d*)\s*%\s+NO\s*VIS/i
  );
  if (visUvrMatch) {
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.VIS,
      channel: Channel.UNSPECIFIED,
      rateFrom: parseColombianNumber(visUvrMatch[1]),
      rateTo: parseColombianNumber(visUvrMatch[2]),
      description: "Créditos Hipotecarios VIS UVR",
    });
  }

  // NO VIS UVR: "NO VIS   UVR + 9,05%   UVR + 9,85%"
  const noVisUvrMatch = text.match(
    /NO\s*VIS\s+UVR\s*\+\s*(\d+[,.]?\d*)\s*%\s+UVR\s*\+\s*(\d+[,.]?\d*)\s*%\s+Nota/i
  );
  if (noVisUvrMatch) {
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.NO_VIS,
      channel: Channel.UNSPECIFIED,
      rateFrom: parseColombianNumber(noVisUvrMatch[1]),
      rateTo: parseColombianNumber(noVisUvrMatch[2]),
      description: "Créditos Hipotecarios NO VIS UVR",
    });
  }

  // NO VIS COP: "NO VIS   15,00% E.A.   15,75% E.A.  NO VIS" (followed by UVR section)
  const noVisCopMatch = text.match(
    /NO\s*VIS\s+(\d+[,.]?\d*)\s*%\s*E\.?A\.?\s+(\d+[,.]?\d*)\s*%\s*E\.?A\.?\s+NO\s*VIS/i
  );
  if (noVisCopMatch) {
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.NO_VIS,
      channel: Channel.UNSPECIFIED,
      rateFrom: parseColombianNumber(noVisCopMatch[1]),
      rateTo: parseColombianNumber(noVisCopMatch[2]),
      description: "Créditos Hipotecarios NO VIS COP",
    });
  }

  // === Leasing Habitacional Section ===
  // The PDF shows "Tipo Vivienda UVR + 9,30%" for leasing
  const leasingUvrMatch = text.match(
    /Leasing\s+Habitacional.*?Tipo\s+Vivienda\s+UVR\s*\+\s*(\d+[,.]?\d*)\s*%/i
  );
  if (leasingUvrMatch) {
    // Leasing applies to both VIS and NO_VIS
    rates.push({
      productType: ProductType.LEASING,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.UNKNOWN,
      channel: Channel.UNSPECIFIED,
      rateFrom: parseColombianNumber(leasingUvrMatch[1]),
      description: "Leasing Habitacional UVR",
    });
  }

  // === Créditos Hipotecarios-Digital Section ===

  // Digital VIS COP: "VIS   12,20% E.A."
  const digitalVisCopMatch = text.match(
    /Hipotecarios-Digital.*?VIS\s+(\d+[,.]?\d*)\s*%\s*E\.?A\.?\s+NO\s*VIS/i
  );
  if (digitalVisCopMatch) {
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.VIS,
      channel: Channel.DIGITAL,
      rateFrom: parseColombianNumber(digitalVisCopMatch[1]),
      description: "Créditos Hipotecarios-Digital VIS COP",
    });
  }

  // Digital NO VIS COP: "NO VIS   12,40% E.A."
  const digitalNoVisCopMatch = text.match(
    /Hipotecarios-Digital.*?NO\s*VIS\s+(\d+[,.]?\d*)\s*%\s*E\.?A\.?\s+Nota/i
  );
  if (digitalNoVisCopMatch) {
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.NO_VIS,
      channel: Channel.DIGITAL,
      rateFrom: parseColombianNumber(digitalNoVisCopMatch[1]),
      description: "Créditos Hipotecarios-Digital NO VIS COP",
    });
  }

  // Digital VIS/NO VIS UVR: "VIS / NO VIS   UVR + 7,50%   UVR + 8,50%"
  const digitalUvrMatch = text.match(
    /Hipotecarios-Digital.*?VIS\s*\/\s*NO\s*VIS\s+UVR\s*\+\s*(\d+[,.]?\d*)\s*%\s+UVR\s*\+\s*(\d+[,.]?\d*)\s*%/i
  );
  if (digitalUvrMatch) {
    // Digital UVR applies to both VIS and NO_VIS - create offers for both
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.VIS,
      channel: Channel.DIGITAL,
      rateFrom: parseColombianNumber(digitalUvrMatch[1]),
      rateTo: parseColombianNumber(digitalUvrMatch[2]),
      description: "Créditos Hipotecarios-Digital VIS UVR",
    });
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.NO_VIS,
      channel: Channel.DIGITAL,
      rateFrom: parseColombianNumber(digitalUvrMatch[1]),
      rateTo: parseColombianNumber(digitalUvrMatch[2]),
      description: "Créditos Hipotecarios-Digital NO VIS UVR",
    });
  }

  return rates;
}

/**
 * Discovers the current PDF URL from the AV Villas landing page
 */
function discoverPdfUrl(html: string): string | null {
  const $ = cheerio.load(html);

  // Find all PDF links and filter for rate documents
  const pdfLinks = $('a[href*=".pdf"]')
    .toArray()
    .map((el) => $(el).attr("href") || "")
    .filter((href) => /tasas.*activas/i.test(href) || /tasas/i.test(href));

  if (pdfLinks.length === 0) {
    return null;
  }

  const pdfUrl = pdfLinks[0];
  if (!pdfUrl.startsWith("http")) {
    return `https://www.avvillas.com.co${pdfUrl}`;
  }

  return pdfUrl;
}

export class AvvillasParser implements BankParser {
  bankId = BankId.AVVILLAS;
  sourceUrl = LANDING_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];
    const offers: Offer[] = [];
    const retrievedAt = new Date().toISOString();

    let pdfBuffer: Buffer;
    let pdfSourceUrl = this.sourceUrl;

    if (this.config.useFixtures && this.config.fixturesPath) {
      // Use fixture file directly
      pdfBuffer = await readFile(this.config.fixturesPath);
    } else {
      // Step 1: Fetch landing page to discover current PDF URL
      const landingResult = await fetchWithRetry(LANDING_URL);
      const html = landingResult.content.toString("utf-8");

      const discoveredUrl = await discoverPdfUrl(html);
      if (!discoveredUrl) {
        warnings.push("Could not discover PDF URL from landing page");
        return {
          bank_id: this.bankId,
          offers: [],
          warnings,
          raw_text_hash: sha256(html),
        };
      }

      pdfSourceUrl = discoveredUrl;

      // Step 2: Fetch the PDF
      const pdfResult = await fetchWithRetry(pdfSourceUrl);
      pdfBuffer = pdfResult.content;
    }

    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // Extract text from PDF
    const pdfData = new Uint8Array(pdfBuffer);
    const pageTexts: string[] = await extractPdfText(pdfData);

    // Combine all pages for searching
    const fullText = pageTexts.join(" ");

    // Check for the hipotecario section
    if (!/Créditos\s+Hipotecarios/i.test(fullText)) {
      warnings.push("Could not find 'Créditos Hipotecarios' section in PDF");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Parse rates from the combined text
    const extractedRates = parseRates(fullText);

    if (extractedRates.length === 0) {
      warnings.push("No mortgage rates extracted - PDF structure may have changed");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Create offers from extracted rates
    for (const extracted of extractedRates) {
      let rate: Rate;

      if (extracted.currencyIndex === CurrencyIndex.UVR) {
        rate = {
          kind: "UVR_SPREAD",
          spread_ea_from: extracted.rateFrom,
          spread_ea_to: extracted.rateTo,
        };
      } else {
        rate = {
          kind: "COP_FIXED",
          ea_percent_from: extracted.rateFrom,
          ea_percent_to: extracted.rateTo,
        };
      }

      const offer: Offer = {
        id: generateOfferId({
          bank_id: this.bankId,
          product_type: extracted.productType,
          currency_index: extracted.currencyIndex,
          segment: extracted.segment,
          channel: extracted.channel,
          rate_from: extracted.rateFrom,
        }),
        bank_id: this.bankId,
        bank_name: BankNames[this.bankId],
        product_type: extracted.productType,
        currency_index: extracted.currencyIndex,
        segment: extracted.segment,
        channel: extracted.channel,
        rate,
        conditions: {},
        source: {
          url: pdfSourceUrl,
          source_type: SourceType.PDF,
          document_label: "Tasas de Colocación - Crédito Según Línea y Plazo",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.REGEX,
            locator: extracted.description,
            excerpt: extracted.description,
          },
        },
      };

      offers.push(offer);
    }

    // Validate expected count
    // Expected: 3 standard (VIS UVR, NO VIS UVR, NO VIS COP) + 1 leasing + 4 digital = 8
    if (offers.length < 6) {
      warnings.push(
        `Only extracted ${offers.length} offers, expected at least 6 (hipotecario + leasing + digital)`
      );
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
