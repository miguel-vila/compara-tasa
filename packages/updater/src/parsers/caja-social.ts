import { readFile } from "fs/promises";
import {
  BankId,
  BankNames,
  MortgageType,
  CurrencyIndex,
  Segment,
  Channel,
  SourceType,
  ExtractionMethod,
  type MortgageOffer,
  type Rate,
  type BankMortgageParseResult,
} from "@compara-tasa/core";
import { fetchWithRetry, sha256, generateOfferId, parseColombianNumber } from "../utils/index.js";
import type { BankMortgageParser, ParserConfig } from "./types.js";

const SOURCE_URL =
  "https://www.bancocajasocial.com/content/dam/bcs/documentos/informacion-corporativa/tasas-precios-y-comisiones/credito-vivienda/Tasas-Credito-Vivienda.pdf";

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
  productType: MortgageType;
  currencyIndex: CurrencyIndex;
  segment: Segment;
  rateFrom: number;
  rateTo?: number;
  rateMonthlyFrom?: number;
  rateMonthlyTo?: number;
  description: string;
};

/**
 * Parses rates from the Banco Caja Social PDF text
 *
 * PDF structure (single page, table format):
 * Header row: E.A. | M.V. | E.A. | M.V. | E.A. | M.V. | E.A. | M.V.
 * Sub-header: Desde | Hasta (for PESOS and UVR)
 *
 * Data rows:
 * VIS   | COP_FROM% | COP_MV% | UVR_FROM% + UVR | UVR_MV% + UVR | COP_TO% | COP_MV% | UVR_TO% + UVR | UVR_MV% + UVR
 * NO VIS| COP_FROM% | COP_MV% | UVR_FROM% + UVR | UVR_MV% + UVR | COP_TO% | COP_MV% | UVR_TO% + UVR | UVR_MV% + UVR
 *
 * Example extracted text:
 * "VIS   10.00%   0.80%   5.15% + UVR   0.42% + UVR   14.85%   1.16%   8.10% + UVR   0.65% + UVR"
 * "NO VIS   10.00%   0.80%   6.45% + UVR   0.52% + UVR   16.10%   1.25%   9.20% + UVR   0.74% + UVR"
 */
function parseRates(text: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // Pattern for VIS row (appears before NO VIS)
  // VIS   10.00%   0.80%   5.15% + UVR   0.42% + UVR   14.85%   1.16%   8.10% + UVR   0.65% + UVR
  const visPattern =
    /VIS\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%\s*\+\s*UVR\s+(\d+[,.]?\d*)\s*%\s*\+\s*UVR\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%\s*\+\s*UVR\s+(\d+[,.]?\d*)\s*%\s*\+\s*UVR/i;

  // Pattern for NO VIS row
  const noVisPattern =
    /NO\s*VIS\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%\s*\+\s*UVR\s+(\d+[,.]?\d*)\s*%\s*\+\s*UVR\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%\s+(\d+[,.]?\d*)\s*%\s*\+\s*UVR\s+(\d+[,.]?\d*)\s*%\s*\+\s*UVR/i;

  // Extract VIS rates
  const visMatch = text.match(visPattern);
  if (visMatch) {
    // VIS COP (PESOS)
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.VIS,
      rateFrom: parseColombianNumber(visMatch[1]),
      rateMonthlyFrom: parseColombianNumber(visMatch[2]),
      rateTo: parseColombianNumber(visMatch[5]),
      rateMonthlyTo: parseColombianNumber(visMatch[6]),
      description: "VIS - Pesos",
    });

    // VIS UVR
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.VIS,
      rateFrom: parseColombianNumber(visMatch[3]),
      rateMonthlyFrom: parseColombianNumber(visMatch[4]),
      rateTo: parseColombianNumber(visMatch[7]),
      rateMonthlyTo: parseColombianNumber(visMatch[8]),
      description: "VIS - UVR",
    });
  }

  // Extract NO VIS rates
  const noVisMatch = text.match(noVisPattern);
  if (noVisMatch) {
    // NO VIS COP (PESOS)
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.NO_VIS,
      rateFrom: parseColombianNumber(noVisMatch[1]),
      rateMonthlyFrom: parseColombianNumber(noVisMatch[2]),
      rateTo: parseColombianNumber(noVisMatch[5]),
      rateMonthlyTo: parseColombianNumber(noVisMatch[6]),
      description: "NO VIS - Pesos",
    });

    // NO VIS UVR
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.NO_VIS,
      rateFrom: parseColombianNumber(noVisMatch[3]),
      rateMonthlyFrom: parseColombianNumber(noVisMatch[4]),
      rateTo: parseColombianNumber(noVisMatch[7]),
      rateMonthlyTo: parseColombianNumber(noVisMatch[8]),
      description: "NO VIS - UVR",
    });
  }

  return rates;
}

export class CajaSocialParser implements BankMortgageParser {
  bankId = BankId.BANCO_CAJA_SOCIAL;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankMortgageParseResult> {
    const warnings: string[] = [];
    const offers: MortgageOffer[] = [];
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
    if (!/Tasas de Interés Crédito Hipotecario/i.test(fullText)) {
      warnings.push("Could not find 'Tasas de Interés Crédito Hipotecario' section");
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
          spread_mv_from: extracted.rateMonthlyFrom,
          spread_mv_to: extracted.rateMonthlyTo,
        };
      } else {
        rate = {
          kind: "COP_FIXED",
          ea_percent_from: extracted.rateFrom,
          ea_percent_to: extracted.rateTo,
          mv_percent_from: extracted.rateMonthlyFrom,
          mv_percent_to: extracted.rateMonthlyTo,
        };
      }

      const offer: MortgageOffer = {
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
          document_label: "Tasas Crédito de Vivienda",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.REGEX,
            locator: `caja_social_${extracted.segment.toLowerCase()}_${extracted.currencyIndex.toLowerCase()}`,
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
