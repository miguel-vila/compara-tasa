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
  type BankParseResult,
} from "@compara-tasa/core";
import { fetchWithRetry, sha256, generateOfferId, parseColombianNumber } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

const SOURCE_URL =
  "https://www.bancopopular.com.co/wps/portal/bancopopular/inicio/informacion-interes/tasas";

const SELECTORS = {
  casayaSection: "#table-rates-casaya",
  rateTable: "table.simple-table",
} as const;

export class BancoPopularParser implements BankParser {
  bankId = BankId.BANCO_POPULAR;
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

    // Find the Casayá section (housing/mortgage rates)
    const casayaSection = $(SELECTORS.casayaSection);
    if (casayaSection.length === 0) {
      warnings.push("Could not find Casayá section (#table-rates-casaya)");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Find the rate table
    const table = casayaSection.find(SELECTORS.rateTable);
    if (table.length === 0) {
      warnings.push("Could not find rate table in Casayá section");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Parse table rows
    const rows = table.find("tbody tr");

    rows.each((_, rowEl) => {
      const row = $(rowEl);
      const cells = row.find("td");

      if (cells.length < 3) {
        return;
      }

      const productName = $(cells[0]).text().trim();
      const rate15yr = $(cells[1]).text().trim();
      const rate20yr = $(cells[2]).text().trim();

      // Determine product type from description
      let productType: ProductType;
      if (productName.toLowerCase().includes("leasing")) {
        productType = ProductType.LEASING;
      } else if (productName.toLowerCase().includes("hipotecario")) {
        productType = ProductType.HIPOTECARIO;
      } else {
        warnings.push(`Unknown product type: ${productName}`);
        return;
      }

      // Parse the rate (use 15-year rate as primary, as it's lower)
      let eaPercent: number;
      try {
        // Remove % and parse Colombian number format
        const rateStr = rate15yr.replace(/%/g, "").trim();
        eaPercent = parseColombianNumber(rateStr);
      } catch (e) {
        warnings.push(`Failed to parse rate "${rate15yr}" for ${productName}: ${e}`);
        return;
      }

      // Also parse 20-year rate for the range
      let eaPercentTo: number | undefined;
      try {
        const rate20yrStr = rate20yr.replace(/%/g, "").trim();
        eaPercentTo = parseColombianNumber(rate20yrStr);
      } catch {
        // 20-year rate is optional for the range
      }

      // Create the offer
      // Note: Banco Popular doesn't differentiate VIS/NO_VIS segments
      // Using UNKNOWN segment since no segmentation is provided
      const offer: Offer = {
        id: generateOfferId({
          bank_id: this.bankId,
          product_type: productType,
          currency_index: CurrencyIndex.COP,
          segment: Segment.UNKNOWN,
          channel: Channel.UNSPECIFIED,
          rate_from: eaPercent,
        }),
        bank_id: this.bankId,
        bank_name: BankNames[this.bankId],
        product_type: productType,
        currency_index: CurrencyIndex.COP,
        segment: Segment.UNKNOWN,
        channel: Channel.UNSPECIFIED,
        rate: {
          kind: "COP_FIXED",
          ea_percent_from: eaPercent,
          ea_percent_to: eaPercentTo,
        },
        conditions: {},
        source: {
          url: this.sourceUrl,
          source_type: SourceType.HTML,
          document_label: "Tasas y Tarifas - Casayá",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.CSS_SELECTOR,
            locator: `${SELECTORS.casayaSection} ${SELECTORS.rateTable}`,
            excerpt: `${productName}: ${rate15yr} - ${rate20yr}`,
          },
        },
      };

      offers.push(offer);
    });

    // Validate we got the expected offers
    if (offers.length === 0) {
      warnings.push("No offers extracted - page structure may have changed");
    } else if (offers.length < 2) {
      warnings.push(`Only extracted ${offers.length} offers, expected 2 (Hipotecario + Leasing)`);
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
