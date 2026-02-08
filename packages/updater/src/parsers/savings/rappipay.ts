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

const SOURCE_URL = "https://www.rappipay.co/tasas-y-tarifas/";

/**
 * Parses percentage format (e.g., "9% E.A." -> 9, "0.1% E.A." -> 0.1)
 */
function parsePercent(text: string): number {
  // Try comma as decimal separator first
  const matchComma = text.match(/(\d+),(\d+)\s*%/);
  if (matchComma) {
    return parseFloat(`${matchComma[1]}.${matchComma[2]}`);
  }

  // Try period as decimal separator
  const matchDot = text.match(/(\d+)\.(\d+)\s*%/);
  if (matchDot) {
    return parseFloat(`${matchDot[1]}.${matchDot[2]}`);
  }

  // Try integer percentage
  const matchInt = text.match(/(\d+)\s*%/);
  if (matchInt) {
    return parseInt(matchInt[1], 10);
  }

  throw new Error(`Failed to parse percentage: "${text}"`);
}

type ExtractedRate = {
  accountName: string;
  accountType: SavingsAccountType;
  eaPercent: number;
  excerpt: string;
};

export class RappiPayParser implements BankSavingsParser {
  bankId = BankId.RAPPIPAY;
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

    // Find the "Personas" section which contains the savings account rates
    // The page has nested tabs: outer (Personas/Empresas) and inner (monthly tariffs)
    // We need to find the first table inside the Personas section
    // The structure is: outer active tab > inner active tab > table

    // Find the inner tabs content area within Personas section
    // The inner active tab has class "e-active" and contains the current month's rates
    const innerActiveTabs = $(".e-n-tabs-content [role='tabpanel'].e-active");

    if (innerActiveTabs.length === 0) {
      throw new Error("Could not find active tab content - page structure may have changed");
    }

    // The first inner active tab after the Personas section contains the RappiCuenta rates
    // Find the one that contains a table with savings rates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let table: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $any = $ as any;
    innerActiveTabs.each((_: number, tabEl: unknown) => {
      const tab = $any(tabEl);
      const tableInTab = tab.find("table").first();
      if (tableInTab.length > 0) {
        const tableText = tableInTab.text();
        if (tableText.includes("Rentabilidad") && tableText.includes("Bolsillos")) {
          table = tableInTab;
          return false; // break
        }
      }
    });

    if (!table || table.length === 0) {
      throw new Error("Could not find rate table - page structure may have changed");
    }

    // Parse rates from the table
    const extractedRates = this.parseRatesTable($, table);

    if (extractedRates.length === 0) {
      throw new Error("No rates extracted - page structure may have changed");
    }

    // Create offers from extracted rates
    for (const extracted of extractedRates) {
      const offer: SavingsOffer = {
        id: generateSavingsOfferId({
          bank_id: this.bankId,
          account_type: extracted.accountType,
          account_name: extracted.accountName,
          ea_percent: extracted.eaPercent,
          min_amount_cop: 1,
        }),
        bank_id: this.bankId,
        bank_name: BankNames[this.bankId],
        account_type: extracted.accountType,
        account_name: extracted.accountName,
        rate: { ea_percent: extracted.eaPercent },
        min_amount_cop: 1,
        source: {
          url: this.sourceUrl,
          source_type: SourceType.HTML,
          document_label: "Tasas y Tarifas",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.CSS_SELECTOR,
            locator: ".e-n-tabs-content .e-n-tab-content.e-active table",
            excerpt: extracted.excerpt,
          },
        },
      };

      offers.push(offer);
    }

    // Validate expected count
    // We expect at least 2 offers (Bolsillos and outside Bolsillos for either deposit or savings)
    if (offers.length < 2) {
      warnings.push(`Expected at least 2 offers, got ${offers.length}`);
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }

  /**
   * Parses rates from the RappiPay rates table.
   * Looks for:
   * - "Saldo en Bolsillos" (High Yield)
   * - "Saldo fuera de Bolsillos" (Standard)
   * For both "Depósito de Bajo Monto" and "Cuenta de ahorros"
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseRatesTable($: any, table: any): ExtractedRate[] {
    const rates: ExtractedRate[] = [];
    const rows = table.find("tbody tr");

    let currentSection = "";

    rows.each((_: number, rowEl: unknown) => {
      const row = $(rowEl);
      const cells = row.find("td");

      if (cells.length < 2) return;

      const firstCell = $(cells[0]).text().trim();
      const lastCell = $(cells[cells.length - 1])
        .text()
        .trim();

      // Detect section headers
      if (firstCell.includes("Rentabilidad efectiva anual")) {
        if (firstCell.includes("Depósito de Bajo Monto")) {
          currentSection = "deposito";
        } else if (firstCell.includes("Cuenta de ahorros")) {
          currentSection = "cuenta";
        }
        return;
      }

      // Skip rows without E.A. rate
      if (!lastCell.includes("E.A.")) return;

      // Skip Bóvedas (fixed-term deposits, not savings)
      if (firstCell.includes("Bóvedas")) return;

      try {
        const eaPercent = parsePercent(lastCell);

        // Determine account type and name based on content
        if (firstCell.includes("Bolsillos") && !firstCell.includes("fuera")) {
          // Saldo en Bolsillos - high yield
          const accountName =
            currentSection === "deposito"
              ? "Bolsillos (Depósito de Bajo Monto)"
              : "Bolsillos (Cuenta de Ahorros)";

          rates.push({
            accountName,
            accountType: SavingsAccountType.HIGH_YIELD,
            eaPercent,
            excerpt: `${firstCell}: ${lastCell}`,
          });
        } else if (firstCell.includes("fuera de Bolsillos")) {
          // Saldo fuera de Bolsillos - standard (lower) rate
          const accountName =
            currentSection === "deposito"
              ? "Saldo Principal (Depósito de Bajo Monto)"
              : "Saldo Principal (Cuenta de Ahorros)";

          rates.push({
            accountName,
            accountType: SavingsAccountType.STANDARD,
            eaPercent,
            excerpt: `${firstCell}: ${lastCell}`,
          });
        }
      } catch {
        // Skip rows we can't parse
      }
    });

    return rates;
  }
}
