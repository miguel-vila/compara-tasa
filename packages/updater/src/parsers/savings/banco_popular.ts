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

const SOURCE_URL =
  "https://www.bancopopular.com.co/wps/portal/bancopopular/inicio/informacion-interes/tasas";

type RateTier = {
  min_amount: number;
  max_amount?: number;
  ea_percent: number;
};

type AccountData = {
  name: string;
  type: SavingsAccountType;
  tiers: RateTier[];
};

/**
 * Parses Colombian amount like "$10.000.000" or "10.000.000"
 */
function parseColombianAmount(text: string): number {
  const cleaned = text.replace(/[$\s]/g, "").replace(/\./g, "");
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) {
    throw new Error(`Failed to parse amount: "${text}"`);
  }
  return num;
}

/**
 * Parses Colombian percentage format (e.g., "9,00%" or "1,50%")
 */
function parseColombianPercent(text: string): number {
  // Handle both comma and dot decimal separators
  const match = text.match(/(\d+)[,.](\d+)\s*%/);
  if (match) {
    return parseFloat(`${match[1]}.${match[2]}`);
  }
  // Handle whole numbers like "9%"
  const wholeMatch = text.match(/(\d+)\s*%/);
  if (wholeMatch) {
    return parseFloat(wholeMatch[1]);
  }
  throw new Error(`Failed to parse percentage: "${text}"`);
}

/**
 * Parses amount range text like:
 * - "De $0 a $10.000.000" -> { min: 0, max: 10000000 }
 * - "De $10.000.001 a $50.000.000" -> { min: 10000001, max: 50000000 }
 * - "De $150.000.001 en adelante" -> { min: 150000001, max: undefined }
 */
function parseAmountRange(text: string): { min: number; max?: number } {
  // Case: "en adelante" (unlimited upper bound)
  if (text.includes("en adelante")) {
    const match = text.match(/\$\s*([\d.]+)/);
    if (match) {
      return {
        min: parseColombianAmount(match[1]),
        max: undefined,
      };
    }
  }

  // Case: Range like "De $0 a $10.000.000"
  const rangeMatch = text.match(/\$\s*([\d.]+)\s*a\s*\$\s*([\d.]+)/);
  if (rangeMatch) {
    return {
      min: parseColombianAmount(rangeMatch[1]),
      max: parseColombianAmount(rangeMatch[2]),
    };
  }

  throw new Error(`Failed to parse amount range: "${text}"`);
}

export class BancoPopularParser implements BankSavingsParser {
  bankId = BankId.BANCO_POPULAR;
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
    const $ = cheerio.load(html);

    // Verify we're on the right page
    if (!$("title").text().includes("Tasas")) {
      throw new Error("Could not find Tasas page - page structure may have changed");
    }

    const accounts: AccountData[] = [];

    // 1. Parse "Cuenta para Ahorrar (Persona Natural)" - tiered rates
    const cuentaAhorrarTiers = this.parseCuentaParaAhorrar($);
    if (cuentaAhorrarTiers.length > 0) {
      accounts.push({
        name: "Cuenta para Ahorrar",
        type: SavingsAccountType.STANDARD,
        tiers: cuentaAhorrarTiers,
      });
    } else {
      warnings.push("Could not parse Cuenta para Ahorrar tiers");
    }

    // 2. Parse "Cuenta Ahorro Cuenta Plateada" - high yield account
    const cuentaPlateadaTiers = this.parseCuentaPlateada($);
    if (cuentaPlateadaTiers.length > 0) {
      accounts.push({
        name: "Cuenta Ahorro Cuenta Plateada",
        type: SavingsAccountType.HIGH_YIELD,
        tiers: cuentaPlateadaTiers,
      });
    } else {
      warnings.push("Could not parse Cuenta Plateada tiers");
    }

    // Create offers from all accounts
    for (const account of accounts) {
      for (const tier of account.tiers) {
        const offer: SavingsOffer = {
          id: generateSavingsOfferId({
            bank_id: this.bankId,
            account_type: account.type,
            account_name: account.name,
            ea_percent: tier.ea_percent,
            min_amount_cop: tier.min_amount,
          }),
          bank_id: this.bankId,
          bank_name: BankNames[this.bankId],
          account_type: account.type,
          account_name: account.name,
          rate: { ea_percent: tier.ea_percent },
          min_amount_cop: tier.min_amount,
          max_amount_cop: tier.max_amount,
          source: {
            url: this.sourceUrl,
            source_type: SourceType.HTML,
            document_label: "Tasas de Captación y Colocación",
            retrieved_at: retrievedAt,
            extracted_text_fingerprint: rawTextHash,
            extraction: {
              method: ExtractionMethod.CSS_SELECTOR,
              locator: `article table.simple-table`,
              excerpt: `${account.name}: ${tier.ea_percent}% E.A.`,
            },
          },
        };

        offers.push(offer);
      }
    }

    // Validate we extracted something useful
    if (offers.length === 0) {
      throw new Error("No savings offers extracted - page structure may have changed");
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }

  /**
   * Parses "Cuenta para Ahorrar (Persona Natural)" table
   * Located in article#table-rates-ahorro-puro
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseCuentaParaAhorrar($: any): RateTier[] {
    const tiers: RateTier[] = [];

    // Find the article containing "Cuenta para Ahorrar (Persona Natural)"
    const article = $("article").filter((_: number, el: unknown) => {
      const text = $(el).find("h4 em").text();
      return text.includes("Cuenta para Ahorrar") && text.includes("Persona Natural");
    });

    if (article.length === 0) return tiers;

    const rows = article.find("table.simple-table tbody tr");

    rows.each((_: number, rowEl: unknown) => {
      const row = $(rowEl);
      const cells = row.find("td");

      if (cells.length < 2) return;

      const rangeText = $(cells[0]).text().trim();
      const rateText = $(cells[1]).text().trim();

      // Skip if not a rate row
      if (!rateText.includes("%")) return;

      try {
        const range = parseAmountRange(rangeText);
        const eaPercent = parseColombianPercent(rateText);

        tiers.push({
          min_amount: range.min,
          max_amount: range.max,
          ea_percent: eaPercent,
        });
      } catch {
        // Skip rows we can't parse
      }
    });

    return tiers;
  }

  /**
   * Parses "Cuenta Ahorro Cuenta Plateada" table
   * Located in article#table-rates-rentahorro (first one with this ID that matches Plateada)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseCuentaPlateada($: any): RateTier[] {
    const tiers: RateTier[] = [];

    // Find the article containing "Cuenta Ahorro Cuenta Plateada"
    const article = $("article").filter((_: number, el: unknown) => {
      const text = $(el).find("h4 em").text();
      return text.includes("Cuenta Plateada");
    });

    if (article.length === 0) return tiers;

    const rows = article.find("table.simple-table tbody tr");

    rows.each((_: number, rowEl: unknown) => {
      const row = $(rowEl);
      const cells = row.find("td");

      if (cells.length < 2) return;

      const rangeText = $(cells[0]).text().trim();
      const rateText = $(cells[1]).text().trim();

      // Skip if not a rate row
      if (!rateText.includes("%")) return;

      try {
        const range = parseAmountRange(rangeText);
        const eaPercent = parseColombianPercent(rateText);

        tiers.push({
          min_amount: range.min,
          max_amount: range.max,
          ea_percent: eaPercent,
        });
      } catch {
        // Skip rows we can't parse
      }
    });

    return tiers;
  }
}
