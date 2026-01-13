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
  type Rate,
  type BankParseResult,
} from "@compara-tasa/core";
import { fetchWithRetry, sha256, generateOfferId, parseColombianNumber } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

const SOURCE_URL =
  "https://cdn.aglty.io/scotiabank-colombia/scotiabank-colpatria/pdf/tasas-y-tarifas/Tasas-y-productos-credito.pdf";

// Regex patterns for rate extraction
const PATTERNS = {
  // Match UVR spread like "UVR + 7,60%" or "UVR +7,60%"
  uvrSpread: /UVR\s*\+\s*(\d+[,.]?\d*)\s*%/gi,
  // Match percentage like "12,25%"
  percentage: /(\d+[,.]?\d*)\s*%/g,
  // Section marker
  hipotecarioSection: /Hipotecario y leasing habitacional/i,
} as const;

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
  productType: ProductType;
  currencyIndex: CurrencyIndex;
  segment: Segment;
  rateFrom: number;
  rateTo?: number;
  description: string;
};

/**
 * Parses the hipotecario section and extracts rates
 */
function parseHipotecarioSection(text: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // Patterns to match different product lines
  const productPatterns = [
    {
      pattern:
        /CREDITO\s+HIPOTECARIO\s+VIVIENDA\s+EN\s+UVR\s+NO\s+VIS[^\d]+(UVR\s*\+\s*\d+[,.]\d*\s*%)\s+(UVR\s*\+\s*\d+[,.]\d*\s*%)/i,
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.NO_VIS,
    },
    {
      pattern:
        /CREDITO\s+HIPOTECARIO\s+VIVIENDA\s+EN\s+PESOS\s+NO\s+VIS[^\d]+(\d+[,.]\d*\s*%)\s+(\d+[,.]\d*\s*%)/i,
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.NO_VIS,
    },
    {
      pattern:
        /CREDITO\s+HIPOTECARIO\s+VIVIENDA\s+EN\s+UVR\s+CON\s+VALOR\s+COMERCIAL\s+HASTA\s+150\s+SMLV\s*\(?\s*VIS\s*\)?\**[^\d]+(UVR\s*\+\s*\d+[,.]\d*\s*%)\s+(UVR\s*\+\s*\d+[,.]\d*\s*%)/i,
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.UVR,
      segment: Segment.VIS,
    },
    {
      pattern:
        /CREDITO\s+HIPOTECARIO\s+VIVIENDA\s+EN\s+PESOS\s+CON\s+VALOR\s+COMERCIAL\s+HASTA\s+150\s+SMLV\s*\(?\s*VIS\s*\)?\**[^\d]+(\d+[,.]\d*\s*%)\s+(\d+[,.]\d*\s*%)/i,
      productType: ProductType.HIPOTECARIO,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.VIS,
    },
    {
      pattern:
        /CREDITOS\s+LEASING\s+HABITACIONAL\s+EN\s+PESOS[^\d]+(\d+[,.]\d*\s*%)\s+(\d+[,.]\d*\s*%)/i,
      productType: ProductType.LEASING,
      currencyIndex: CurrencyIndex.COP,
      segment: Segment.UNKNOWN, // No explicit VIS/NO_VIS for leasing
    },
  ];

  for (const { pattern, productType, currencyIndex, segment } of productPatterns) {
    const match = text.match(pattern);
    if (match) {
      let rateFrom: number;
      let rateTo: number | undefined;

      if (currencyIndex === CurrencyIndex.UVR) {
        // Extract UVR spread values
        const uvrMatchFrom = match[1].match(/(\d+[,.]\d*)/);
        const uvrMatchTo = match[2]?.match(/(\d+[,.]\d*)/);
        if (uvrMatchFrom) {
          rateFrom = parseColombianNumber(uvrMatchFrom[1]);
          rateTo = uvrMatchTo ? parseColombianNumber(uvrMatchTo[1]) : undefined;
        } else {
          continue;
        }
      } else {
        // Extract COP percentage values
        const copMatchFrom = match[1].match(/(\d+[,.]\d*)/);
        const copMatchTo = match[2]?.match(/(\d+[,.]\d*)/);
        if (copMatchFrom) {
          rateFrom = parseColombianNumber(copMatchFrom[1]);
          rateTo = copMatchTo ? parseColombianNumber(copMatchTo[1]) : undefined;
        } else {
          continue;
        }
      }

      rates.push({
        productType,
        currencyIndex,
        segment,
        rateFrom,
        rateTo,
        description: match[0].trim().substring(0, 100),
      });
    }
  }

  return rates;
}

export class ScotiabankParser implements BankParser {
  bankId = BankId.SCOTIABANK_COLPATRIA;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];
    const offers: Offer[] = [];
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

    // Combine all pages for searching
    const fullText = pageTexts.join(" ");

    // Check for the hipotecario section
    if (!PATTERNS.hipotecarioSection.test(fullText)) {
      warnings.push("Could not find 'Hipotecario y leasing habitacional' section");
      return { bank_id: this.bankId, offers, warnings, raw_text_hash: rawTextHash };
    }

    // Parse rates from the combined text
    const extractedRates = parseHipotecarioSection(fullText);

    if (extractedRates.length === 0) {
      warnings.push("No mortgage rates extracted - PDF structure may have changed");
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

      const offer: Offer = {
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
          document_label: "Tasas y productos de crédito",
          retrieved_at: retrievedAt,
          extracted_text_fingerprint: rawTextHash,
          extraction: {
            method: ExtractionMethod.REGEX,
            locator: `hipotecario_section`,
            excerpt: extracted.description,
          },
        },
      };

      offers.push(offer);
    }

    // Validate expected count
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
