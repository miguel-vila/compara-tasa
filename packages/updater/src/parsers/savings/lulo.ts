import * as cheerio from "cheerio";
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
import { sha256, generateSavingsOfferId } from "../../utils/index.js";
import type { BankSavingsParser, SavingsParserConfig } from "./types.js";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Apply stealth plugin to avoid bot detection
chromium.use(StealthPlugin());

const SOURCE_URL =
  "https://ayuda.lulobank.com/hc/es/articles/28625884138772--Cu%C3%A1les-son-las-caracter%C3%ADsticas-de-los-bolsillos-y-su-rendimiento";

/**
 * Parses Colombian percentage format (e.g., "7,5% E.A." -> 7.5)
 */
function parseColombianPercent(text: string): number {
  // Extract number with comma as decimal separator
  const match = text.match(/(\d+),(\d+)\s*%/);
  if (!match) {
    // Try with period as decimal separator
    const matchDot = text.match(/(\d+)\.(\d+)\s*%/);
    if (!matchDot) {
      // Try integer percentage
      const matchInt = text.match(/(\d+)\s*%/);
      if (!matchInt) {
        throw new Error(`Failed to parse percentage: "${text}"`);
      }
      return parseInt(matchInt[1], 10);
    }
    return parseFloat(`${matchDot[1]}.${matchDot[2]}`);
  }
  return parseFloat(`${match[1]}.${match[2]}`);
}

/**
 * Fetches HTML using Playwright with stealth plugin to bypass Cloudflare protection.
 */
async function fetchWithPlaywright(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: "es-CO",
    });
    const page = await context.newPage();

    // Navigate and wait for content to load
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // Wait for article content to load
    await page.waitForSelector(".article-body", { timeout: 30000 });

    return await page.content();
  } finally {
    await browser.close();
  }
}

type ExtractedRate = {
  accountName: string;
  accountType: SavingsAccountType;
  eaPercent: number;
  isLuloPro: boolean;
  excerpt: string;
};

/**
 * Extracts rates from the article body text
 */
function extractRates(articleText: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // Extract Bolsillos Flex rates
  // Pattern: "El rendimiento de tus Bolsillos Flex es del 7,5% E.A. Si eres Lulo Pro, el rendimiento será del 9,25% E.A."
  const flexMatch = articleText.match(
    /Bolsillos\s+Flex\s+es\s+del\s+(\d+[,.]\d+)\s*%\s*E\.A\..*?Lulo\s+Pro.*?(\d+[,.]\d+)\s*%\s*E\.A\./i
  );

  if (flexMatch) {
    const regularRate = parseColombianPercent(flexMatch[1] + "%");
    const proRate = parseColombianPercent(flexMatch[2] + "%");

    rates.push({
      accountName: "Bolsillos Flex",
      accountType: SavingsAccountType.HIGH_YIELD,
      eaPercent: regularRate,
      isLuloPro: false,
      excerpt: `Bolsillos Flex: ${flexMatch[1]}% E.A.`,
    });

    rates.push({
      accountName: "Bolsillos Flex (Lulo Pro)",
      accountType: SavingsAccountType.HIGH_YIELD,
      eaPercent: proRate,
      isLuloPro: true,
      excerpt: `Bolsillos Flex Lulo Pro: ${flexMatch[2]}% E.A.`,
    });
  }

  // Extract Bolsillos Programados rates
  // Pattern: "El rendimiento de tus Bolsillos Programados va desde 9% E.A. Si eres Lulo Pro, el rendimiento va desde el 10% E.A."
  const programadosMatch = articleText.match(
    /Bolsillos\s+Programados\s+va\s+desde\s+(\d+[,.]?\d*)\s*%\s*E\.A\..*?Lulo\s+Pro.*?(\d+[,.]?\d*)\s*%\s*E\.A\./i
  );

  if (programadosMatch) {
    const regularRate = parseColombianPercent(programadosMatch[1] + "%");
    const proRate = parseColombianPercent(programadosMatch[2] + "%");

    rates.push({
      accountName: "Bolsillos Programados",
      accountType: SavingsAccountType.HIGH_YIELD,
      eaPercent: regularRate,
      isLuloPro: false,
      excerpt: `Bolsillos Programados: ${programadosMatch[1]}% E.A.`,
    });

    rates.push({
      accountName: "Bolsillos Programados (Lulo Pro)",
      accountType: SavingsAccountType.HIGH_YIELD,
      eaPercent: proRate,
      isLuloPro: true,
      excerpt: `Bolsillos Programados Lulo Pro: ${programadosMatch[2]}% E.A.`,
    });
  }

  return rates;
}

export class LuloParser implements BankSavingsParser {
  bankId = BankId.LULO;
  sourceUrl = SOURCE_URL;

  constructor(private config: SavingsParserConfig = {}) {}

  async parse(): Promise<BankSavingsParseResult> {
    const warnings: string[] = [];
    const offers: SavingsOffer[] = [];
    const retrievedAt = new Date().toISOString();

    // Fetch HTML (from fixture or live via Playwright)
    let html: string;
    if (this.config.useFixtures && this.config.fixturesPath) {
      html = await readFile(this.config.fixturesPath, "utf-8");
    } else {
      html = await fetchWithPlaywright(this.sourceUrl);
    }

    const rawTextHash = sha256(html);
    const $ = cheerio.load(html);

    // Extract article body text
    const articleBody = $(".article-body").text();

    if (!articleBody || articleBody.trim().length === 0) {
      throw new Error("Could not find article body - page structure may have changed");
    }

    // Verify this is the right page
    if (!/Bolsillos\s+(Flex|Programados)/i.test(articleBody)) {
      throw new Error("Article does not contain expected bolsillos content");
    }

    // Extract rates from article text
    const extractedRates = extractRates(articleBody);

    if (extractedRates.length === 0) {
      throw new Error("No rates extracted - page structure may have changed");
    }

    // Create offers from extracted rates
    for (const extracted of extractedRates) {
      const offer: SavingsOffer = {
        id: generateSavingsOfferId({
          bank_id: this.bankId,
          account_type: extracted.accountType,
          account_name: extracted.accountName,
          ea_percent: extracted.eaPercent,
          min_amount_cop: 1,
        }),
        bank_id: this.bankId,
        bank_name: BankNames[this.bankId],
        account_type: extracted.accountType,
        account_name: extracted.accountName,
        rate: { ea_percent: extracted.eaPercent },
        min_amount_cop: 1,
        source: {
          url: this.sourceUrl,
          source_type: SourceType.HTML,
          document_label: "Características de los bolsillos",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.REGEX,
            locator: ".article-body",
            excerpt: extracted.excerpt,
          },
        },
      };

      offers.push(offer);
    }

    // Validate expected count
    if (offers.length < 4) {
      warnings.push(
        `Expected 4 offers (Flex regular/pro + Programados regular/pro), got ${offers.length}`
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
