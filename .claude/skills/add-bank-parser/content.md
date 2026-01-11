# Skill: Add a New Bank Parser

This skill guides you through adding a new bank parser to the MejorTasa rate aggregator.

## Prerequisites

- The bank must be listed in the `BankId` enum in `packages/core/src/enums.ts`
- You need the bank's public rate disclosure URL (HTML page or PDF)

## Steps Overview

1. Download a fixture file for testing
2. Analyze the source structure (HTML or PDF)
3. Implement the parser
4. Register the parser
5. Write tests
6. Update PROGRESS.md

---

## Step 1: Download a Fixture File

Fixtures are saved copies of bank rate disclosures used for testing. They ensure tests are deterministic and don't depend on network availability.

### Location

```
fixtures/{bank_id}/
```

Where `{bank_id}` matches the enum value (e.g., `bancolombia`, `scotiabank_colpatria`).

### For HTML sources

```bash
curl -o fixtures/{bank_id}/rates-page.html "https://example.com/rates-page"
```

### For PDF sources

```bash
mkdir -p fixtures/{bank_id}
curl -L -o fixtures/{bank_id}/rates.pdf "https://example.com/rates.pdf"
```

---

## Step 2: Analyze the Source Structure

### For HTML

Use browser dev tools or extract with curl, then identify:

- CSS selectors for rate tables
- Section headers that identify VIS/NO_VIS, UVR/COP
- Rate value patterns

### For PDF

Extract text to understand the structure:

```typescript
// Quick extraction script (run from packages/updater)
node --experimental-modules -e "
(async () => {
  const pdfjs = await import('pdfjs-dist');
  const fs = await import('fs');
  const path = await import('path');

  const pdfPath = '../../fixtures/{bank_id}/rates.pdf';
  const pdfBuffer = fs.readFileSync(pdfPath);
  const data = new Uint8Array(pdfBuffer);
  const pdf = await pdfjs.getDocument({ data }).promise;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => 'str' in item ? item.str : '').join(' ');
    console.log('=== PAGE ' + i + ' ===');
    console.log(text);
  }
})();
"
```

Look for:

- Section headers (e.g., "Hipotecario y leasing habitacional")
- Rate patterns (e.g., "UVR + 7,60%", "12,25%")
- Segment identifiers (VIS, NO VIS, 150 SMLV)
- Payroll discount information

---

## Step 3: Implement the Parser

### File Location

```
packages/updater/src/parsers/{bank_id}.ts
```

### Parser Template

```typescript
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
} from "@mejor-tasa/core";
import { fetchWithRetry, sha256, generateOfferId, parseColombianNumber } from "../utils/index.js";
import type { BankParser, ParserConfig } from "./types.js";

const SOURCE_URL = "https://example.com/rates";

export class MyBankParser implements BankParser {
  bankId = BankId.MY_BANK;
  sourceUrl = SOURCE_URL;

  constructor(private config: ParserConfig = {}) {}

  async parse(): Promise<BankParseResult> {
    const warnings: string[] = [];
    const offers: Offer[] = [];
    const retrievedAt = new Date().toISOString();

    // Fetch source (from fixture or live)
    let content: Buffer;
    if (this.config.useFixtures && this.config.fixturesPath) {
      content = await readFile(this.config.fixturesPath);
    } else {
      const result = await fetchWithRetry(this.sourceUrl);
      content = result.content;
    }

    const rawTextHash = sha256(content.toString("base64"));

    // === PARSING LOGIC HERE ===
    // For HTML: use cheerio
    // For PDF: use pdfjs-dist (see extractPdfText helper below)

    // Create offers for each rate found
    // ...

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
```

### PDF Text Extraction Helper

```typescript
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
```

### Creating an Offer

```typescript
const offer: Offer = {
  id: generateOfferId({
    bank_id: this.bankId,
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.UVR,
    segment: Segment.VIS,
    channel: Channel.UNSPECIFIED,
    rate_from: 6.5,
  }),
  bank_id: this.bankId,
  bank_name: BankNames[this.bankId],
  product_type: ProductType.HIPOTECARIO,
  currency_index: CurrencyIndex.UVR,
  segment: Segment.VIS,
  channel: Channel.UNSPECIFIED,
  rate: {
    kind: "UVR_SPREAD",
    spread_ea_from: 6.5,
    spread_ea_to: 6.8, // optional
  },
  conditions: {
    // Optional: payroll discount if the bank offers one
    payroll_discount: {
      type: "PERCENT_OFF", // or "BPS_OFF"
      value: 1.0,
      applies_to: "RATE",
      note: "Discount description",
    },
  },
  source: {
    url: this.sourceUrl,
    source_type: SourceType.PDF, // or SourceType.HTML
    document_label: "Document title",
    retrieved_at: retrievedAt,
    extracted_text_fingerprint: rawTextHash,
    extraction: {
      method: ExtractionMethod.REGEX, // or ExtractionMethod.CSS_SELECTOR
      locator: "pattern_name",
      excerpt: "Short excerpt for debugging",
    },
  },
};
```

### Rate Types

**COP Fixed Rate:**

```typescript
rate: {
  kind: "COP_FIXED",
  ea_percent_from: 12.0,
  ea_percent_to: 12.5,      // optional
  mv_percent_from: 0.95,    // optional (monthly rate)
  mv_percent_to: 0.98,      // optional
}
```

**UVR Spread:**

```typescript
rate: {
  kind: "UVR_SPREAD",
  spread_ea_from: 6.5,
  spread_ea_to: 6.8,        // optional
  spread_mv_from: 0.52,     // optional
  spread_mv_to: 0.55,       // optional
}
```

### Utility Functions

```typescript
import {
  parseColombianNumber, // "12,50" -> 12.5
  parseUvrSpread, // "UVR + 6,50%" -> 6.5
  parseEaPercent, // "12,00%" -> 12.0
} from "../utils/index.js";
```

---

## Step 4: Register the Parser

Edit `packages/updater/src/parsers/index.ts`:

```typescript
import { MyBankParser } from "./my-bank.js";

export function createAllParsers(config: ParserConfig = {}): BankParser[] {
  return [
    // ... existing parsers
    new MyBankParser(config),
  ];
}

export { MyBankParser };
```

---

## Step 5: Write Tests

### File Location

```
packages/updater/src/parsers/{bank_id}.test.ts
```

### Test Template

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { MyBankParser } from "./my-bank.js";
import { BankId, CurrencyIndex, Segment, Channel, ProductType } from "@mejor-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/{bank_id}/rates.pdf");

describe("MyBankParser", () => {
  let result: Awaited<ReturnType<MyBankParser["parse"]>>;

  beforeAll(async () => {
    const parser = new MyBankParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return correct bank_id", () => {
    expect(result.bank_id).toBe(BankId.MY_BANK);
  });

  it("should extract expected number of offers", () => {
    expect(result.offers.length).toBeGreaterThanOrEqual(4);
  });

  it("should have no critical warnings", () => {
    const criticalWarnings = result.warnings.filter(
      (w) => !w.includes("expected") && !w.includes("Only extracted")
    );
    expect(criticalWarnings).toHaveLength(0);
  });

  it("should return a valid raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("UVR offers", () => {
    it("should extract VIS UVR rate", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBeCloseTo(6.6, 1); // adjust expected value
      }
    });
  });

  describe("COP offers", () => {
    it("should extract VIS COP rate", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBeCloseTo(12.15, 2); // adjust expected value
      }
    });
  });

  describe("common properties", () => {
    it("should set channel to UNSPECIFIED", () => {
      expect(result.offers.every((o) => o.channel === Channel.UNSPECIFIED)).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.url).toBeTruthy();
        expect(offer.source.retrieved_at).toBeTruthy();
      }
    });

    it("should generate unique stable IDs", () => {
      const ids = result.offers.map((o) => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      expect(ids.every((id) => id.length === 16)).toBe(true);
    });
  });
});
```

### Run Tests

```bash
pnpm --filter @mejor-tasa/updater test -- --run {bank_id}
```

---

## Step 6: Update PROGRESS.md

Mark the parser as complete:

```markdown
- [x] **BankName**: Implement PDF/HTML parsing (N tests)
```

Update the status line and test counts as appropriate.

---

## Checklist

- [ ] Fixture downloaded to `fixtures/{bank_id}/`
- [ ] Parser implemented in `packages/updater/src/parsers/{bank_id}.ts`
- [ ] Parser registered in `packages/updater/src/parsers/index.ts`
- [ ] Tests written in `packages/updater/src/parsers/{bank_id}.test.ts`
- [ ] All tests pass: `pnpm --filter @mejor-tasa/updater test -- --run`
- [ ] Type check passes: `pnpm typecheck`
- [ ] PROGRESS.md updated

---

## Reference Implementations

- **HTML parser**: `packages/updater/src/parsers/bancolombia.ts`
- **PDF parser**: `packages/updater/src/parsers/scotiabank.ts`

## Common Issues

### PDF returns 403 Forbidden

Some banks block automated requests. Try:

- Adding user-agent headers
- Downloading manually and using only fixtures for now
- Checking if the URL has changed

#### Itaú (Known Issue)

Itaú blocks all automated PDF downloads with 403 Forbidden. The parser is implemented but requires manual PDF download:

1. Visit https://banco.itau.co/web/personas/informacion-de-interes/tasas-y-tarifas
2. Download the "Tasas vigentes persona natural" PDF
3. Save it to `fixtures/itau/rates.pdf`

The parser will work with fixtures but live fetching is not possible.

### Colombian number formats

Use `parseColombianNumber()` which handles both `12,50` (comma decimal) and `12.50` (dot decimal).

### PDF text extraction order

PDF text may not extract in visual order. Join all pages and use regex patterns that account for variable whitespace.
