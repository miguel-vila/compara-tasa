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

const SOURCE_URL =
  "https://www.bbva.com.co/content/dam/public-web/colombia/documents/home/prefooter/tarifas/DO-11-TASAS-VIVIENDA.pdf";

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
  rateMonthly?: number;
  payrollDiscountBps?: number;
  description: string;
};

/**
 * Parses rates from the BBVA PDF text
 *
 * BBVA PDF structure (single page):
 * - "VIS - Pesos" section with traditional hipotecario COP rate
 * - "VIS - UVR" section with traditional hipotecario UVR rate
 * - "NO VIS - Pesos" section with traditional hipotecario COP rate
 * - "NO VIS - UVR" section with traditional hipotecario UVR rate
 * - "Leasing Habitacional" section with NO VIS and VIS Pesos rates
 *
 * Payroll discount:
 * - VIS COP: +200bps without payroll
 * - VIS UVR: +200bps without payroll
 * - NO VIS COP: +250bps without payroll
 * - NO VIS UVR: +150bps without payroll
 * - Leasing: +250bps for NO VIS, +150bps for VIS
 */
function parseRates(text: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // === HIPOTECARIO VIS - Pesos ===
  // Pattern: "VIS - Pesos" ... "Tradicional" ... "E.A." value
  // Example: "VIS - Pesos  Línea   Tasas desde ... Tradicional   9,77%   0,78%"
  const visCopmatch = text.match(
    /VIS\s*-\s*Pesos\s+Línea\s+Tasas desde[\s\S]*?Tradicional\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%/i
  );
  if (visCopmatch) {
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.VIS,
      rateFrom: parseColombianNumber(visCopmatch[1]),
      rateMonthly: parseColombianNumber(visCopmatch[2]),
      payrollDiscountBps: 200,
      description: "VIS - Pesos Tradicional",
    });
  }

  // === HIPOTECARIO VIS - UVR ===
  // Pattern: "VIS - UVR" ... "UVR +" value
  // Example: "VIS - UVR  Línea ... Tradicional cuota integral: UVR +   5,52%   0,45%"
  const visUvrMatch = text.match(
    /VIS\s*-\s*UVR\s+Línea\s+Tasas desde[\s\S]*?Tradicional\s+cuota\s+integral:\s*UVR\s*\+\s*(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%/i
  );
  if (visUvrMatch) {
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.VIS,
      rateFrom: parseColombianNumber(visUvrMatch[1]),
      rateMonthly: parseColombianNumber(visUvrMatch[2]),
      payrollDiscountBps: 200,
      description: "VIS - UVR Tradicional cuota integral",
    });
  }

  // === HIPOTECARIO NO VIS - Pesos ===
  // Pattern: "NO VIS - Pesos" ... "Tradicional" ... E.A. value
  // Example: "NO VIS - Pesos  Línea ... Tradicional   11,98%   0,95%"
  const noVisCopMatch = text.match(
    /NO\s+VIS\s*-\s*Pesos\s+Línea\s+Tasas desde[\s\S]*?Tradicional\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%/i
  );
  if (noVisCopMatch) {
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.NO_VIS,
      rateFrom: parseColombianNumber(noVisCopMatch[1]),
      rateMonthly: parseColombianNumber(noVisCopMatch[2]),
      payrollDiscountBps: 250,
      description: "NO VIS - Pesos Tradicional",
    });
  }

  // === HIPOTECARIO NO VIS - UVR ===
  // Pattern: "NO VIS - UVR" ... "Tradicional Cuota integral: UVR +" value
  // Example: "NO VIS - UVR  Línea ... Tradicional Cuota integral: UVR +   7,40%   0,60%"
  const noVisUvrMatch = text.match(
    /NO\s+VIS\s*-\s*UVR\s+Línea\s+Tasas desde[\s\S]*?Tradicional\s+Cuota\s+integral:\s*UVR\s*\+\s*(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%/i
  );
  if (noVisUvrMatch) {
    rates.push({
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.NO_VIS,
      rateFrom: parseColombianNumber(noVisUvrMatch[1]),
      rateMonthly: parseColombianNumber(noVisUvrMatch[2]),
      payrollDiscountBps: 150,
      description: "NO VIS - UVR Tradicional Cuota integral",
    });
  }

  // === LEASING HABITACIONAL NO VIS - Pesos ===
  // Pattern: "Leasing Habitacional  NO VIS - Pesos" ... "Tradicional   Familiar" ... value
  // Example: "Leasing Habitacional  NO VIS - Pesos  Línea ... Tradicional   Familiar   10,19%   0,81%"
  const leasingNoVisMatch = text.match(
    /Leasing\s+Habitacional\s+NO\s+VIS\s*-\s*Pesos\s+Línea\s+Tasas desde[\s\S]*?Tradicional\s+Familiar\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%/i
  );
  if (leasingNoVisMatch) {
    rates.push({
      productType: ProductType.LEASING,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.NO_VIS,
      rateFrom: parseColombianNumber(leasingNoVisMatch[1]),
      rateMonthly: parseColombianNumber(leasingNoVisMatch[2]),
      payrollDiscountBps: 250,
      description: "Leasing Habitacional NO VIS - Pesos Tradicional Familiar",
    });
  }

  // === LEASING HABITACIONAL VIS - Pesos ===
  // This comes after NO VIS in the document, within the Leasing section
  // The structure is: "Leasing Habitacional  NO VIS - Pesos" ... "*Aplica..." ... "VIS - Pesos" ... "Tradicional Familiar"
  // We need to find VIS - Pesos that appears after the Leasing section marker and extract the rate
  const leasingSection = text.match(/Leasing\s+Habitacional[\s\S]*?REMODELACIÓN/i);
  if (leasingSection) {
    const leasingText = leasingSection[0];
    // Find VIS - Pesos section within leasing (not at start - that would be NO VIS)
    const leasingVisMatch = leasingText.match(
      /\*Aplica[\s\S]*?VIS\s*-\s*Pesos\s+Línea\s+Tasas desde[\s\S]*?Tradicional\s+Familiar\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%/i
    );
    if (leasingVisMatch) {
      rates.push({
        productType: ProductType.LEASING,
        currencyIndex: CurrencyIndex.COP,
        segment: Segment.VIS,
        rateFrom: parseColombianNumber(leasingVisMatch[1]),
        rateMonthly: parseColombianNumber(leasingVisMatch[2]),
        payrollDiscountBps: 150,
        description: "Leasing Habitacional VIS - Pesos Tradicional Familiar",
      });
    }
  }

  return rates;
}

export class BbvaParser implements BankParser {
  bankId = BankId.BBVA;
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
      const result = await fetchWithRetry(this.sourceUrl);
      pdfBuffer = result.content;
    }

    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // Extract text from PDF
    const pdfData = new Uint8Array(pdfBuffer);
    const pageTexts = await extractPdfText(pdfData);

    // Combine all pages for searching
    const fullText = pageTexts.join(" ");

    // Check for the housing rates section
    if (!/TASAS DE INTERÉS LINEAS DE VIVIENDA/i.test(fullText)) {
      warnings.push("Could not find 'TASAS DE INTERÉS LINEAS DE VIVIENDA' section");
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
          spread_mv_from: extracted.rateMonthly,
        };
      } else {
        rate = {
          kind: "COP_FIXED",
          ea_percent_from: extracted.rateFrom,
          mv_percent_from: extracted.rateMonthly,
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
        conditions: extracted.payrollDiscountBps
          ? {
              payroll_discount: {
                type: "BPS_OFF",
                value: extracted.payrollDiscountBps,
                applies_to: "RATE",
                note: `Tasa con beneficio con cuenta de nómina. Sin nómina +${extracted.payrollDiscountBps}pbs`,
              },
            }
          : {},
        source: {
          url: this.sourceUrl,
          source_type: SourceType.PDF,
          document_label: "Tasas de interés líneas de vivienda",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.REGEX,
            locator: `bbva_${extracted.segment.toLowerCase()}_${extracted.currencyIndex.toLowerCase()}`,
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
