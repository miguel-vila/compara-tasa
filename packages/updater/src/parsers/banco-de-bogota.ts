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
import {
  fetchBancoDeBogotaPdf,
  sha256,
  generateOfferId,
  parseColombianNumber,
} from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

// The PDF URL uses a date-based naming scheme (tasas-{month}-{year})
// The actual URL is resolved dynamically by fetchBancoDeBogotaPdf
const DEFAULT_SOURCE_URL = "https://www.bancodebogota.com/documents/d/guest";

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
  rateFrom: number;
  rateTo?: number;
  description: string;
};

/**
 * Parses the vivienda section (page 7) and extracts mortgage rates
 *
 * Structure:
 * - CRÉDITO NO VIS (COP, NO_VIS)
 * - CRÉDITO VIS O VIP (COP, VIS)
 * - LEASING HABITACIONAL (COP, UNKNOWN)
 * - CRÉDITO DIRECTO UVR NO VIS (UVR, NO_VIS)
 * - CRÉDITO DIRECTO UVR VIS (UVR, VIS)
 */
function parseViviendaSection(text: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // Patterns to match different product lines
  // Format: "PRODUCT_NAME plazo% rate% rate%"
  const productPatterns: Array<{
    pattern: RegExp;
    productType: ProductType;
    currencyIndex: CurrencyIndex;
    segment: Segment;
  }> = [
    {
      // CRÉDITO NO VIS   240   17.41%   17.41%
      pattern: /CR[ÉE]DITO\s+NO\s+VIS\s+\d+\s+(\d+[,.]\d+)\s*%/i,
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.NO_VIS,
    },
    {
      // CRÉDITO VIS O VIP   360   15.71%   15.71%
      pattern: /CR[ÉE]DITO\s+VIS\s+O\s+VIP\s+\d+\s+(\d+[,.]\d+)\s*%/i,
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.VIS,
    },
    {
      // LEASING HABITACIONAL   240   17.41%   17.41%
      pattern: /LEASING\s+HABITACIONAL\s+\d+\s+(\d+[,.]\d+)\s*%/i,
      productType: ProductType.LEASING,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.UNKNOWN,
    },
    {
      // CRÉDITO DIRECTO UVR NO VIS   360   12.30%   12.30%
      pattern: /CR[ÉE]DITO\s+DIRECTO\s+UVR\s+NO\s+VIS\s+\d+\s+(\d+[,.]\d+)\s*%/i,
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.NO_VIS,
    },
    {
      // CRÉDITO DIRECTO UVR VIS   360   10.60%   10.60%
      pattern: /CR[ÉE]DITO\s+DIRECTO\s+UVR\s+VIS\s+\d+\s+(\d+[,.]\d+)\s*%/i,
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.VIS,
    },
  ];

  for (const { pattern, productType, currencyIndex, segment } of productPatterns) {
    const match = text.match(pattern);
    if (match) {
      const rateValue = parseColombianNumber(match[1]);

      rates.push({
        productType,
        currencyIndex,
        segment,
        rateFrom: rateValue,
        rateTo: undefined, // Banco de Bogotá shows single rates, not ranges
        description: match[0].trim().substring(0, 100),
      });
    }
  }

  return rates;
}

export class BancoDeBogotaParser implements BankParser {
  bankId = BankId.BANCO_DE_BOGOTA;
  sourceUrl = DEFAULT_SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];
    const offers: Offer[] = [];
    const retrievedAt = new Date().toISOString();

    // Fetch PDF (from fixture or live)
    let pdfBuffer: Buffer;
    if (this.config.useFixtures && this.config.fixturesPath) {
      // Test mode: use fixture file (no URL resolution, no network)
      pdfBuffer = await readFile(this.config.fixturesPath);
    } else {
      // Live mode: resolve URL dynamically (tries current month, falls back to previous)
      const { content, resolvedUrl } = await fetchBancoDeBogotaPdf({
        useBrowserUserAgent: true,
      });
      this.sourceUrl = resolvedUrl;
      pdfBuffer = content;
    }

    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // Extract text from PDF
    const pdfData = new Uint8Array(pdfBuffer);
    const pageTexts = await extractPdfText(pdfData);

    // Combine all pages for searching (vivienda rates are on page 7)
    const fullText = pageTexts.join(" ");

    // Check for the vivienda section marker
    if (
      !/PORTAFOLIO\s+DE\s+VIVIENDA/i.test(fullText) &&
      !/LEASING\s+HABITACIONAL/i.test(fullText)
    ) {
      warnings.push("Could not find 'PORTAFOLIO DE VIVIENDA' or mortgage section");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Parse rates from the combined text
    const extractedRates = parseViviendaSection(fullText);

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
          channel: Channel.UNSPECIFIED,
          rate_from: extracted.rateFrom,
        }),
        bank_id: this.bankId,
        bank_name: BankNames[this.bankId],
        product_type: extracted.productType,
        currency_index: extracted.currencyIndex,
        segment: extracted.segment,
        channel: Channel.UNSPECIFIED,
        rate,
        conditions: {},
        source: {
          url: this.sourceUrl,
          source_type: SourceType.PDF,
          document_label: "Tasas Banco de Bogotá - Vivienda",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.REGEX,
            locator: "vivienda_section",
            excerpt: extracted.description,
          },
        },
      };

      offers.push(offer);
    }

    // Validate expected count
    if (offers.length < 4) {
      warnings.push(
        `Only extracted ${offers.length} offers, expected at least 4 (VIS/NO_VIS × UVR/COP for hipotecario)`
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
