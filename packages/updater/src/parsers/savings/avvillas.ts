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
import {
  fetchWithRetry,
  sha256,
  generateSavingsOfferId,
  parseColombianNumber,
} from "../../utils/index.js";
import type { BankSavingsParser, SavingsParserConfig } from "./types.js";

const SOURCE_URL =
  "https://www.avvillas.com.co/documents/2920580/43165594/TASAS+AHORROS+Y+BOLSILLOS+CON+RENTABILIDAD+INTRANET+(1).pdf/eef5b4a3-dc4b-1f27-ea9d-db3a989ea862";

type RateTier = {
  min_amount: number;
  max_amount?: number;
  ea_percent: number;
};

type AccountData = {
  name: string;
  type: SavingsAccountType;
  tiers: RateTier[];
};

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

/**
 * Parses Colombian amount like "5.000.000" or "50.000.000"
 */
function parseAmount(text: string): number {
  const cleaned = text.replace(/[$\s]/g, "").replace(/\./g, "");
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) {
    throw new Error(`Failed to parse amount: "${text}"`);
  }
  return num;
}

/**
 * Parses rate like "0,50" or "9,00" to number
 */
function parseRate(text: string): number {
  return parseColombianNumber(text);
}

/**
 * Extracts tiered rates from the Cuenta Premium Tasa Diaria table on page 2
 * PDF text format on page 2:
 * Rango Saldo en la cuenta   Tasa E.A. $0 $5.000.000   0,50% E.A. $5.000.001 $20.000.000   3,00% E.A. ...
 */
function parseCuentaPremium(text: string): RateTier[] {
  const tiers: RateTier[] = [];

  // Find the Cuenta Premium rates section on page 2
  // Pattern: "Rango Saldo en la cuenta   Tasa E.A. $0 $5.000.000 ..."
  const sectionMatch = text.match(
    /Rango Saldo en la cuenta\s+Tasa E\.A\.\s+([\s\S]*?)(?:Monto\s+0 a 30|Plazo de permanencia)/i
  );
  if (!sectionMatch) return tiers;

  const section = sectionMatch[1];

  // Parse tiered ranges: $MIN $MAX RATE% E.A.
  // Pattern for ranges like "$0 $5.000.000 0,50% E.A."
  const tierPattern = /\$(\d+(?:\.\d{3})*)\s+\$(\d+(?:\.\d{3})*)\s+(\d+[,]\d+)%\s+E\.A\.?/g;
  let match;
  while ((match = tierPattern.exec(section)) !== null) {
    tiers.push({
      min_amount: parseAmount(match[1]),
      max_amount: parseAmount(match[2]),
      ea_percent: parseRate(match[3]),
    });
  }

  // Parse "Mayor a" for unlimited upper bound
  const mayorMatch = section.match(/Mayor\s+a\s+\$(\d+(?:\.\d{3})*)\s+(\d+[,]\d+)%\s+E\.A\.?/i);
  if (mayorMatch) {
    tiers.push({
      min_amount: parseAmount(mayorMatch[1]) + 1,
      max_amount: undefined,
      ea_percent: parseRate(mayorMatch[2]),
    });
  }

  return tiers;
}

/**
 * Extracts tiered rates from Bolsillos con Rentabilidad section (second table on page 2)
 * This is the highest-yielding savings product
 * PDF text format in table on page 2 (5 columns: 0-30, 31-90, 91-180, 181-365, >365):
 * Menor a $500.000   0,00%   0,50%   0,50%   0,50%   0,50%
 * De $500.000 a $5.000.000   0,00%   2,00%   2,25%   2,50%   3,25%
 * ...
 * Mayor de $500.000.001   0,00%   9,55%   9,70%   9,85%   10,50%
 *
 * We extract the best rate (>365 days column) for each tier
 */
function parseBolsillosCuentaPremium(text: string): RateTier[] {
  const tiers: RateTier[] = [];

  // Find the bolsillos section - second table on page 2
  // Look for rows starting after "0 a 30 días" header
  const sectionMatch = text.match(
    /Monto\s+0 a 30 días\s+31 a 90 días\s+91 a 180 días\s+181 a 365 días\s+> 365\s+([\s\S]*?)Plazo de permanencia del Bolsillo/i
  );
  if (!sectionMatch) return tiers;

  const section = sectionMatch[1];

  // Parse "Menor a $500.000" row - 5 rate columns, we want the last (>365 days)
  const menorMatch = section.match(
    /Menor a \$(\d+(?:\.\d{3})*)\s+[\d,]+%\s+[\d,]+%\s+[\d,]+%\s+[\d,]+%\s+([\d,]+)%/i
  );
  if (menorMatch) {
    tiers.push({
      min_amount: 1,
      max_amount: parseAmount(menorMatch[1]) - 1,
      ea_percent: parseRate(menorMatch[2]),
    });
  }

  // Parse "De $X a $Y" rows - 5 rate columns, we want the last (>365 days)
  const rangePattern =
    /De \$(\d+(?:\.\d{3})*) a \$(\d+(?:\.\d{3})*)\s+[\d,]+%\s+[\d,]+%\s+[\d,]+%\s+[\d,]+%\s+([\d,]+)%/g;
  let match;
  while ((match = rangePattern.exec(section)) !== null) {
    tiers.push({
      min_amount: parseAmount(match[1]),
      max_amount: parseAmount(match[2]),
      ea_percent: parseRate(match[3]),
    });
  }

  // Parse "Mayor de $X" row - 5 rate columns, we want the last (>365 days)
  const mayorMatch = section.match(
    /Mayor de \$(\d+(?:\.\d{3})*)\s+[\d,]+%\s+[\d,]+%\s+[\d,]+%\s+[\d,]+%\s+([\d,]+)%/i
  );
  if (mayorMatch) {
    tiers.push({
      min_amount: parseAmount(mayorMatch[1]) + 1,
      max_amount: undefined,
      ea_percent: parseRate(mayorMatch[2]),
    });
  }

  return tiers;
}

/**
 * Extracts tiered rates from RentaVillas section on page 1
 * PDF text format:
 * Tasa E.A.  $0   $ 5.000.000   0,50% E.A. $ 5.000.001   $ 20.000.000   0,75% E.A. ...
 */
function parseRentaVillas(text: string): RateTier[] {
  const tiers: RateTier[] = [];

  // Find the RENTAVILLAS section - it's the first rates table on page 1
  // Between the header and CERTIVILLAS section
  const sectionMatch = text.match(
    /TASAS CUENTAS DE AHORRO\s+Tasa E\.A\.\s+([\s\S]*?)(?:\$0\s+\$\s*500\.000\s+0,00%)/i
  );
  if (!sectionMatch) return tiers;

  const section = sectionMatch[1];

  // Parse tiered ranges: $MIN $ MAX RATE% E.A.
  // Pattern for "$0   $ 5.000.000   0,50% E.A."
  const tierPattern = /\$\s*(\d+(?:\.\d{3})*)\s+\$\s*(\d+(?:\.\d{3})*)\s+(\d+[,]\d+)%\s+E\.A\./g;
  let match;
  while ((match = tierPattern.exec(section)) !== null) {
    tiers.push({
      min_amount: parseAmount(match[1]),
      max_amount: parseAmount(match[2]),
      ea_percent: parseRate(match[3]),
    });
  }

  // Parse "Mayor a" for unlimited upper bound
  const mayorMatch = section.match(/Mayor\s+a\s+\$\s*(\d+(?:\.\d{3})*)\s+(\d+[,]\d+)%\s+E\.A\./i);
  if (mayorMatch) {
    tiers.push({
      min_amount: parseAmount(mayorMatch[1]) + 1,
      max_amount: undefined,
      ea_percent: parseRate(mayorMatch[2]),
    });
  }

  return tiers;
}

// Note: AFC rates are not separately disclosed in the PDF - they reference the same structure as CERTIVILLAS

export class AvvillasParser implements BankSavingsParser {
  bankId = BankId.AVVILLAS;
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

    // Verify we're reading the right document
    if (!/TASAS CUENTAS DE AHORRO/i.test(fullText)) {
      throw new Error(
        "Could not find 'TASAS CUENTAS DE AHORRO' header - PDF structure may have changed"
      );
    }

    const accounts: AccountData[] = [];

    // 1. Bolsillos con Rentabilidad (Cuenta Premium) - highest yield, main product for consumers
    const bolsillosTiers = parseBolsillosCuentaPremium(fullText);
    if (bolsillosTiers.length > 0) {
      accounts.push({
        name: "Bolsillos con Rentabilidad (Cuenta Premium)",
        type: SavingsAccountType.HIGH_YIELD,
        tiers: bolsillosTiers,
      });
    } else {
      warnings.push("Could not parse Bolsillos con Rentabilidad tiers");
    }

    // 2. Cuenta Premium (high yield) - for users without bolsillos
    const premiumTiers = parseCuentaPremium(fullText);
    if (premiumTiers.length > 0) {
      accounts.push({
        name: "Cuenta Premium",
        type: SavingsAccountType.HIGH_YIELD,
        tiers: premiumTiers,
      });
    } else {
      warnings.push("Could not parse Cuenta Premium tiers");
    }

    // 3. RentaVillas (standard savings)
    const rentavillasTiers = parseRentaVillas(fullText);
    if (rentavillasTiers.length > 0) {
      accounts.push({
        name: "RentaVillas",
        type: SavingsAccountType.STANDARD,
        tiers: rentavillasTiers,
      });
    }

    // Note: AFC rates are not separately disclosed in this PDF - they reference CERTIVILLAS structure

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
            document_label: "Tasas Cuentas de Ahorro y Bolsillos",
            retrieved_at: retrievedAt,
            extracted_text_fingerprint: rawTextHash,
            extraction: {
              method: ExtractionMethod.REGEX,
              locator: `avvillas_${account.name.toLowerCase().replace(/\s+/g, "_").replace(/[()]/g, "")}`,
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

    // Check for expected main products
    const bolsillosOffers = offers.filter((o) =>
      o.account_name.includes("Bolsillos con Rentabilidad")
    );
    if (bolsillosOffers.length < 5) {
      warnings.push(
        `Expected at least 5 Bolsillos con Rentabilidad tiers, got ${bolsillosOffers.length}`
      );
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
