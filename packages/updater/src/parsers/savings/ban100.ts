import * as cheerio from "cheerio";
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

const SOURCE_URL = "https://www.ban100.com.co/productos/cuenta-de-ahorro";

type RateTier = {
  min_amount: number;
  max_amount?: number;
  ea_percent: number;
};

/**
 * Parses Colombian number format (e.g., "10.000.000" or "$10.000.000")
 */
function parseColombianAmount(text: string): number {
  // Remove $ prefix, periods (thousand separators), and trim
  const cleaned = text.replace(/[$\s]/g, "").replace(/\./g, "");
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) {
    throw new Error(`Failed to parse Colombian amount: "${text}"`);
  }
  return num;
}

/**
 * Parses Colombian percentage format (e.g., "6,50% E.A." -> 6.5)
 */
function parseColombianPercent(text: string): number {
  // Extract number with comma as decimal separator
  const match = text.match(/(\d+),(\d+)\s*%/);
  if (!match) {
    throw new Error(`Failed to parse percentage: "${text}"`);
  }
  return parseFloat(`${match[1]}.${match[2]}`);
}

export class Ban100Parser implements BankSavingsParser {
  bankId = BankId.BAN100;
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
      const result = await fetchWithRetry(this.sourceUrl);
      html = result.content.toString("utf-8");
    }

    const rawTextHash = sha256(html);
    const $ = cheerio.load(html);

    // Find all tables on the page
    const tables = $("table");

    if (tables.length < 2) {
      throw new Error(`Expected at least 2 tables, found ${tables.length}`);
    }

    // Parse first table: Cuenta de Ahorro 100pre (high yield with tiers)
    const table100pre = $(tables[0]);
    const offers100pre = this.parseTable100pre($, table100pre, retrievedAt, rawTextHash);
    offers.push(...offers100pre);

    // Parse second table: Cuenta de Ahorro Clásica (standard single rate)
    const tableClasica = $(tables[1]);
    const offersClasica = this.parseTableClasica($, tableClasica, retrievedAt, rawTextHash);
    offers.push(...offersClasica);

    // Validate we got expected offers
    if (offers.length === 0) {
      throw new Error("No offers extracted - page structure may have changed");
    }

    if (offers100pre.length < 3) {
      warnings.push(`Expected 3 tier offers for 100pre account, got ${offers100pre.length}`);
    }

    if (offersClasica.length !== 1) {
      warnings.push(`Expected 1 offer for Clásica account, got ${offersClasica.length}`);
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }

  private parseTable100pre(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    retrievedAt: string,
    rawTextHash: string
  ): SavingsOffer[] {
    const offers: SavingsOffer[] = [];
    const accountName = "Cuenta de Ahorro 100pre";
    const accountType = SavingsAccountType.HIGH_YIELD;

    // Find rows with rate data (look for % E.A.)
    const rows = table.find("tbody tr");

    rows.each((_: number, rowEl: unknown) => {
      const row = $(rowEl);
      const cells = row.find("td");

      if (cells.length < 3) return;

      const firstCell = $(cells[0]).text().trim();
      const lastCell = $(cells[cells.length - 1])
        .text()
        .trim();

      // Skip non-rate rows
      if (!lastCell.includes("E.A.")) return;
      // Skip header rows
      if (firstCell.toLowerCase().includes("concepto")) return;
      if (firstCell.toLowerCase().includes("cuota de manejo")) return;

      try {
        const tier = this.parseAmountRange(firstCell);
        const eaPercent = parseColombianPercent(lastCell);

        const offer: SavingsOffer = {
          id: generateSavingsOfferId({
            bank_id: this.bankId,
            account_type: accountType,
            account_name: accountName,
            ea_percent: eaPercent,
            min_amount_cop: tier.min_amount,
          }),
          bank_id: this.bankId,
          bank_name: BankNames[this.bankId],
          account_type: accountType,
          account_name: accountName,
          rate: { ea_percent: eaPercent },
          min_amount_cop: tier.min_amount,
          max_amount_cop: tier.max_amount,
          source: {
            url: this.sourceUrl,
            source_type: SourceType.HTML,
            document_label: "Cuenta de Ahorro",
            retrieved_at: retrievedAt,
            extracted_text_fingerprint: rawTextHash,
            extraction: {
              method: ExtractionMethod.CSS_SELECTOR,
              locator: "table:first tbody tr",
              excerpt: `${firstCell}: ${lastCell}`,
            },
          },
        };

        offers.push(offer);
      } catch {
        // Skip rows we can't parse (like header rows)
      }
    });

    return offers;
  }

  private parseTableClasica(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    retrievedAt: string,
    rawTextHash: string
  ): SavingsOffer[] {
    const offers: SavingsOffer[] = [];
    const accountName = "Cuenta de Ahorro Clásica";
    const accountType = SavingsAccountType.STANDARD;

    const rows = table.find("tbody tr");

    rows.each((_: number, rowEl: unknown) => {
      const row = $(rowEl);
      const cells = row.find("td");

      if (cells.length < 3) return;

      const firstCell = $(cells[0]).text().trim();
      const lastCell = $(cells[cells.length - 1])
        .text()
        .trim();

      // Skip non-rate rows
      if (!lastCell.includes("E.A.")) return;
      // Skip header rows
      if (firstCell.toLowerCase().includes("concepto")) return;
      if (firstCell.toLowerCase().includes("cuota de manejo")) return;

      try {
        const eaPercent = parseColombianPercent(lastCell);

        const offer: SavingsOffer = {
          id: generateSavingsOfferId({
            bank_id: this.bankId,
            account_type: accountType,
            account_name: accountName,
            ea_percent: eaPercent,
            min_amount_cop: 1,
          }),
          bank_id: this.bankId,
          bank_name: BankNames[this.bankId],
          account_type: accountType,
          account_name: accountName,
          rate: { ea_percent: eaPercent },
          min_amount_cop: 1,
          source: {
            url: this.sourceUrl,
            source_type: SourceType.HTML,
            document_label: "Cuenta de Ahorro",
            retrieved_at: retrievedAt,
            extracted_text_fingerprint: rawTextHash,
            extraction: {
              method: ExtractionMethod.CSS_SELECTOR,
              locator: "table:nth-of-type(2) tbody tr",
              excerpt: `${firstCell}: ${lastCell}`,
            },
          },
        };

        offers.push(offer);
      } catch {
        // Skip rows we can't parse
      }
    });

    return offers;
  }

  /**
   * Parses amount range text like:
   * - "$1 - $10.000.000" -> { min: 1, max: 10000000 }
   * - "$10.000.001 -$30.000.000" -> { min: 10000001, max: 30000000 }
   * - "+ $30.000.001 en adelante" -> { min: 30000001, max: undefined }
   * - "Aplica para todos los montos desde $ 1" -> { min: 1, max: undefined }
   */
  private parseAmountRange(text: string): RateTier {
    // Case: "en adelante" (unlimited upper bound)
    if (text.includes("en adelante") || text.includes("adelante")) {
      const match = text.match(/\$?\s*([\d.]+)/);
      if (match) {
        return {
          min_amount: parseColombianAmount(match[1]),
          max_amount: undefined,
          ea_percent: 0, // Will be set by caller
        };
      }
    }

    // Case: "Aplica para todos los montos desde $ X"
    if (text.includes("todos los montos") || text.includes("desde")) {
      const match = text.match(/\$\s*([\d.]+)/);
      if (match) {
        return {
          min_amount: parseColombianAmount(match[1]),
          max_amount: undefined,
          ea_percent: 0,
        };
      }
    }

    // Case: Range like "$1 - $10.000.000"
    const rangeMatch = text.match(/\$?\s*([\d.]+)\s*-\s*\$?\s*([\d.]+)/);
    if (rangeMatch) {
      return {
        min_amount: parseColombianAmount(rangeMatch[1]),
        max_amount: parseColombianAmount(rangeMatch[2]),
        ea_percent: 0,
      };
    }

    throw new Error(`Failed to parse amount range: "${text}"`);
  }
}
