import * as cheerio from "cheerio";
import { BankId, type BankParseResult } from "@mejor-tasa/core";
import { fetchWithRetry, sha256 } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

const LANDING_URL = "https://www.avvillas.com.co/credito-hipotecario";

export class AvvillasParser implements BankParser {
  bankId = BankId.AVVILLAS;
  sourceUrl = LANDING_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];

    // Step 1: Fetch landing page to discover current PDF URL
    const landingResult = await fetchWithRetry(LANDING_URL);
    const html = landingResult.content.toString("utf-8");
    const $ = cheerio.load(html);

    // TODO: Find the PDF link dynamically
    // The PDF URL changes with each update (has a timestamp query param)
    // Look for links containing "Tasas" and ".pdf"

    // Step 2: Fetch and parse the PDF
    // TODO: Implement PDF parsing for:
    // - "Créditos Hipotecarios" section (VIS/NO VIS, UVR/COP)
    // - "Créditos Hipotecarios-Digital" section (channel=DIGITAL)

    warnings.push("AV Villas parser not yet implemented - needs PDF link discovery and parsing");

    return {
      bank_id: this.bankId,
      offers: [],
      warnings,
      raw_text_hash: sha256(html),
    };
  }
}
