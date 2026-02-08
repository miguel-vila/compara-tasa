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
import {
  fetchWithRetry,
  sha256,
  generateSavingsOfferId,
  parseColombianNumber,
} from "../../utils/index.js";
import type { BankSavingsParser, SavingsParserConfig } from "./types.js";

const SOURCE_URL =
  "https://www.bbva.com.co/content/dam/public-web/colombia/documents/personas/cuentas/ahorro/DO-01-Tasas-cuenta-ahorro.pdf";

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
 * Parses Colombian amount like "5.000.000" or "49.999.999"
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
 * Extracts tiered rates from Cuenta Especial Premium section
 * PDF text format:
 * -$ 1- -$ 4.999.999- 0,01%
 * -$ 5.000.000- -$ 49.999.999- 3,00%
 * ...
 * Superiores a: -$ 1.000.000.000- 9,25%
 */
function parseCuentaEspecialPremium(text: string): RateTier[] {
  const tiers: RateTier[] = [];

  // Find the Cuenta Especial Premium section
  const sectionMatch = text.match(
    /Cuenta\s+Especial\s+Premium[\s\S]*?LIQUIDA\s+SOBRE\s+SALDOS\s+DIARIOS/i
  );
  if (!sectionMatch) return tiers;

  const section = sectionMatch[0];

  // Parse tiered ranges: -$ MIN- -$ MAX- RATE%
  // Pattern captures: "-$ 1- -$ 4.999.999- 0,01%"
  const tierPattern = /-\$\s*([\d.]+)-\s+-\$\s*([\d.]+)-\s+(\d+[,]\d+)\s*%/g;
  let match;
  while ((match = tierPattern.exec(section)) !== null) {
    tiers.push({
      min_amount: parseAmount(match[1]),
      max_amount: parseAmount(match[2]),
      ea_percent: parseColombianNumber(match[3]),
    });
  }

  // Parse "Superiores a:" for unlimited upper bound
  // Format: "Superiores a: -$ 1.000.000.000- 9,25%"
  const superiorMatch = section.match(/Superiores\s+a:\s+-\$\s*([\d.]+)-\s+(\d+[,]\d+)\s*%/i);
  if (superiorMatch) {
    tiers.push({
      min_amount: parseAmount(superiorMatch[1]),
      max_amount: undefined,
      ea_percent: parseColombianNumber(superiorMatch[2]),
    });
  }

  return tiers;
}

/**
 * Extracts tiered rates from Cuenta Hogar section
 * PDF text format:
 * -$ 1- -$ 500.000- 0,12%
 * ...
 * Superiores a: -$ 50.000.000- 1,60%
 */
function parseCuentaHogar(text: string): RateTier[] {
  const tiers: RateTier[] = [];

  const sectionMatch = text.match(/Cuenta\s+Hogar[\s\S]*?LIQUIDADA\s+SOBRE\s+PROMEDIO\s+MENSUAL/i);
  if (!sectionMatch) return tiers;

  const section = sectionMatch[0];

  // Parse tiered ranges: -$ MIN- -$ MAX- RATE%
  const tierPattern = /-\$\s*([\d.]+)-\s+-\$\s*([\d.]+)-\s+(\d+[,]\d+)\s*%/g;
  let match;
  while ((match = tierPattern.exec(section)) !== null) {
    tiers.push({
      min_amount: parseAmount(match[1]),
      max_amount: parseAmount(match[2]),
      ea_percent: parseColombianNumber(match[3]),
    });
  }

  // Parse "Superiores a:" format: "Superiores a: -$ 50.000.000- 1,60%"
  const superiorMatch = section.match(/Superiores\s+a:\s+-\$\s*([\d.]+)-\s+(\d+[,]\d+)\s*%/i);
  if (superiorMatch) {
    tiers.push({
      min_amount: parseAmount(superiorMatch[1]) + 1, // Next tier starts at max+1
      max_amount: undefined,
      ea_percent: parseColombianNumber(superiorMatch[2]),
    });
  }

  return tiers;
}

/**
 * Extracts tiered rates from AFC section
 * AFC spans pages:
 * Page 1 ends with "AFC Rangos Tasa E.A"
 * Page 2 starts with the actual rates: "-$ 1- -$ 499.999- 1,40%" etc.
 */
function parseAfc(text: string): RateTier[] {
  const tiers: RateTier[] = [];

  // AFC section - look for rates after AFC header, stopping at "Mi proyecto"
  // The rates appear on page 2 starting with "Desde Hasta Tasa E.A"
  const sectionMatch = text.match(/AFC[\s\S]*?LIQUIDADA\s+SOBRE\s+SALDO\s+DIARIO\s+Mi\s+proyecto/i);
  if (!sectionMatch) return tiers;

  const section = sectionMatch[0];

  // Parse tiered ranges: -$ MIN- -$ MAX- RATE%
  const tierPattern = /-\$\s*([\d.]+)-\s+-\$\s*([\d.]+)-\s+(\d+[,]\d+)\s*%/g;
  let match;
  while ((match = tierPattern.exec(section)) !== null) {
    tiers.push({
      min_amount: parseAmount(match[1]),
      max_amount: parseAmount(match[2]),
      ea_percent: parseColombianNumber(match[3]),
    });
  }

  // Parse "Superiores a:" format: "Superiores a: -$ 200.000.000- 3,00%"
  const superiorMatch = section.match(/Superiores\s+a:\s+-\$\s*([\d.]+)-\s+(\d+[,]\d+)\s*%/i);
  if (superiorMatch) {
    tiers.push({
      min_amount: parseAmount(superiorMatch[1]) + 1,
      max_amount: undefined,
      ea_percent: parseColombianNumber(superiorMatch[2]),
    });
  }

  return tiers;
}

/**
 * Parses flat-rate accounts like "Todos los montos 0,01%"
 */
function parseFlatRateAccount(
  text: string,
  accountPattern: RegExp,
  accountName: string,
  accountType: SavingsAccountType
): AccountData | null {
  const match = text.match(accountPattern);
  if (!match) return null;

  const rateMatch = match[0].match(/Todos\s+los\s+montos\s+(\d+[,]\d+)\s*%/i);
  if (!rateMatch) return null;

  return {
    name: accountName,
    type: accountType,
    tiers: [
      {
        min_amount: 1,
        max_amount: undefined,
        ea_percent: parseColombianNumber(rateMatch[1]),
      },
    ],
  };
}

/**
 * Parses Ahorro Fijo (fixed savings with term-based rates)
 * This is more like a CDT but appears in savings section
 */
function parseAhorroFijo(text: string): AccountData | null {
  const sectionMatch = text.match(/Ahorro\s+fijo[\s\S]*?LIQUIDADA\s+SOBRE\s+SALDO\s+DIARIO/i);
  if (!sectionMatch) return null;

  const section = sectionMatch[0];

  // Find the best rate (longest term = highest rate usually)
  // Pattern: "360 a 539 10,00%"
  const ratePattern = /(\d+)\s+a\s+(\d+)\s+(\d+[,]\d+)\s*%/g;
  let bestRate = 0;
  let match;

  while ((match = ratePattern.exec(section)) !== null) {
    const rate = parseColombianNumber(match[3]);
    if (rate > bestRate) {
      bestRate = rate;
    }
  }

  if (bestRate === 0) return null;

  return {
    name: "Ahorro Fijo",
    type: SavingsAccountType.HIGH_YIELD,
    tiers: [
      {
        min_amount: 5_000_000, // Minimum for Ahorro Fijo
        max_amount: undefined,
        ea_percent: bestRate,
      },
    ],
  };
}

export class BbvaSavingsParser implements BankSavingsParser {
  bankId = BankId.BBVA;
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
    if (!/TASAS DE INTERÉS APLICABLES SOBRE CUENTAS DE AHORRO/i.test(fullText)) {
      throw new Error(
        "Could not find 'TASAS DE INTERÉS APLICABLES SOBRE CUENTAS DE AHORRO' header - PDF structure may have changed"
      );
    }

    const accounts: AccountData[] = [];

    // 1. Cuenta Especial Premium (high yield with tiers) - best rates for consumers
    const premiumTiers = parseCuentaEspecialPremium(fullText);
    if (premiumTiers.length > 0) {
      accounts.push({
        name: "Cuenta Especial Premium",
        type: SavingsAccountType.HIGH_YIELD,
        tiers: premiumTiers,
      });
    } else {
      warnings.push("Could not parse Cuenta Especial Premium tiers");
    }

    // 2. Cuenta de Nómina y Cuenta Digital
    const nominaDigital = parseFlatRateAccount(
      fullText,
      /Cuenta\s+de\s+Nómina\s+y\s+Cuenta\s+Digital[\s\S]*?LIQUIDA\s+SOBRE\s+SALDO\s+PROMEDIO\s+DIARIO\s+DEL\s+MES/i,
      "Cuenta de Nómina y Digital",
      SavingsAccountType.DIGITAL
    );
    if (nominaDigital) accounts.push(nominaDigital);

    // 3. Cuenta Blue (digital account)
    const blue = parseFlatRateAccount(
      fullText,
      /Cuenta\s+Blue[\s\S]*?LIQUIDA\s+SOBRE\s+SALDO\s+PROMEDIO\s+DIARIO\s+DEL\s+MES/i,
      "Cuenta Blue",
      SavingsAccountType.DIGITAL
    );
    if (blue) accounts.push(blue);

    // 4. Cuenta Blue Kids
    const blueKids = parseFlatRateAccount(
      fullText,
      /Cuenta\s+Blue\s+Kids[\s\S]*?LIQUIDA\s+SOBRE\s+SALDO\s+PROMEDIO\s+DIARIO\s+DEL\s+MES/i,
      "Cuenta Blue Kids",
      SavingsAccountType.STANDARD
    );
    if (blueKids) accounts.push(blueKids);

    // 5. Cuenta Hogar (tiered)
    const hogarTiers = parseCuentaHogar(fullText);
    if (hogarTiers.length > 0) {
      accounts.push({
        name: "Cuenta Hogar",
        type: SavingsAccountType.STANDARD,
        tiers: hogarTiers,
      });
    }

    // 6. AFC (tiered, tax-advantaged for housing)
    const afcTiers = parseAfc(fullText);
    if (afcTiers.length > 0) {
      accounts.push({
        name: "AFC (Ahorro para Fomento de la Construcción)",
        type: SavingsAccountType.STANDARD,
        tiers: afcTiers,
      });
    }

    // 7. Ahorro Fijo (best rate for long-term fixed savings)
    const ahorroFijo = parseAhorroFijo(fullText);
    if (ahorroFijo) accounts.push(ahorroFijo);

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
            document_label: "Tasas de interés cuentas de ahorro",
            retrieved_at: retrievedAt,
            extracted_text_fingerprint: rawTextHash,
            extraction: {
              method: ExtractionMethod.REGEX,
              locator: `bbva_${account.name.toLowerCase().replace(/\s+/g, "_")}`,
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

    // Check for Cuenta Especial Premium (the main high-yield account)
    const premiumOffers = offers.filter((o) => o.account_name === "Cuenta Especial Premium");
    if (premiumOffers.length < 7) {
      warnings.push(`Expected 7 Cuenta Especial Premium tiers, got ${premiumOffers.length}`);
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
