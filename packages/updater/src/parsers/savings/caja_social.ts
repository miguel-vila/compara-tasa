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

const SOURCE_URL =
  "https://www.bancocajasocial.com/content/dam/bcs/documentos/informacion-corporativa/tasas-precios-y-comisiones/cuentas-bancarias/Tasas-Cuenta-Alcancia.pdf";

/**
 * Extracts text content from a PDF buffer using pdfjs-dist
 */
async function extractPdfText(pdfBuffer: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const pdf = await pdfjs.getDocument({ data: pdfBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(text);
  }

  return pages;
}

type RateTier = {
  min_amount: number;
  max_amount?: number;
  ea_percent: number;
};

type AccountData = {
  name: string;
  type: SavingsAccountType;
  tiers: RateTier[];
  note?: string;
};

/**
 * Parses rates from the PDF text.
 *
 * PDF structure (extracted text):
 * "Cuenta Alcancía (1) 10-mar-2025 Cuenta Alcancía - Tasa Premio (1) (2)"
 *
 * The rates appear before the account labels in this pattern:
 * "Tasa EA Monto mínimo Monto máximo ... 0.05% 1 40,000,000 0.05% 40,000,001 - 8.00% 1 40,000,000 0.05% 40,000,001 -"
 *
 * Pattern breakdown:
 * - Cuenta Alcancía: 0.05% (1-40M), 0.05% (40M+)
 * - Cuenta Alcancía Tasa Premio: 8.00% (1-40M), 0.05% (40M+) - applies when no withdrawals
 */
function parseAlcanciaRates(text: string): AccountData[] {
  const accounts: AccountData[] = [];

  // Verify we have the right document
  if (!/Cuenta\s+Alcanc[ií]a/i.test(text)) {
    throw new Error("Could not find 'Cuenta Alcancía' header - PDF structure may have changed");
  }

  // Extract all rate-amount patterns from the text
  // Pattern: RATE% MONTO_MIN MONTO_MAX (or -)
  // e.g., "0.05% 1 40,000,000" or "8.00% 1 40,000,000"
  const ratePattern = /(\d+\.\d+)%\s+(\d+(?:,\d+)*)\s+((?:\d+(?:,\d+)*)|(?:-))/g;
  const matches: Array<{ rate: number; min: number; max?: number }> = [];

  let match;
  while ((match = ratePattern.exec(text)) !== null) {
    const rate = parseFloat(match[1]);
    const minStr = match[2].replace(/,/g, "");
    const maxStr = match[3];

    matches.push({
      rate,
      min: parseInt(minStr, 10),
      max: maxStr === "-" ? undefined : parseInt(maxStr.replace(/,/g, ""), 10),
    });
  }

  // We expect 4 rate entries based on the PDF structure:
  // 1. Cuenta Alcancía: 0.05% (1-40M)
  // 2. Cuenta Alcancía: 0.05% (40M+)
  // 3. Cuenta Alcancía Tasa Premio: 8.00% (1-40M)
  // 4. Cuenta Alcancía Tasa Premio: 0.05% (40M+)
  if (matches.length < 4) {
    throw new Error(
      `Expected at least 4 rate entries, got ${matches.length} - PDF structure may have changed`
    );
  }

  // First two entries are for Cuenta Alcancía (standard)
  accounts.push({
    name: "Cuenta Alcancía Digital",
    type: SavingsAccountType.DIGITAL,
    tiers: [
      {
        min_amount: matches[0].min,
        max_amount: matches[0].max,
        ea_percent: matches[0].rate,
      },
      {
        min_amount: matches[1].min,
        max_amount: matches[1].max,
        ea_percent: matches[1].rate,
      },
    ],
  });

  // Second two entries are for Cuenta Alcancía Tasa Premio (no withdrawals bonus)
  accounts.push({
    name: "Cuenta Alcancía Digital (Tasa Premio)",
    type: SavingsAccountType.HIGH_YIELD,
    tiers: [
      {
        min_amount: matches[2].min,
        max_amount: matches[2].max,
        ea_percent: matches[2].rate,
      },
      {
        min_amount: matches[3].min,
        max_amount: matches[3].max,
        ea_percent: matches[3].rate,
      },
    ],
    note: "La tasa premio aplica siempre que no se hayan realizado retiros durante el mes anterior",
  });

  return accounts;
}

export class CajaSocialParser implements BankSavingsParser {
  bankId = BankId.BANCO_CAJA_SOCIAL;
  sourceUrl = SOURCE_URL;

  constructor(private config: SavingsParserConfig = {}) {}

  async parse(): Promise<BankSavingsParseResult> {
    const warnings: string[] = [];
    const offers: SavingsOffer[] = [];
    const retrievedAt = new Date().toISOString();

    // Fetch PDF (from fixture or live)
    let pdfBuffer: Buffer;
    if (this.config.useFixtures && this.config.fixturesPath) {
      pdfBuffer = await readFile(this.config.fixturesPath);
    } else {
      const result = await fetchWithRetry(this.sourceUrl);
      pdfBuffer = result.content;
    }

    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // Extract text from PDF
    const pdfData = new Uint8Array(pdfBuffer);
    const pageTexts = await extractPdfText(pdfData);
    const fullText = pageTexts.join(" ");

    // Parse the Alcancía account rates
    const accounts = parseAlcanciaRates(fullText);

    // Create offers from all accounts
    for (const account of accounts) {
      for (const tier of account.tiers) {
        const offer: SavingsOffer = {
          id: generateSavingsOfferId({
            bank_id: this.bankId,
            account_type: account.type,
            account_name: account.name,
            ea_percent: tier.ea_percent,
            min_amount_cop: tier.min_amount,
          }),
          bank_id: this.bankId,
          bank_name: BankNames[this.bankId],
          account_type: account.type,
          account_name: account.name,
          rate: { ea_percent: tier.ea_percent },
          min_amount_cop: tier.min_amount,
          max_amount_cop: tier.max_amount,
          source: {
            url: this.sourceUrl,
            source_type: SourceType.PDF,
            document_label: "Tasas Cuenta Alcancía",
            retrieved_at: retrievedAt,
            extracted_text_fingerprint: rawTextHash,
            extraction: {
              method: ExtractionMethod.REGEX,
              locator: `caja_social_${account.name.toLowerCase().replace(/\s+/g, "_").replace(/[()]/g, "")}`,
              excerpt: `${account.name}: ${tier.ea_percent}% E.A.`,
            },
          },
        };

        offers.push(offer);
      }
    }

    // Validate we extracted something useful
    if (offers.length === 0) {
      throw new Error("No savings offers extracted - PDF structure may have changed");
    }

    // Check we have the premium rate (8% as noted in the source)
    const premiumOffers = offers.filter((o) => o.account_name.includes("Tasa Premio"));
    const hasPremiumRate = premiumOffers.some((o) => o.rate.ea_percent >= 7.0);
    if (!hasPremiumRate) {
      warnings.push("Expected high-yield premium rate (8% E.A.) not found");
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
