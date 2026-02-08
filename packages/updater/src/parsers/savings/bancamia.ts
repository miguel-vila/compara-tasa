import { readFile } from "fs/promises";
import {
  BankId,
  BankNames,
  SavingsAccountType,
  ExtractionMethod,
  type SavingsOffer,
  type BankSavingsParseResult,
  type ScrappedSavingsSource,
} from "@compara-tasa/core";
import { fetchWithRetry, sha256, generateSavingsOfferId } from "../../utils/index.js";
import type { BankSavingsParser, SavingsParserConfig } from "./types.js";

const SOURCE_URL =
  "https://www.bancamia.com.co/wp-content/uploads/2025/01/TASAS-Y-TARIFAS-AHORRO-DEL-17-DE-ENERO-AL-2-DE-FEBRERO-2025.pdf";

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
 * RentaPlus rate tiers as specified in Bancamía PDF.
 * The PDF shows tiered rates for the RentaPlus high-yield savings account.
 *
 * PDF structure (page 1):
 * - RentaPlus column with 6 tiers:
 *   - Menores o iguales a $499.999: 5.00%
 *   - Desde $500.001 a $999.999: 6.00%
 *   - Desde $1.000.000 a $1.999.999: 7.00%
 *   - Desde $2.000.000 a $4.999.999: 8.00%
 *   - Desde $5.000.000 a $9.999.999: 10.00%
 *   - De $10.000.000 en adelante: 10.50%
 */
type RentaPlusTier = {
  minAmount: number;
  maxAmount: number | undefined;
  rate: number;
};

const EXPECTED_RENTAPLUS_TIERS: RentaPlusTier[] = [
  { minAmount: 1, maxAmount: 499_999, rate: 5.0 },
  { minAmount: 500_001, maxAmount: 999_999, rate: 6.0 },
  { minAmount: 1_000_000, maxAmount: 1_999_999, rate: 7.0 },
  { minAmount: 2_000_000, maxAmount: 4_999_999, rate: 8.0 },
  { minAmount: 5_000_000, maxAmount: 9_999_999, rate: 10.0 },
  { minAmount: 10_000_000, maxAmount: undefined, rate: 10.5 },
];

/**
 * Parser for Bancamía RentaPlus savings account rates.
 *
 * Bancamía offers a high-yield savings account called "RentaPlus" with tiered rates
 * based on balance amounts. The rates are published in a PDF document that includes
 * all savings products and their fees.
 */
export class BancamiaParser implements BankSavingsParser {
  bankId = BankId.BANCAMIA;
  sourceUrl = SOURCE_URL;

  constructor(private config: SavingsParserConfig = {}) {}

  async parse(): Promise<BankSavingsParseResult> {
    const warnings: string[] = [];
    const offers: SavingsOffer[] = [];
    const retrievedAt = new Date().toISOString();

    // Fetch PDF (from fixture or live)
    let pdfBuffer: Buffer;
    if (this.config.useFixtures && this.config.fixturesPath) {
      pdfBuffer = await readFile(this.config.fixturesPath);
    } else {
      const result = await fetchWithRetry(this.sourceUrl, {
        useBrowserUserAgent: true,
      });
      pdfBuffer = result.content;
    }

    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // Extract text from PDF
    const pdfData = new Uint8Array(pdfBuffer);
    const pageTexts = await extractPdfText(pdfData);
    const fullText = pageTexts.join(" ");

    // Verify we're reading the right document (Bancamía savings rates)
    if (!/Tasas\s+y\s+Tarifas\s+de\s+Ahorro/i.test(fullText)) {
      throw new Error(
        "Could not find 'Tasas y Tarifas de Ahorro' header - PDF structure may have changed"
      );
    }

    // Verify RentaPlus is present
    if (!/Rentaplus/i.test(fullText)) {
      throw new Error("Could not find RentaPlus product - PDF structure may have changed");
    }

    // Extract RentaPlus rates from the PDF text
    // The PDF structure shows rates in a specific order after the RentaPlus header
    // We look for the pattern of 6 consecutive percentages that match the RentaPlus column
    const rentaPlusRates = this.extractRentaPlusRates(fullText);

    if (rentaPlusRates.length !== 6) {
      throw new Error(
        `Expected 6 RentaPlus tiers but found ${rentaPlusRates.length} - PDF structure may have changed`
      );
    }

    // Create offers for each tier
    for (let i = 0; i < rentaPlusRates.length; i++) {
      const tier = EXPECTED_RENTAPLUS_TIERS[i];
      const extractedRate = rentaPlusRates[i];

      // Validate extracted rate matches expected
      if (Math.abs(extractedRate - tier.rate) > 0.01) {
        warnings.push(
          `RentaPlus tier ${i + 1}: expected ${tier.rate}% but found ${extractedRate}%`
        );
      }

      const offer: SavingsOffer = {
        id: generateSavingsOfferId({
          bank_id: this.bankId,
          account_type: SavingsAccountType.HIGH_YIELD,
          account_name: "RentaPlus",
          ea_percent: extractedRate,
          min_amount_cop: tier.minAmount,
        }),
        bank_id: this.bankId,
        bank_name: BankNames[this.bankId],
        account_type: SavingsAccountType.HIGH_YIELD,
        account_name: "RentaPlus",
        rate: { ea_percent: extractedRate },
        min_amount_cop: tier.minAmount,
        max_amount_cop: tier.maxAmount,
        source: {
          kind: "scrapped",
          url: this.sourceUrl,
          source_type: "PDF",
          document_label: "Tasas y Tarifas de Ahorro",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.REGEX,
            locator: "bancamia_rentaplus_tier",
            excerpt: `RentaPlus tier ${i + 1}: ${extractedRate}% E.A.`,
          },
        } satisfies ScrappedSavingsSource,
      };

      offers.push(offer);
    }

    // Validate we got all expected offers
    if (offers.length === 0) {
      throw new Error("No RentaPlus offers extracted - PDF structure may have changed");
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }

  /**
   * Extracts RentaPlus rates from the PDF text.
   *
   * The PDF text structure shows rate columns in order. The RentaPlus rates appear
   * as the last column before the range descriptions. We look for the pattern:
   * "Rentaplus P.N 5,00% 6,00% 7,00% 8,00% 10,00% 10,50%"
   */
  private extractRentaPlusRates(text: string): number[] {
    // Find the RentaPlus section - rates appear after "Rentaplus P.N" header
    // The pattern in the PDF shows: "Rentaplus P.N 5,00% 6,00% ..."
    const rentaPlusMatch = text.match(/Rentaplus\s+P\.?N\s+([\d,]+%\s*)+/i);

    if (rentaPlusMatch) {
      // Extract all percentages from the matched section
      const percentages = rentaPlusMatch[0].match(/(\d+),(\d+)%/g);
      if (percentages) {
        return percentages.map((p) => {
          const match = p.match(/(\d+),(\d+)%/);
          if (!match) return 0;
          return parseFloat(`${match[1]}.${match[2]}`);
        });
      }
    }

    // Alternative: look for the sequence of 6 rates that match the RentaPlus pattern
    // In the PDF text, rates appear in columns. We look for the specific sequence.
    const allRates = text.match(/(\d+),(\d+)%/g) || [];
    const rates = allRates.map((r) => {
      const match = r.match(/(\d+),(\d+)%/);
      return match ? parseFloat(`${match[1]}.${match[2]}`) : 0;
    });

    // Find the sequence 5.0, 6.0, 7.0, 8.0, 10.0, 10.5 which is unique to RentaPlus
    for (let i = 0; i <= rates.length - 6; i++) {
      const slice = rates.slice(i, i + 6);
      if (
        Math.abs(slice[0] - 5.0) < 0.01 &&
        Math.abs(slice[1] - 6.0) < 0.01 &&
        Math.abs(slice[2] - 7.0) < 0.01 &&
        Math.abs(slice[3] - 8.0) < 0.01 &&
        Math.abs(slice[4] - 10.0) < 0.01 &&
        Math.abs(slice[5] - 10.5) < 0.01
      ) {
        return slice;
      }
    }

    return [];
  }
}
