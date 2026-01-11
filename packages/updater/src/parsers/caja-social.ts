import { BankId, type BankParseResult } from "@mejor-tasa/core";
import { fetchWithRetry, sha256 } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

const SOURCE_URL =
  "https://www.bancocajasocial.com/content/dam/bcs/documentos/informacion-corporativa/tasas-precios-y-comisiones/credito-vivienda/Tasas-Credito-Vivienda.pdf";

export class CajaSocialParser implements BankParser {
  bankId = BankId.BANCO_CAJA_SOCIAL;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];

    const result = await fetchWithRetry(this.sourceUrl);
    const pdfBuffer = result.content;
    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // TODO: Implement PDF parsing
    // Extract "Vigentes a partir del" date
    // Parse VIS/NO VIS rows with COP and UVR rates

    warnings.push("Caja Social parser not yet implemented - needs PDF text extraction");

    return {
      bank_id: this.bankId,
      offers: [],
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
