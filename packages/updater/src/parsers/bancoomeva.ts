import { readFile } from "fs/promises";
import {
  BankId,
  BankNames,
  MortgageType,
  CurrencyIndex,
  Segment,
  Channel,
  SourceType,
  ExtractionMethod,
  type MortgageOffer,
  type Rate,
  type BankMortgageParseResult,
} from "@compara-tasa/core";
import { fetchWithRetry, sha256, generateOfferId, parseColombianNumber } from "../utils/index.js";
import type { BankMortgageParser, ParserConfig } from "./types.js";

// The source URL uses a file ID that changes monthly. We use the rates page URL
// as the canonical source, but fetch the latest PDF dynamically.
const SOURCE_URL = "https://www.bancoomeva.com.co/publicaciones/164289/tasas-de-credito/";
const RATES_PAGE_URL = "https://www.bancoomeva.com.co/publicaciones/164289/tasas-de-credito/";

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

type ExtractedRate = {
  productType: MortgageType;
  currencyIndex: CurrencyIndex;
  segment: Segment;
  rateFrom: number;
  channel: Channel;
  description: string;
};

/**
 * Parses the VIVIENDA section and extracts mortgage rates from the PDF text.
 * Bancoomeva has two sections:
 * - Page 1: "Clientes Bancoomeva" (regular clients)
 * - Page 4: "Asociados a Coomeva" (cooperative members with better rates)
 *
 * We extract rates from both sections. The cooperative member rates are better,
 * but we also track the regular rates as they represent the general offering.
 */
function parseViviendaSection(pageText: string, isAssociates: boolean): ExtractedRate[] {
  const rates: ExtractedRate[] = [];
  const channel = isAssociates ? Channel.BRANCH : Channel.UNSPECIFIED;

  // NO_VIS COP: "Compra vivienda urbana ... 14,3% E.A." or "13,22% E.A."
  const noVisCopPattern =
    /Compra vivienda urbana[^$]*?\$\s*[\d.,]+[^$]*?\$\s*[\d.,]+[^\d]*?180\s+([\d,]+)%\s*E\.?A\.?/i;
  const noVisCopMatch = pageText.match(noVisCopPattern);
  if (noVisCopMatch) {
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.NO_VIS,
      rateFrom: parseColombianNumber(noVisCopMatch[1]),
      channel,
      description: `Compra vivienda urbana - ${noVisCopMatch[1]}% E.A.`,
    });
  }

  // NO_VIS UVR: "Vivienda UVR - NO VIS ... UVR +8,3% E.A" or "UVR + 7,3% E.A."
  const noVisUvrPattern = /Vivienda UVR\s*-?\s*NO\s*VIS[^U]*?UVR\s*\+\s*([\d,]+)%\s*E\.?A\.?/i;
  const noVisUvrMatch = pageText.match(noVisUvrPattern);
  if (noVisUvrMatch) {
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.NO_VIS,
      rateFrom: parseColombianNumber(noVisUvrMatch[1]),
      channel,
      description: `Vivienda UVR NO VIS - UVR + ${noVisUvrMatch[1]}% E.A.`,
    });
  }

  // VIS COP: "VIS en pesos ... 13,89% E.A." or "12,82% E.A."
  // Match the first occurrence (135 SMLV or 150 SMLV)
  const visCopPattern =
    /VIS en pesos[^$]*?\$\s*\d+[^$]*?Máx 80%[^$]*?135 SMMLV[^\d]*?180\s+([\d,]+)%\s*E\.?A\.?/i;
  const visCopMatch = pageText.match(visCopPattern);
  if (visCopMatch) {
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.VIS,
      rateFrom: parseColombianNumber(visCopMatch[1]),
      channel,
      description: `VIS en pesos - ${visCopMatch[1]}% E.A.`,
    });
  }

  // VIS UVR: "Vivienda VIS - UVR ... UVR +8,55% E.A" or "UVR + 7,55% E.A."
  const visUvrPattern = /Vivienda VIS\s*-?\s*UVR[^U]*?UVR\s*\+\s*([\d,]+)%\s*E\.?A\.?/i;
  const visUvrMatch = pageText.match(visUvrPattern);
  if (visUvrMatch) {
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.VIS,
      rateFrom: parseColombianNumber(visUvrMatch[1]),
      channel,
      description: `Vivienda VIS UVR - UVR + ${visUvrMatch[1]}% E.A.`,
    });
  }

  return rates;
}

/**
 * Finds the latest PDF file ID from the rates page
 */
async function findLatestPdfUrl(): Promise<string> {
  // Bancoomeva's server has an incomplete SSL certificate chain, so we skip verification
  const response = await fetchWithRetry(RATES_PAGE_URL, {
    useBrowserUserAgent: true,
    skipSslVerification: true,
  });
  const html = response.content.toString("utf-8");

  // Find the first idFile link (most recent)
  const match = html.match(/descargar\.php\?idFile=(\d+)/);
  if (!match) {
    throw new Error("Could not find PDF download link on rates page");
  }

  return `https://www.bancoomeva.com.co/descargar.php?idFile=${match[1]}`;
}

export class BancomevaParser implements BankMortgageParser {
  bankId = BankId.BANCOOMEVA;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankMortgageParseResult> {
    const warnings: string[] = [];
    const offers: MortgageOffer[] = [];
    const retrievedAt = new Date().toISOString();

    // Fetch PDF (from fixture or live)
    let pdfBuffer: Buffer;
    if (this.config.useFixtures && this.config.fixturesPath) {
      pdfBuffer = await readFile(this.config.fixturesPath);
    } else {
      // Find and fetch the latest PDF
      const pdfUrl = await findLatestPdfUrl();
      // Bancoomeva's server has an incomplete SSL certificate chain, so we skip verification
      const result = await fetchWithRetry(pdfUrl, {
        useBrowserUserAgent: true,
        skipSslVerification: true,
      });
      pdfBuffer = result.content;
    }

    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // Extract text from PDF
    const pdfData = new Uint8Array(pdfBuffer);
    const pageTexts = await extractPdfText(pdfData);

    if (pageTexts.length < 4) {
      warnings.push(`Expected at least 4 pages in PDF, found ${pageTexts.length}`);
    }

    // Page 1: Clientes Bancoomeva (regular clients)
    const clientesSection = pageTexts[0] || "";
    const clientesRates = parseViviendaSection(clientesSection, false);

    // Page 4: Asociados a Coomeva (cooperative members - better rates)
    const asociadosSection = pageTexts[3] || "";
    const asociadosRates = parseViviendaSection(asociadosSection, true);

    // Combine rates, preferring the best rate for each combination
    // The asociados rates are generally better, so we use them as the primary rates
    // For the general offering (no special membership), we use clientes rates
    const allExtractedRates = [...clientesRates, ...asociadosRates];

    if (allExtractedRates.length === 0) {
      warnings.push("No mortgage rates extracted - PDF structure may have changed");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Create offers from extracted rates
    for (const extracted of allExtractedRates) {
      let rate: Rate;

      if (extracted.currencyIndex === CurrencyIndex.UVR) {
        rate = {
          kind: "UVR_SPREAD",
          spread_ea_from: extracted.rateFrom,
        };
      } else {
        rate = {
          kind: "COP_FIXED",
          ea_percent_from: extracted.rateFrom,
        };
      }

      const offer: MortgageOffer = {
        id: generateOfferId({
          bank_id: this.bankId,
          product_type: extracted.productType,
          currency_index: extracted.currencyIndex,
          segment: extracted.segment,
          channel: extracted.channel,
          rate_from: extracted.rateFrom,
        }),
        bank_id: this.bankId,
        bank_name: BankNames[this.bankId],
        product_type: extracted.productType,
        currency_index: extracted.currencyIndex,
        segment: extracted.segment,
        channel: extracted.channel,
        rate,
        conditions:
          extracted.channel === Channel.BRANCH
            ? { notes: ["Rate for Coomeva cooperative members"] }
            : {},
        source: {
          url: this.sourceUrl,
          source_type: SourceType.PDF,
          document_label: "Tasas de Crédito",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.REGEX,
            locator:
              extracted.channel === Channel.BRANCH ? "asociados_vivienda" : "clientes_vivienda",
            excerpt: extracted.description,
          },
        },
      };

      offers.push(offer);
    }

    // Validate expected count
    // We expect at least 4 rates: VIS/NO_VIS × UVR/COP for at least one section
    if (offers.length < 4) {
      warnings.push(
        `Only extracted ${offers.length} offers, expected at least 4 (VIS/NO_VIS × UVR/COP)`
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
