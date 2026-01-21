import * as cheerio from "cheerio";
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
import {
  fetchWithRetry,
  sha256,
  generateOfferId,
  parseUvrSpread,
  parseEaPercent,
} from "../utils/index.js";
import type { BankMortgageParser, ParserConfig } from "./types.js";

const SOURCE_URL =
  "https://www.bancolombia.com/personas/creditos/vivienda/credito-hipotecario-para-comprar-vivienda";

// CSS selectors for rate extraction
const SELECTORS = {
  ratesSection: "#detalles-tasas-tarifas",
  ratesTables: ".contenido-tabla-detalles-tasas-tarifas table",
} as const;

type RateRow = {
  segment: Segment;
  eaValue: string;
  mvValue: string;
};

export class BancolombiaParser implements BankMortgageParser {
  bankId = BankId.BANCOLOMBIA;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankMortgageParseResult> {
    const warnings: string[] = [];
    const offers: MortgageOffer[] = [];
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

    // Find the rates section
    const ratesSection = $(SELECTORS.ratesSection);
    if (ratesSection.length === 0) {
      warnings.push("Could not find rates section (#detalles-tasas-tarifas)");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Find all h3 headers and their associated tables
    const h3Elements = ratesSection.find("h3");

    h3Elements.each((_, h3El) => {
      const h3 = $(h3El);
      const headerText = h3.text().trim();

      // Determine currency type from header
      let currencyIndex: CurrencyIndex | null = null;
      if (headerText.includes("UVR")) {
        currencyIndex = CurrencyIndex.UVR;
      } else if (headerText.includes("pesos")) {
        currencyIndex = CurrencyIndex.COP;
      }

      if (!currencyIndex) {
        return; // Skip non-rate headers
      }

      // Find the table following this h3
      // The table is inside a div.contenido-tabla-detalles-tasas-tarifas after the h3
      const table = h3.nextAll(".contenido-tabla-detalles-tasas-tarifas").first().find("table");
      if (table.length === 0) {
        warnings.push(`Could not find rate table for: ${headerText}`);
        return;
      }

      // Parse table rows (skip header row)
      const rows = table.find("tbody tr").slice(1);

      rows.each((_, rowEl) => {
        const row = $(rowEl);
        const cells = row.find("td");

        if (cells.length < 2) {
          return;
        }

        const descriptionCell = $(cells[0]).text().trim();
        const eaRateCell = $(cells[1]).text().trim();
        const mvRateCell = cells.length > 2 ? $(cells[2]).text().trim() : undefined;

        // Determine segment from description
        let segment: Segment = Segment.UNKNOWN;
        if (descriptionCell.includes("(VIS)") && !descriptionCell.includes("NO VIS")) {
          segment = Segment.VIS;
        } else if (descriptionCell.includes("NO VIS") || descriptionCell.includes("(NO VIS)")) {
          segment = Segment.NO_VIS;
        }

        // Parse the rate
        let rate: Rate;
        let rateFrom: number;

        try {
          if (currencyIndex === CurrencyIndex.UVR) {
            rateFrom = parseUvrSpread(eaRateCell);
            rate = {
              kind: "UVR_SPREAD",
              spread_ea_from: rateFrom,
              spread_mv_from: mvRateCell ? parseUvrSpread(mvRateCell) : undefined,
            };
          } else {
            rateFrom = parseEaPercent(eaRateCell);
            rate = {
              kind: "COP_FIXED",
              ea_percent_from: rateFrom,
              mv_percent_from: mvRateCell ? parseEaPercent(mvRateCell) : undefined,
            };
          }
        } catch (e) {
          warnings.push(
            `Failed to parse rate "${eaRateCell}" for ${segment} ${currencyIndex}: ${e}`
          );
          return;
        }

        // Create the offer
        const offer: MortgageOffer = {
          id: generateOfferId({
            bank_id: this.bankId,
            product_type: MortgageType.HIPOTECARIO,
            currency_index: currencyIndex,
            segment,
            channel: Channel.UNSPECIFIED,
            rate_from: rateFrom,
          }),
          bank_id: this.bankId,
          bank_name: BankNames[this.bankId],
          product_type: MortgageType.HIPOTECARIO,
          currency_index: currencyIndex,
          segment,
          channel: Channel.UNSPECIFIED,
          rate,
          conditions: {
            payroll_discount: {
              type: "PERCENT_OFF",
              value: 1.0,
              applies_to: "RATE",
              note: "Descuento para clientes que reciban su nómina con Bancolombia",
            },
          },
          source: {
            url: this.sourceUrl,
            source_type: SourceType.HTML,
            document_label: "Crédito hipotecario para comprar vivienda",
            retrieved_at: retrievedAt,
            extracted_text_fingerprint: rawTextHash,
            extraction: {
              method: ExtractionMethod.CSS_SELECTOR,
              locator: `${SELECTORS.ratesSection} h3:contains("${currencyIndex}") + table`,
              excerpt: `${segment}: ${eaRateCell}`,
            },
          },
        };

        offers.push(offer);
      });
    });

    // Validate we got the expected offers
    if (offers.length === 0) {
      warnings.push("No offers extracted - page structure may have changed");
    } else if (offers.length < 4) {
      warnings.push(`Only extracted ${offers.length} offers, expected 4 (VIS/NO_VIS × UVR/COP)`);
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
