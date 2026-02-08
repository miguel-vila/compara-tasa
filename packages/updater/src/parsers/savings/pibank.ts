import { readFile } from "fs/promises";
import {
  BankId,
  BankNames,
  SavingsAccountType,
  SourceType,
  ExtractionMethod,
  type SavingsOffer,
  type BankSavingsParseResult,
} from "@compara-tasa/core";
import { fetchPibankPdf, sha256, generateSavingsOfferId } from "../../utils/index.js";
import type { BankSavingsParser, SavingsParserConfig } from "./types.js";

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

/**
 * Parser for Pibank savings account rates.
 *
 * Pibank (Banco Pichincha Colombia) offers a single savings account product called "Cuenta Pibank"
 * with a flat rate for all balances, no tiers. The rate is published in a PDF document that
 * also includes CDT and credit rates.
 *
 * PDF structure (page 1):
 * - "Cuenta Pibank" section contains savings rate
 * - Format: "Desde $1 y sin límite de ahorro 11% Sobre saldo diario..."
 */
export class PibankParser implements BankSavingsParser {
  bankId = BankId.PIBANK;
  sourceUrl = "https://www.pibank.co/tasas-y-tarifas"; // Landing page; actual PDF URL resolved dynamically

  constructor(private config: SavingsParserConfig = {}) {}

  async parse(): Promise<BankSavingsParseResult> {
    const warnings: string[] = [];
    const offers: SavingsOffer[] = [];
    const retrievedAt = new Date().toISOString();

    // Fetch PDF (from fixture or live)
    let pdfBuffer: Buffer;
    let resolvedUrl: string;
    if (this.config.useFixtures && this.config.fixturesPath) {
      pdfBuffer = await readFile(this.config.fixturesPath);
      resolvedUrl = this.sourceUrl;
    } else {
      const result = await fetchPibankPdf();
      pdfBuffer = result.content;
      resolvedUrl = result.resolvedUrl;
    }

    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // Extract text from PDF
    const pdfData = new Uint8Array(pdfBuffer);
    const pageTexts = await extractPdfText(pdfData);
    const fullText = pageTexts.join(" ");

    // Verify we're reading the right document
    if (
      !/Pibank\s+es\s+una\s+marca\s+registrada\s+por\s+Banco\s+Pichincha\s+Colombia/i.test(fullText)
    ) {
      throw new Error("Could not find Pibank header - PDF structure may have changed");
    }

    // Find the Cuenta Pibank rate
    // PDF layout note: Section headers appear AFTER the content they describe.
    // The savings rate appears as: "Desde $1 y sin límite de ahorro 1 1 %"
    // followed by liquidation info, then "Tasas Cuenta Pibank" header at the end.
    // The rate "11%" may appear as "1 1 %" due to PDF text extraction quirks with spaces.

    // First, try to find rate with digits separated by spaces (e.g., "1 1 %")
    const altMatch = fullText.match(
      /Desde\s+\$\s*1\s+y\s+sin\s+límite\s+de\s+ahorro\s+(\d)\s+(\d)\s*%/i
    );

    if (altMatch) {
      // Combine the two digits (e.g., "1" "1" -> 11)
      const rate = parseInt(altMatch[1] + altMatch[2], 10);
      this.addCuentaPibankOffer(offers, rate, retrievedAt, rawTextHash, resolvedUrl);
    } else {
      // Try standard format with comma decimal separator (e.g., "11,50%") or integer (e.g., "11%")
      const standardMatch = fullText.match(
        /Desde\s+\$\s*1\s+y\s+sin\s+límite\s+de\s+ahorro\s+(\d+)\s*,?\s*(\d*)\s*%/i
      );

      if (!standardMatch) {
        throw new Error("Could not find Cuenta Pibank rate - PDF structure may have changed");
      }

      let rate: number;
      if (standardMatch[2]) {
        rate = parseFloat(`${standardMatch[1]}.${standardMatch[2]}`);
      } else {
        rate = parseInt(standardMatch[1], 10);
      }
      this.addCuentaPibankOffer(offers, rate, retrievedAt, rawTextHash, resolvedUrl);
    }

    // Validate we extracted something useful
    if (offers.length === 0) {
      throw new Error("No savings offers extracted - PDF structure may have changed");
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }

  private addCuentaPibankOffer(
    offers: SavingsOffer[],
    eaPercent: number,
    retrievedAt: string,
    rawTextHash: string,
    sourceUrl: string
  ): void {
    const offer: SavingsOffer = {
      id: generateSavingsOfferId({
        bank_id: this.bankId,
        account_type: SavingsAccountType.HIGH_YIELD,
        account_name: "Cuenta Pibank",
        ea_percent: eaPercent,
        min_amount_cop: 1,
      }),
      bank_id: this.bankId,
      bank_name: BankNames[this.bankId],
      account_type: SavingsAccountType.HIGH_YIELD,
      account_name: "Cuenta Pibank",
      rate: { ea_percent: eaPercent },
      min_amount_cop: 1,
      source: {
        url: sourceUrl,
        source_type: SourceType.PDF,
        document_label: "Tasas y Tarifario",
        retrieved_at: retrievedAt,
        extracted_text_fingerprint: rawTextHash,
        extraction: {
          method: ExtractionMethod.REGEX,
          locator: "pibank_cuenta_pibank",
          excerpt: `Cuenta Pibank: ${eaPercent}% E.A.`,
        },
      },
    };

    offers.push(offer);
  }
}
