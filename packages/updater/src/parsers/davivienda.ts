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
} from "@mejor-tasa/core";
import { fetchWithRetry, sha256, generateOfferId, parseColombianNumber } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

// Stable URL that always points to the latest rates PDF
const SOURCE_URL = "https://www.davivienda.com/documents/d/guest/tasas-tarifas-davivienda";

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
 * Parses mortgage rates from page texts
 *
 * The PDF structure on page 27 is:
 * E.A   M.V   E.A   M.V
 * 12,60%   0,99%   6,95%   0,56%  <- VIS Hipotecario Nueva
 * 12,50%   0,99%   7,95%   0,64%  <- NO_VIS Hipotecario Nueva
 * ...
 * 12,10%   0,96%   6,95%   0,56%  <- VIS Leasing Nueva
 * 11,00%   0,87%   7,50%   0,60%  <- NO_VIS Leasing Nueva
 *
 * Note: The rate values appear BEFORE the labels in the PDF text extraction order.
 */
function parseViviendaSection(pageTexts: string[]): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // Find the page containing "FINANCIACIÓN DE VIVIENDA"
  let viviendaPageIndex = -1;
  for (let i = 0; i < pageTexts.length; i++) {
    if (/FINANCIACI[ÓO]N\s+DE\s+VIVIENDA/i.test(pageTexts[i])) {
      viviendaPageIndex = i;
      break;
    }
  }

  if (viviendaPageIndex === -1) {
    return rates;
  }

  const viviendaText = pageTexts[viviendaPageIndex];

  // Extract rate patterns: looking for groups of 4 percentages
  // Pattern: COP_EA% COP_MV% UVR_EA% UVR_MV%
  // These must be in the vivienda page's range (11-13% for COP E.A., 6-8% for UVR E.A.)
  const ratePattern = /(\d{1,2}[,.]\d+)\s*%\s+(\d[,.]\d+)\s*%\s+(\d[,.]\d+)\s*%\s+(\d[,.]\d+)\s*%/g;

  const allMatches = [...viviendaText.matchAll(ratePattern)];

  // Filter to find mortgage rate patterns (COP E.A. typically 10-14%, UVR E.A. typically 6-9%)
  const mortgageMatches = allMatches.filter((match) => {
    const copEa = parseColombianNumber(match[1]);
    const uvrEa = parseColombianNumber(match[3]);
    // Mortgage COP rates are typically 10-14% E.A., UVR spreads are 6-9%
    return copEa >= 10 && copEa <= 14 && uvrEa >= 5 && uvrEa <= 10;
  });

  // The first 4 mortgage matches should be:
  // [0] VIS Hipotecario Nueva
  // [1] NO_VIS Hipotecario Nueva
  // [2] VIS Leasing Nueva
  // [3] NO_VIS Leasing Nueva
  const rateConfigs: Array<{
    matchIndex: number;
    productType: ProductType;
    segment: Segment;
  }> = [
    { matchIndex: 0, productType: ProductType.HIPOTECARIO, segment: Segment.VIS },
    { matchIndex: 1, productType: ProductType.HIPOTECARIO, segment: Segment.NO_VIS },
    { matchIndex: 2, productType: ProductType.LEASING, segment: Segment.VIS },
    { matchIndex: 3, productType: ProductType.LEASING, segment: Segment.NO_VIS },
  ];

  for (const config of rateConfigs) {
    if (mortgageMatches[config.matchIndex]) {
      const match = mortgageMatches[config.matchIndex];
      const copEa = parseColombianNumber(match[1]);
      const uvrEa = parseColombianNumber(match[3]);

      // COP rate
      rates.push({
        productType: config.productType,
        currencyIndex: CurrencyIndex.COP,
        segment: config.segment,
        rateFrom: copEa,
        description: `${config.productType} ${config.segment} COP ${copEa}%`,
      });

      // UVR rate
      rates.push({
        productType: config.productType,
        currencyIndex: CurrencyIndex.UVR,
        segment: config.segment,
        rateFrom: uvrEa,
        description: `${config.productType} ${config.segment} UVR ${uvrEa}%`,
      });
    }
  }

  return rates;
}

export class DaviviendaParser implements BankParser {
  bankId = BankId.DAVIVIENDA;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];
    const offers: Offer[] = [];
    const retrievedAt = new Date().toISOString();

    // Fetch PDF (from fixture or live)
    let pdfBuffer: Buffer;
    if (this.config.useFixtures && this.config.fixturesPath) {
      pdfBuffer = await readFile(this.config.fixturesPath);
    } else {
      // Fetch from stable URL that always points to the latest rates PDF
      const result = await fetchWithRetry(SOURCE_URL, {
        useBrowserUserAgent: true,
      });
      pdfBuffer = result.content;
    }

    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // Extract text from PDF
    const pdfData = new Uint8Array(pdfBuffer);
    let pageTexts: string[];
    try {
      pageTexts = await extractPdfText(pdfData);
    } catch (error) {
      warnings.push(`Failed to extract PDF text: ${error}`);
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Check for the vivienda section marker
    const fullText = pageTexts.join(" ");
    if (
      !/FINANCIACI[ÓO]N\s+DE\s+VIVIENDA/i.test(fullText) &&
      !/Cr[eé]dito\s+Hipotecario/i.test(fullText)
    ) {
      warnings.push("Could not find 'FINANCIACIÓN DE VIVIENDA' or mortgage section");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Parse rates from the page texts
    const extractedRates = parseViviendaSection(pageTexts);

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
          document_label: "Tasas y Tarifas Davivienda - Vivienda",
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
    // We expect at least 8 offers: VIS/NO_VIS × UVR/COP × HIPOTECARIO/LEASING
    if (offers.length < 8) {
      warnings.push(
        `Only extracted ${offers.length} offers, expected at least 8 (VIS/NO_VIS × UVR/COP × HIPOTECARIO/LEASING)`
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
