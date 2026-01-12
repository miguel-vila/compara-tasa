import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
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
import { sha256, generateOfferId, parseColombianNumber } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

// Note: Direct PDF URLs return 403. This is the landing page with the link.
// The actual PDF must be downloaded manually for fixtures.
const SOURCE_URL = "https://banco.itau.co/web/personas/informacion-de-interes/tasas-y-tarifas";

// Default fixture path relative to this file
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = join(__dirname, "../../../../fixtures/itau/rates.pdf");

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
  rateMonthlyFrom?: number;
  rateMonthlyTo?: number;
  description: string;
};

/**
 * Parses rates from the Itaú PDF text
 *
 * Itaú PDF structure (2 pages):
 * Page 1:
 * - General loans (crédito personal, rotativo, etc.)
 * - "Adquisición de vivienda nueva y usada" - Hipotecario COP rate
 * - "Compra de cartera (hipotecario con hipotecario)" - COP rate
 * - "Remodelación" - COP rate
 *
 * Page 2:
 * - "Leasing habitacional" section
 * - "Adquisición de vivienda nueva y usada" - Leasing COP rate
 * - "Recolocación" - COP rate
 *
 * Notes:
 * - Only COP rates (no UVR products)
 * - No explicit VIS/NO_VIS distinction
 * - Rates are ranges (from/to)
 */
function parseRates(fullText: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // === HIPOTECARIO - Adquisición de vivienda nueva y usada ===
  // This appears on page 1 before "Leasing habitacional"
  // Pattern: "Adquisición de vivienda nueva y usada Desde X% E.A. Hasta el Y% E.A."
  // The text has spaces in numbers like "1 3 , 1 4 0" so we need flexible patterns
  const hipotecarioMatch = fullText.match(
    /Adquisición\s+de\s+vivienda\s+nueva\s+y\s+usada\s+Desde\s+(\d[\d\s,.]*)%\s*E\.?A\.?\s+Hasta\s+(?:el\s+)?(\d[\d\s,.]*)%\s*E\.?A\.?/i
  );
  if (hipotecarioMatch) {
    const rateFrom = parseColombianNumber(hipotecarioMatch[1].replace(/\s/g, ""));
    const rateTo = parseColombianNumber(hipotecarioMatch[2].replace(/\s/g, ""));
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.UNKNOWN,
      rateFrom,
      rateTo,
      description: "Adquisición de vivienda nueva y usada (Hipotecario)",
    });
  }

  // === LEASING HABITACIONAL - Adquisición de vivienda nueva y usada ===
  // This appears on page 2 after "Leasing habitacional" header
  // We need to find the leasing section and extract rates from there
  const leasingSection = fullText.match(/Leasing\s+habitacional[\s\S]*$/i);
  if (leasingSection) {
    const leasingText = leasingSection[0];
    const leasingMatch = leasingText.match(
      /Adquisición\s+de\s+vivienda\s+nueva\s+y\s+usada\s+Desde\s+(\d[\d\s,.]*)%\s*E\.?A\.?\s+Hasta\s+(?:el\s+)?(\d[\d\s,.]*)%\s*E\.?A\.?/i
    );
    if (leasingMatch) {
      const rateFrom = parseColombianNumber(leasingMatch[1].replace(/\s/g, ""));
      const rateTo = parseColombianNumber(leasingMatch[2].replace(/\s/g, ""));
      rates.push({
        productType: ProductType.LEASING,
        currencyIndex: CurrencyIndex.COP,
        segment: Segment.UNKNOWN,
        rateFrom,
        rateTo,
        description: "Adquisición de vivienda nueva y usada (Leasing Habitacional)",
      });
    }
  }

  return rates;
}

export class ItauParser implements BankParser {
  bankId = BankId.ITAU;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];
    const offers: Offer[] = [];
    const retrievedAt = new Date().toISOString();

    // Itaú blocks automated PDF downloads (403 Forbidden).
    // Always use fixture file - either from config or default location.
    const fixturePath = this.config.fixturesPath || DEFAULT_FIXTURE_PATH;

    if (!existsSync(fixturePath)) {
      warnings.push(
        `Itaú PDF fixture not found at ${fixturePath}. ` +
          `Please download manually from ${SOURCE_URL} and save to fixtures/itau/rates.pdf`
      );
      return {
        bank_id: this.bankId,
        offers: [],
        warnings,
        raw_text_hash: "",
      };
    }

    const pdfBuffer = await readFile(fixturePath);

    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // Extract text from PDF
    const pdfData = new Uint8Array(pdfBuffer);
    const pageTexts = await extractPdfText(pdfData);

    // Combine all pages for searching
    const fullText = pageTexts.join(" ");

    // Check for expected section markers
    if (!/Adquisición\s+de\s+vivienda\s+nueva\s+y\s+usada/i.test(fullText)) {
      warnings.push("Could not find 'Adquisición de vivienda nueva y usada' section");
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
      const rate: Rate = {
        kind: "COP_FIXED",
        ea_percent_from: extracted.rateFrom,
        ea_percent_to: extracted.rateTo,
        mv_percent_from: extracted.rateMonthlyFrom,
        mv_percent_to: extracted.rateMonthlyTo,
      };

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
          document_label: "Tasas vigentes persona natural",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.REGEX,
            locator: `itau_${extracted.productType.toLowerCase()}`,
            excerpt: extracted.description,
          },
        },
      };

      offers.push(offer);
    }

    // Validate expected count - Itaú has fewer products than other banks
    if (offers.length < 2) {
      warnings.push(
        `Only extracted ${offers.length} offers, expected at least 2 (hipotecario and leasing)`
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
