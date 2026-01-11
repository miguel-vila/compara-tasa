import * as cheerio from "cheerio";
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

const SOURCE_URL = "https://www.fna.gov.co/sobre-el-fna/tasas";

// Income range mapping to segments
// VIS typically applies to lower income households, NO_VIS to higher income
// FNA uses 0-2 SMLV (best rates, likely VIS), 4+ SMLV (general rates, NO_VIS)
type IncomeRange = "0-2" | "2-4" | "4+";

type ParsedRate = {
  incomeRange: IncomeRange;
  rate: number;
};

type TableInfo = {
  fundingSource: "CESANTIAS" | "AVC";
  currencyIndex: CurrencyIndex;
  productType: ProductType;
  rates: ParsedRate[];
};

export class FnaParser implements BankParser {
  bankId = BankId.FNA;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];
    const offers: Offer[] = [];
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

    // Parse all rate tables
    const tables = this.parseAllTables($, warnings);

    // Create offers from parsed tables
    for (const table of tables) {
      // We'll create offers for the best rate (0-2 SMLV) mapped to VIS
      // and the most general rate (4+ SMLV) mapped to NO_VIS
      const visRate = table.rates.find((r) => r.incomeRange === "0-2");
      const noVisRate = table.rates.find((r) => r.incomeRange === "4+");

      for (const { segment, parsedRate, incomeNote } of [
        { segment: Segment.VIS, parsedRate: visRate, incomeNote: "0-2 SMLV income" },
        { segment: Segment.NO_VIS, parsedRate: noVisRate, incomeNote: "4+ SMLV income" },
      ]) {
        if (!parsedRate) continue;

        let rate: Rate;
        if (table.currencyIndex === CurrencyIndex.UVR) {
          rate = {
            kind: "UVR_SPREAD",
            spread_ea_from: parsedRate.rate,
          };
        } else {
          rate = {
            kind: "COP_FIXED",
            ea_percent_from: parsedRate.rate,
          };
        }

        const fundingSourceLabel = table.fundingSource === "CESANTIAS" ? "Cesantías" : "AVC";

        const offer: Offer = {
          id: generateOfferId({
            bank_id: this.bankId,
            product_type: table.productType,
            currency_index: table.currencyIndex,
            segment,
            channel: Channel.UNSPECIFIED,
            rate_from: parsedRate.rate,
          }),
          bank_id: this.bankId,
          bank_name: BankNames[this.bankId],
          product_type: table.productType,
          currency_index: table.currencyIndex,
          segment,
          channel: Channel.UNSPECIFIED,
          rate,
          conditions: {
            payroll_discount: {
              type: "BPS_OFF",
              value: 50,
              applies_to: "RATE",
              note: `Generación FNA: 50 bps off for applicants under 30. Funding: ${fundingSourceLabel}. Income range: ${incomeNote}`,
            },
          },
          source: {
            url: this.sourceUrl,
            source_type: SourceType.HTML,
            document_label: "Tasas FNA",
            retrieved_at: retrievedAt,
            extracted_text_fingerprint: rawTextHash,
            extraction: {
              method: ExtractionMethod.CSS_SELECTOR,
              locator: `table caption h3:contains("${fundingSourceLabel}")`,
              excerpt: `${table.productType} ${fundingSourceLabel} ${table.currencyIndex} ${segment}: ${parsedRate.rate}%`,
            },
          },
        };

        offers.push(offer);
      }
    }

    // Deduplicate offers by choosing the best rate for each segment/currency/product combo
    // Cesantías typically has better rates than AVC, so keep Cesantías offers
    const deduplicatedOffers = this.deduplicateOffers(offers);

    // Validate we got the expected offers
    if (deduplicatedOffers.length === 0) {
      warnings.push("No offers extracted - page structure may have changed");
    } else if (deduplicatedOffers.length < 4) {
      warnings.push(
        `Only extracted ${deduplicatedOffers.length} unique offers, expected at least 4`
      );
    }

    return {
      bank_id: this.bankId,
      offers: deduplicatedOffers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }

  private parseAllTables($: cheerio.CheerioAPI, warnings: string[]): TableInfo[] {
    const tables: TableInfo[] = [];

    // Find all rate tables with captions
    $("table.table-bordered").each((_, tableEl) => {
      const table = $(tableEl);
      const captionText = table.find("caption h3").text().trim();

      if (!captionText) return;

      // Determine funding source
      let fundingSource: "CESANTIAS" | "AVC" | null = null;
      if (captionText.includes("Cesantías") || captionText.includes("Cesantias")) {
        fundingSource = "CESANTIAS";
      } else if (captionText.includes("AVC")) {
        fundingSource = "AVC";
      }

      // Determine currency
      let currencyIndex: CurrencyIndex | null = null;
      if (captionText.includes("UVR")) {
        currencyIndex = CurrencyIndex.UVR;
      } else if (captionText.includes("Pesos") || captionText.includes("E.A")) {
        currencyIndex = CurrencyIndex.COP;
      }

      // Skip if we can't determine funding source or currency
      // (e.g., "Tasa única" for Compra de Cartera)
      if (!fundingSource || !currencyIndex) {
        return;
      }

      // Determine product type by looking at parent section
      let productType: ProductType = ProductType.HIPOTECARIO;
      const parentSection = table.parents(".contenedor-tasas").first();
      const sectionHeader = parentSection.prevAll("h2").first().text().trim();
      if (sectionHeader.includes("Leasing")) {
        productType = ProductType.LEASING;
      }

      // Parse rates from rows
      const rates: ParsedRate[] = [];
      table.find("tbody tr").each((_, rowEl) => {
        const row = $(rowEl);
        const cells = row.find("td");

        if (cells.length < 3) return;

        const fromCell = $(cells[0]).text().trim();
        const toCell = $(cells[1]).text().trim();
        const rateCell = $(cells[2]).text().trim();

        // Determine income range
        let incomeRange: IncomeRange | null = null;
        if (fromCell.includes("0") && toCell.includes("2")) {
          incomeRange = "0-2";
        } else if (fromCell.includes("2") && toCell.includes("4")) {
          incomeRange = "2-4";
        } else if (fromCell.includes("4")) {
          incomeRange = "4+";
        }

        if (!incomeRange) return;

        // Parse rate value
        try {
          // Handle UVR+ format and percentage format
          // Clean up the rate string: remove "UVR +", "%" and Unicode characters
          const cleanRate = rateCell
            .replace(/UVR\s*\+/i, "")
            .replace(/%/g, "")
            .replace(/\u200B/g, "") // zero-width space
            .replace(/\u200C/g, "") // zero-width non-joiner
            .replace(/\u200D/g, "") // zero-width joiner
            .replace(/\uFEFF/g, "") // byte order mark
            .trim();

          const rateValue = parseColombianNumber(cleanRate);
          rates.push({ incomeRange, rate: rateValue });
        } catch (e) {
          warnings.push(`Failed to parse rate "${rateCell}" in ${captionText}: ${e}`);
        }
      });

      if (rates.length > 0) {
        tables.push({
          fundingSource,
          currencyIndex,
          productType,
          rates,
        });
      }
    });

    return tables;
  }

  private deduplicateOffers(offers: Offer[]): Offer[] {
    // Group by product_type, currency_index, segment
    // Keep the offer with the best (lowest) rate
    const groups = new Map<string, Offer>();

    for (const offer of offers) {
      const key = `${offer.product_type}-${offer.currency_index}-${offer.segment}`;
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, offer);
        continue;
      }

      // Compare rates - keep the lower one
      const existingRate = this.getRateValue(existing.rate);
      const newRate = this.getRateValue(offer.rate);

      if (newRate < existingRate) {
        groups.set(key, offer);
      }
    }

    return Array.from(groups.values());
  }

  private getRateValue(rate: Rate): number {
    if (rate.kind === "UVR_SPREAD") {
      return rate.spread_ea_from;
    } else {
      return rate.ea_percent_from;
    }
  }
}
