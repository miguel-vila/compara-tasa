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

// Banco Agrario publishes rates at this base URL
// The actual PDF URL changes weekly, so we need to discover it from the main page
const SOURCE_PAGE_URL = "https://www.bancoagrario.gov.co/tasas-y-tarifas";

// Fallback direct PDF URL (may need updating)
const SOURCE_PDF_URL =
  "https://www.bancoagrario.gov.co/system/files/2026-01/alcance_1_tasas_colocaciones_del_05_al_11_de_enero_2026_0.pdf";

type ExtractedRate = {
  productType: MortgageType;
  currencyIndex: CurrencyIndex;
  segment: Segment;
  rateFrom: number;
  rateTo?: number;
  description: string;
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
 * Parses housing rates from Banco Agrario PDF
 * Rates are found on page 8 of the PDF
 */
function parseHousingRates(text: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // Pattern for VIS UVR: "VIVIENDA DE INTERÉS SOCIAL EN UVR ( UVR + 5.10% )"
  const visUvrPattern =
    /VIVIENDA\s+DE\s+INTER[EÉ]S\s+SOCIAL\s+EN\s+UVR\s*\(\s*UVR\s*\+\s*(\d+[,.]?\d*)\s*%\s*\)/i;
  const visUvrMatch = text.match(visUvrPattern);
  if (visUvrMatch) {
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.VIS,
      rateFrom: parseColombianNumber(visUvrMatch[1]),
      description: visUvrMatch[0].substring(0, 80),
    });
  }

  // Pattern for VIS COP: "VIVIENDA DE INTERÉS SOCIAL EN PESOS 10.70%"
  const visCopPattern = /VIVIENDA\s+DE\s+INTER[EÉ]S\s+SOCIAL\s+EN\s+PESOS\s+(\d+[,.]?\d*)\s*%?/i;
  const visCopMatch = text.match(visCopPattern);
  if (visCopMatch) {
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.VIS,
      rateFrom: parseColombianNumber(visCopMatch[1]),
      description: visCopMatch[0].substring(0, 80),
    });
  }

  // Pattern for NO_VIS UVR: "VIVIENDA NO VIS EN UVR. ( UVR + 6.10% )"
  const noVisUvrPattern =
    /VIVIENDA\s+NO\s+VIS\s+EN\s+UVR\.?\s*\(\s*UVR\s*\+\s*(\d+[,.]?\d*)\s*%\s*\)/i;
  const noVisUvrMatch = text.match(noVisUvrPattern);
  if (noVisUvrMatch) {
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.NO_VIS,
      rateFrom: parseColombianNumber(noVisUvrMatch[1]),
      description: noVisUvrMatch[0].substring(0, 80),
    });
  }

  // Pattern for NO_VIS COP: "VIVIENDA NO VIS EN PESOS 12.50%"
  const noVisCopPattern = /VIVIENDA\s+NO\s+VIS\s+EN\s+PESOS\s+(\d+[,.]?\d*)\s*%?/i;
  const noVisCopMatch = text.match(noVisCopPattern);
  if (noVisCopMatch) {
    rates.push({
      productType: MortgageType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.NO_VIS,
      rateFrom: parseColombianNumber(noVisCopMatch[1]),
      description: noVisCopMatch[0].substring(0, 80),
    });
  }

  // Leasing Habitacional rates (COP only in PDF)
  // Pattern: "VIVIENDA DE INTERES SOCIAL EN PESOS 12.00%" (in leasing section)
  // These appear after the hipotecario section
  const leasingSection = text.match(
    /VIVIENDA\s+DE\s+INTERES\s+SOCIAL\s+EN\s+PESOS\s+(\d+[,.]?\d*)\s*%?[^]*?VIVIENDA\s+NO\s+VIS\s+EN\s+PESOS\s+(\d+[,.]?\d*)\s*%?/i
  );

  if (leasingSection) {
    // Check if this is the leasing section by verifying the rates are different from hipotecario
    const leasingVisCop = parseColombianNumber(leasingSection[1]);
    const leasingNoVisCop = parseColombianNumber(leasingSection[2]);

    // If the leasing VIS rate is different from hipotecario VIS rate, add leasing offers
    const hipotecarioVisCop = rates.find(
      (r) =>
        r.productType === MortgageType.HIPOTECARIO &&
        r.currencyIndex === CurrencyIndex.COP &&
        r.segment === Segment.VIS
    );

    if (hipotecarioVisCop && Math.abs(hipotecarioVisCop.rateFrom - leasingVisCop) > 0.5) {
      rates.push({
        productType: MortgageType.LEASING,
        currencyIndex: CurrencyIndex.COP,
        segment: Segment.VIS,
        rateFrom: leasingVisCop,
        description: `Leasing VIS COP ${leasingVisCop}%`,
      });

      rates.push({
        productType: MortgageType.LEASING,
        currencyIndex: CurrencyIndex.COP,
        segment: Segment.NO_VIS,
        rateFrom: leasingNoVisCop,
        description: `Leasing NO_VIS COP ${leasingNoVisCop}%`,
      });
    }
  }

  return rates;
}

export class BancoAgrarioParser implements BankMortgageParser {
  bankId = BankId.BANCO_AGRARIO;
  sourceUrl = SOURCE_PAGE_URL;

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
      // Fetch directly from PDF URL
      const result = await fetchWithRetry(SOURCE_PDF_URL, {
        useBrowserUserAgent: true,
      });
      pdfBuffer = result.content;
    }

    const rawTextHash = sha256(pdfBuffer.toString("base64"));

    // Extract text from PDF
    const pdfData = new Uint8Array(pdfBuffer);
    const pageTexts = await extractPdfText(pdfData);

    // Combine all pages for searching (housing rates are on page 8)
    const fullText = pageTexts.join(" ");

    // Check for housing section markers
    if (!fullText.includes("VIVIENDA") || !fullText.includes("HIPOTECARIO")) {
      warnings.push("Could not find housing rate section in PDF");
    }

    // Parse rates from the combined text
    const extractedRates = parseHousingRates(fullText);

    if (extractedRates.length === 0) {
      warnings.push("No housing rates extracted - PDF structure may have changed");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Create offers from extracted rates
    for (const extracted of extractedRates) {
      let rate: Rate;

      if (extracted.currencyIndex === CurrencyIndex.UVR) {
        rate = {
          kind: "UVR_SPREAD",
          spread_ea_from: extracted.rateFrom,
          spread_ea_to: extracted.rateTo,
        };
      } else {
        rate = {
          kind: "COP_FIXED",
          ea_percent_from: extracted.rateFrom,
          ea_percent_to: extracted.rateTo,
        };
      }

      const offer: MortgageOffer = {
        id: generateOfferId({
          bank_id: this.bankId,
          product_type: extracted.productType,
          currency_index: extracted.currencyIndex,
          segment: extracted.segment,
          channel: Channel.UNSPECIFIED,
          rate_from: extracted.rateFrom,
        }),
        bank_id: this.bankId,
        bank_name: BankNames[this.bankId],
        product_type: extracted.productType,
        currency_index: extracted.currencyIndex,
        segment: extracted.segment,
        channel: Channel.UNSPECIFIED,
        rate,
        conditions: {},
        source: {
          url: this.sourceUrl,
          source_type: SourceType.PDF,
          document_label: "Tasas de Colocación - Banco Agrario",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.REGEX,
            locator: "housing_rates_section",
            excerpt: extracted.description,
          },
        },
      };

      offers.push(offer);
    }

    // Validate expected count (at least 4 hipotecario rates: VIS/NO_VIS × UVR/COP)
    if (offers.length < 4) {
      warnings.push(
        `Only extracted ${offers.length} offers, expected at least 4 (VIS/NO_VIS × UVR/COP for hipotecario)`
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
