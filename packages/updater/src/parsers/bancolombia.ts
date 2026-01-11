import * as cheerio from "cheerio";
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
} from "@mejor-tasa/core";
import {
  fetchWithRetry,
  sha256,
  generateOfferId,
  parseColombianNumber,
  parseUvrSpread,
} from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

const SOURCE_URL =
  "https://www.bancolombia.com/personas/creditos/vivienda/credito-hipotecario-para-comprar-vivienda";

export class BancolombiaParser implements BankParser {
  bankId = BankId.BANCOLOMBIA;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];
    const offers: Offer[] = [];

    // Fetch HTML
    const result = await fetchWithRetry(this.sourceUrl);
    const html = result.content.toString("utf-8");
    const rawTextHash = sha256(html);
    const retrievedAt = new Date().toISOString();

    const $ = cheerio.load(html);

    // TODO: Implement actual parsing logic based on the spec
    // This is a stub that needs to be completed with actual selectors
    // once we have a fixture of the HTML structure

    // The spec indicates we should look for:
    // - "Tasas para vivienda en UVR" section (VIS: UVR + 6.50%, No VIS: UVR + 8.00%)
    // - "Tasas para vivienda en pesos" section (VIS: 12.00% E.A., No VIS: 12.00% E.A.)
    // - Payroll discount: 100 bps off

    warnings.push("Bancolombia parser not yet implemented - needs HTML fixture analysis");

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
