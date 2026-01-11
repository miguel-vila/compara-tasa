import { BankId, type BankParseResult } from "@mejor-tasa/core";
import { fetchWithRetry, sha256 } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

const SOURCE_URL =
  "https://www.bbva.com.co/content/dam/public-web/colombia/documents/home/prefooter/tarifas/DO-11-TASAS-VIVIENDA.pdf";

export class BbvaParser implements BankParser {
  bankId = BankId.BBVA;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];

    // Fetch PDF
    const result = await fetchWithRetry(this.sourceUrl);
    const pdfBuffer = result.content;
    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // TODO: Implement PDF parsing with pdfjs-dist
    // The spec indicates we should extract:
    // - Crédito Hipotecario VIS/NO VIS in Pesos and UVR
    // - Leasing Habitacional rates
    // - Payroll benefit: +200bps for non-payroll (VIS), +250bps for non-payroll (NO VIS)

    warnings.push("BBVA parser not yet implemented - needs PDF text extraction");

    return {
      bank_id: this.bankId,
      offers: [],
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
