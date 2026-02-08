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
import { fetchWithRetry, sha256, generateSavingsOfferId } from "../../utils/index.js";
import type { BankSavingsParser, SavingsParserConfig } from "./types.js";

const SOURCE_URL = "https://www.uala.com.co/prensa";

/**
 * Parses the Ualá prensa (press releases) page to extract savings account rates.
 *
 * Ualá publishes rate updates via press releases on their /prensa page.
 * The page contains embedded JSON with news entries that include rate information.
 * We search for the most recent entry mentioning "rendimiento" and extract the E.A. rate.
 */
export class UalaParser implements BankSavingsParser {
  bankId = BankId.UALA;
  sourceUrl = SOURCE_URL;

  constructor(private config: SavingsParserConfig = {}) {}

  async parse(): Promise<BankSavingsParseResult> {
    const warnings: string[] = [];
    const offers: SavingsOffer[] = [];
    const retrievedAt = new Date().toISOString();

    // Fetch HTML (from fixture or live)
    let html: string;
    if (this.config.useFixtures && this.config.fixturesPath) {
      html = await readFile(this.config.fixturesPath, "utf-8");
    } else {
      const result = await fetchWithRetry(this.sourceUrl, {
        useBrowserUserAgent: true,
      });
      html = result.content.toString("utf-8");
    }

    const rawTextHash = sha256(html);

    // Extract rate from press release content
    // Look for patterns like "rendimiento de sus depósitos en 13% E.A." or "rendimiento del 13% E.A."
    const ratePatterns = [
      /rendimiento de sus depósitos en (\d+(?:[.,]\d+)?)\s*%\s*E\.A\./i,
      /rendimiento del (\d+(?:[.,]\d+)?)\s*%\s*E\.A\./i,
      /rendimientos del (\d+(?:[.,]\d+)?)\s*%\s*E\.A\./i,
      /tasa de rendimiento.*?(\d+(?:[.,]\d+)?)\s*%\s*E\.A\./i,
      /(\d+(?:[.,]\d+)?)\s*%\s*E\.A\..*?rendimiento/i,
    ];

    let extractedRate: number | null = null;
    let excerpt: string | null = null;

    for (const pattern of ratePatterns) {
      const match = html.match(pattern);
      if (match) {
        // Parse the rate (handle both comma and period as decimal separator)
        const rateStr = match[1].replace(",", ".");
        extractedRate = parseFloat(rateStr);
        excerpt = match[0].slice(0, 100);
        break;
      }
    }

    if (extractedRate === null) {
      throw new Error(
        "Could not extract savings rate from Ualá prensa page - page structure may have changed"
      );
    }

    // Validate rate is reasonable (between 1% and 20%)
    if (extractedRate < 1 || extractedRate > 20) {
      throw new Error(`Extracted rate ${extractedRate}% E.A. seems unreasonable`);
    }

    // Ualá offers a single rate for their "Depósito remunerado" (remunerative deposit)
    // which applies from the first peso with no minimum balance or holding period
    const offer: SavingsOffer = {
      id: generateSavingsOfferId({
        bank_id: this.bankId,
        account_type: SavingsAccountType.HIGH_YIELD,
        account_name: "Depósito Remunerado",
        ea_percent: extractedRate,
        min_amount_cop: 1,
      }),
      bank_id: this.bankId,
      bank_name: BankNames[this.bankId],
      account_type: SavingsAccountType.HIGH_YIELD,
      account_name: "Depósito Remunerado",
      rate: { ea_percent: extractedRate },
      min_amount_cop: 1,
      source: {
        url: this.sourceUrl,
        source_type: SourceType.HTML,
        document_label: "Comunicados de Prensa",
        retrieved_at: retrievedAt,
        extracted_text_fingerprint: rawTextHash,
        extraction: {
          method: ExtractionMethod.REGEX,
          locator: "prensa page content",
          excerpt: excerpt || `${extractedRate}% E.A.`,
        },
      },
    };

    offers.push(offer);

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
