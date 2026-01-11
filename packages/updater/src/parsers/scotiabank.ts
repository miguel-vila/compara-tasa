import { BankId, type BankParseResult } from "@mejor-tasa/core";
import { fetchWithRetry, sha256 } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

const SOURCE_URL =
  "https://cdn.aglty.io/scotiabank-colombia/scotiabank-colpatria/pdf/tasas-y-tarifas/Tasas-y-productos-credito.pdf";

export class ScotiabankParser implements BankParser {
  bankId = BankId.SCOTIABANK_COLPATRIA;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];

    const result = await fetchWithRetry(this.sourceUrl);
    const pdfBuffer = result.content;
    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // TODO: Implement PDF parsing
    // Look for "Hipotecario y leasing habitacional" section
    // Extract VIS/NO VIS rates in UVR and Pesos

    warnings.push("Scotiabank parser not yet implemented - needs PDF text extraction");

    return {
      bank_id: this.bankId,
      offers: [],
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
