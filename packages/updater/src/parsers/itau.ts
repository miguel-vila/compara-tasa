import { BankId, type BankParseResult } from "@mejor-tasa/core";
import { fetchWithRetry, sha256 } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

// Note: This URL pattern may need updating - check for latest
const SOURCE_URL = "https://banco.itau.co/documents/d/personas/tasas-vigentes-pn-color-01-dic-2025";

export class ItauParser implements BankParser {
  bankId = BankId.ITAU;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];

    const result = await fetchWithRetry(this.sourceUrl);
    const pdfBuffer = result.content;
    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // TODO: Implement PDF parsing
    // Extract from "Crédito hipotecario" and "Leasing habitacional" sections
    // Note: Itaú doesn't always specify VIS/NO VIS explicitly

    warnings.push("Itaú parser not yet implemented - needs PDF text extraction");

    return {
      bank_id: this.bankId,
      offers: [],
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
