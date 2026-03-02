import { readFile } from "fs/promises";
import {
  BankId,
  BankNames,
  SavingsAccountType,
  ExtractionMethod,
  type SavingsOffer,
  type BankSavingsParseResult,
  type ScrappedSavingsSource,
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
 * PDF structure (current as of March 2025):
 * "Alcancía - Tasa Básica (2)   0.05%   -   -"
 * "Alcancía - Tasa Premio (1)   8.75%   1   40,000,000"
 * "0.05%   40,000,001   -"
 *
 * Updated March 2026:
 * "Alcancía - Tasa Básica (2)   0.05%   -   -"
 * "Alcancía - Tasa Premio (1)   8.75%   1   40,000,000"
 * "0.05%   40,000,001   -"
 *
 * Pattern breakdown:
 * - Tasa Básica: 0.05% (applies when withdrawals made)
 * - Tasa Premio: 8.75% (1-40M), 0.05% (40M+) - applies when no withdrawals
 */
function parseAlcanciaRates(text: string): AccountData[] {
  const accounts: AccountData[] = [];

  // Verify we have the right document - look for "Alcancía" (may or may not have "Cuenta" prefix)
  if (!/Alcanc[ií]a/i.test(text)) {
    throw new Error("Could not find 'Alcancía' in PDF - document structure may have changed");
  }

  // Extract all rate-amount patterns from the text
  // Pattern: RATE% MONTO_MIN MONTO_MAX (or -)
  // e.g., "0.05% 1 40,000,000" or "8.75% 1 40,000,000" or "0.05% - -"
  const ratePattern = /(\d+\.\d+)%\s+((?:\d+(?:,\d+)*)|(?:-))\s+((?:\d+(?:,\d+)*)|(?:-))/g;
  const matches: Array<{ rate: number; min: number | null; max: number | undefined }> = [];

  let match;
  while ((match = ratePattern.exec(text)) !== null) {
    const rate = parseFloat(match[1]);
    const minStr = match[2];
    const maxStr = match[3];

    matches.push({
      rate,
      min: minStr === "-" ? null : parseInt(minStr.replace(/,/g, ""), 10),
      max: maxStr === "-" ? undefined : parseInt(maxStr.replace(/,/g, ""), 10),
    });
  }

  // Determine which format we're dealing with based on matches found
  // New format has:
  // - Tasa Básica: 0.05% - -
  // - Tasa Premio tier 1: 8.75% 1 40,000,000
  // - Tasa Premio tier 2: 0.05% 40,000,001 -

  // Filter out the Tasa Básica entry (min is null)
  const tasaBasica = matches.find((m) => m.min === null);
  const premioMatches = matches.filter((m) => m.min !== null);

  if (!tasaBasica && premioMatches.length === 0) {
    throw new Error(
      `Could not parse rate structure. Found ${matches.length} matches but no recognizable pattern - PDF structure may have changed`
    );
  }

  // Standard account (Tasa Básica - applies when withdrawals made)
  if (tasaBasica) {
    accounts.push({
      name: "Cuenta Alcancía Digital",
      type: SavingsAccountType.DIGITAL,
      tiers: [
        {
          min_amount: 1,
          max_amount: undefined, // No max for basic rate
          ea_percent: tasaBasica.rate,
        },
      ],
    });
  }

  // Premium account (Tasa Premio - applies when no withdrawals)
  if (premioMatches.length >= 1) {
    const tiers: RateTier[] = premioMatches.map((m) => ({
      min_amount: m.min || 1,
      max_amount: m.max,
      ea_percent: m.rate,
    }));

    accounts.push({
      name: "Cuenta Alcancía Digital (Tasa Premio)",
      type: SavingsAccountType.HIGH_YIELD,
      tiers,
      note: "La tasa premio aplica siempre que el cliente no realice retiros durante el mes",
    });
  }

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
            kind: "scrapped",
            url: this.sourceUrl,
            source_type: "PDF",
            document_label: "Tasas Cuenta Alcancía",
            retrieved_at: retrievedAt,
            extracted_text_fingerprint: rawTextHash,
            extraction: {
              method: ExtractionMethod.REGEX,
              locator: `caja_social_${account.name.toLowerCase().replace(/\s+/g, "_").replace(/[()]/g, "")}`,
              excerpt: `${account.name}: ${tier.ea_percent}% E.A.`,
            },
          } satisfies ScrappedSavingsSource,
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
