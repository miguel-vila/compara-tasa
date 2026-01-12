import { readFile } from "fs/promises";
import {
  BankId,
  BankNames,
  ProductType,
  CurrencyIndex,
  Segment,
  Channel,
  SourceType,
  ExtractionMethod,
  type Offer,
  type BankParseResult,
} from "@mejor-tasa/core";
import { sha256, generateOfferId, parseColombianNumber } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Apply stealth plugin to avoid bot detection
chromium.use(StealthPlugin());

const SOURCE_URL =
  "https://www.bancodeoccidente.com.co/banco-de-occidente/documentos/tasas-tarifas/para-personas/tasas/tasas-personas.pdf";

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

const MAIN_PAGE_URL = "https://www.bancodeoccidente.com.co/";

/**
 * Fetches a PDF using Playwright with stealth plugin to bypass CloudFront bot protection.
 * Visits the main page first to establish a valid session before navigating to the PDF.
 * Handles both inline PDFs and download-triggered PDFs.
 */
async function fetchPdfWithPlaywright(url: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: "es-CO",
      acceptDownloads: true,
    });
    const page = await context.newPage();

    // First visit the main page to establish session/cookies
    const mainResponse = await page.goto(MAIN_PAGE_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    if (!mainResponse?.ok()) {
      throw new Error(`Failed to load main page: HTTP ${mainResponse?.status()}`);
    }

    // Brief wait before navigating to PDF
    await page.waitForTimeout(1000);

    // Set up download handler before navigation
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);

    // Navigate to the PDF URL - this may trigger a download
    const [response, download] = await Promise.all([
      page.goto(url, { waitUntil: "commit", timeout: 30000 }).catch(() => null),
      downloadPromise,
    ]);

    // If a download was triggered, read from the download
    if (download) {
      const path = await download.path();
      if (!path) {
        throw new Error("Download failed - no path available");
      }
      const { readFile } = await import("fs/promises");
      const buffer = await readFile(path);
      return buffer;
    }

    // Otherwise, read from the response
    if (!response) {
      throw new Error("No response received");
    }

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
    }

    const buffer = await response.body();
    return buffer;
  } finally {
    await browser.close();
  }
}

type ExtractedRate = {
  productType: ProductType;
  eaFrom: number;
  eaTo?: number;
  excerpt: string;
};

/**
 * Parses the vivienda section and extracts mortgage rates
 *
 * Expected format on page 16:
 * Vivienda  Tasas Vivienda  TASA E.A.  CRÉDITO HIPOTECARIO   LEASING HABITACIONAL
 * DESDE   HASTA   DESDE   HASTA
 * 11,62%   16,51%   11,25%   16,00%
 *
 * The PDF text extraction joins these as:
 * "1 1 , 62 %   1 6 , 51 %   1 1 , 25 %   1 6 , 0 0 %"
 */
function parseViviendaSection(text: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // Look for the Vivienda/Tasas Vivienda section
  // Pattern matches rates in the format "X,XX%" or "XX,XX%" with possible spaces
  // The layout shows: HIPOTECARIO_FROM HIPOTECARIO_TO LEASING_FROM LEASING_TO

  // Match pattern for rates with spaces between digits (PDF extraction artifact)
  // Example: "1 1 , 62 %" or "1 6 , 51 %"
  const ratePattern = /(\d\s*\d?\s*,\s*\d\s*\d?\s*%)/g;

  // Find the vivienda section - look for "Tasas Vivienda" or similar marker
  const viviendaMatch = text.match(
    /(?:Tasas\s+Vivienda|CRÉDITO\s+HIPOTECARIO\s+LEASING\s+HABITACIONAL)[\s\S]*?DESDE\s+HASTA\s+DESDE\s+HASTA[\s\S]*?((?:\d\s*\d?\s*,\s*\d\s*\d?\s*%\s*){4})/i
  );

  if (!viviendaMatch) {
    // Fallback: try to find four consecutive rate percentages near "Vivienda"
    const viviendaIndex = text.indexOf("Vivienda");
    if (viviendaIndex === -1) return rates;

    // Search in the text after "Vivienda"
    const searchText = text.substring(viviendaIndex, viviendaIndex + 500);
    const allRates = [...searchText.matchAll(ratePattern)];

    if (allRates.length >= 4) {
      // Extract the four rates: hipotecario_from, hipotecario_to, leasing_from, leasing_to
      const hipotecarioFrom = parseRateWithSpaces(allRates[0][1]);
      const hipotecarioTo = parseRateWithSpaces(allRates[1][1]);
      const leasingFrom = parseRateWithSpaces(allRates[2][1]);
      const leasingTo = parseRateWithSpaces(allRates[3][1]);

      if (hipotecarioFrom !== null && hipotecarioTo !== null) {
        rates.push({
          productType: ProductType.HIPOTECARIO,
          eaFrom: hipotecarioFrom,
          eaTo: hipotecarioTo,
          excerpt: `Crédito Hipotecario: ${allRates[0][1]} - ${allRates[1][1]}`,
        });
      }

      if (leasingFrom !== null && leasingTo !== null) {
        rates.push({
          productType: ProductType.LEASING,
          eaFrom: leasingFrom,
          eaTo: leasingTo,
          excerpt: `Leasing Habitacional: ${allRates[2][1]} - ${allRates[3][1]}`,
        });
      }
    }
    return rates;
  }

  // Parse the matched rates section
  const ratesSection = viviendaMatch[1];
  const allRates = [...ratesSection.matchAll(ratePattern)];

  if (allRates.length >= 4) {
    const hipotecarioFrom = parseRateWithSpaces(allRates[0][1]);
    const hipotecarioTo = parseRateWithSpaces(allRates[1][1]);
    const leasingFrom = parseRateWithSpaces(allRates[2][1]);
    const leasingTo = parseRateWithSpaces(allRates[3][1]);

    if (hipotecarioFrom !== null && hipotecarioTo !== null) {
      rates.push({
        productType: ProductType.HIPOTECARIO,
        eaFrom: hipotecarioFrom,
        eaTo: hipotecarioTo,
        excerpt: `Crédito Hipotecario: ${allRates[0][1]} - ${allRates[1][1]}`,
      });
    }

    if (leasingFrom !== null && leasingTo !== null) {
      rates.push({
        productType: ProductType.LEASING,
        eaFrom: leasingFrom,
        eaTo: leasingTo,
        excerpt: `Leasing Habitacional: ${allRates[2][1]} - ${allRates[3][1]}`,
      });
    }
  }

  return rates;
}

/**
 * Parses a rate string that may have spaces between digits
 * Examples: "1 1 , 62 %" -> 11.62, "1 6 , 51 %" -> 16.51
 */
function parseRateWithSpaces(rateStr: string): number | null {
  try {
    // Remove spaces and % sign
    const cleaned = rateStr.replace(/\s+/g, "").replace(/%/g, "");
    return parseColombianNumber(cleaned);
  } catch {
    return null;
  }
}

export class BancoDeOccidenteParser implements BankParser {
  bankId = BankId.BANCO_DE_OCCIDENTE;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];
    const offers: Offer[] = [];
    const retrievedAt = new Date().toISOString();

    // Fetch PDF (from fixture or live via Playwright)
    let pdfBuffer: Buffer;
    if (this.config.useFixtures && this.config.fixturesPath) {
      pdfBuffer = await readFile(this.config.fixturesPath);
    } else {
      // Use Playwright to bypass bot protection
      pdfBuffer = await fetchPdfWithPlaywright(this.sourceUrl);
    }

    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // Extract text from PDF
    const pdfData = new Uint8Array(pdfBuffer);
    const pageTexts = await extractPdfText(pdfData);

    // Combine all pages for searching
    const fullText = pageTexts.join(" ");

    // Check for the vivienda section marker
    if (!/Vivienda/i.test(fullText) && !/CRÉDITO\s+HIPOTECARIO/i.test(fullText)) {
      warnings.push("Could not find 'Vivienda' or mortgage section");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Parse rates from the combined text
    const extractedRates = parseViviendaSection(fullText);

    if (extractedRates.length === 0) {
      warnings.push("No mortgage rates extracted - PDF structure may have changed");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Create offers from extracted rates
    for (const extracted of extractedRates) {
      const offer: Offer = {
        id: generateOfferId({
          bank_id: this.bankId,
          product_type: extracted.productType,
          currency_index: CurrencyIndex.COP,
          segment: Segment.UNKNOWN,
          channel: Channel.UNSPECIFIED,
          rate_from: extracted.eaFrom,
        }),
        bank_id: this.bankId,
        bank_name: BankNames[this.bankId],
        product_type: extracted.productType,
        currency_index: CurrencyIndex.COP,
        segment: Segment.UNKNOWN,
        channel: Channel.UNSPECIFIED,
        rate: {
          kind: "COP_FIXED",
          ea_percent_from: extracted.eaFrom,
          ea_percent_to: extracted.eaTo,
        },
        conditions: {},
        source: {
          url: this.sourceUrl,
          source_type: SourceType.PDF,
          document_label: "Tasas y Tarifas - Personas",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.REGEX,
            locator: "vivienda_section",
            excerpt: extracted.excerpt,
          },
        },
      };

      offers.push(offer);
    }

    // Validate expected count
    if (offers.length < 2) {
      warnings.push(`Only extracted ${offers.length} offers, expected 2 (Hipotecario + Leasing)`);
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
