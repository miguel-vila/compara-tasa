# Skill: Add a New Savings Account Parser

This skill guides you through adding a new bank parser to extract savings account rates for the ComparaTasa aggregator.

## Prerequisites

- The bank must be listed in the `BankId` enum in `packages/core/src/enums.ts`
- The bank must have a URL in `BankSavingsUrls` map in `packages/core/src/enums.ts`
- You need the bank's public savings rate disclosure URL (HTML or PDF)

## Steps Overview

1. Download a fixture file for testing
2. Analyze the source structure (HTML or PDF)
3. Implement the parser
4. Register the parser
5. Write tests
6. Update PROGRESS-SAVINGS.md

---

## Step 1: Download a Fixture File

Fixtures are saved copies of bank rate pages used for testing.

### Location

```
fixtures/{bank_id}/savings-page.html   # For HTML sources
fixtures/{bank_id}/savings-page.pdf    # For PDF sources
```

Where `{bank_id}` matches the enum value in lowercase (e.g., `ban100`, `bbva`).

### Download Command (HTML)

```bash
mkdir -p fixtures/{bank_id}
curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  -o fixtures/{bank_id}/savings-page.html "https://example.com/savings-rates"
```

### Download Command (PDF)

```bash
mkdir -p fixtures/{bank_id}
curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  -o fixtures/{bank_id}/savings-page.pdf "https://example.com/savings-rates.pdf"
```

**Note:** Always use a browser user-agent. Many banks block default curl/wget requests.

---

## Step 2: Analyze the Source Structure

### For HTML Sources

Use browser dev tools to identify:

- CSS selectors for rate tables
- Section headers that identify account types
- Rate value patterns (look for "% E.A." or "% EA")
- Amount tiers (min/max amounts for different rates)

### For PDF Sources

**Important:** PDF text extraction produces different output than what you see visually. Always extract and examine the actual text before writing regex patterns.

To debug PDF text structure, run this in the updater package:

```bash
cd packages/updater && node --input-type=module -e "
import fs from 'fs';
const pdfjs = await import('pdfjs-dist');

const pdfBuffer = fs.readFileSync('../../fixtures/{bank_id}/savings-page.pdf');
const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;

for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  const text = content.items.map(item => 'str' in item ? item.str : '').join(' ');
  console.log('=== PAGE ' + i + ' ===');
  console.log(text);
}
"
```

**PDF text quirks to watch for:**

- Amounts may have unexpected formatting (e.g., BBVA uses `-$ 1- -$ 4.999.999-` with dashes)
- Tables become space-separated text, losing column alignment
- Sections may span multiple pages - combine page text before parsing
- Headers and footers may appear inline with content

### Common Patterns

**Tiered rates (different rates for different balances):**

```
$1 - $10,000,000: 6.50% E.A.
$10,000,001 - $30,000,000: 9.50% E.A.
$30,000,001+: 10.00% E.A.
```

**Single rate (same rate for all balances):**

```
Tasa de interés: 6.00% E.A.
```

---

## Step 3: Implement the Parser

### File Location

```
packages/updater/src/parsers/savings/{bank_id}.ts
```

### HTML Parser Template

```typescript
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
import { fetchWithRetry, sha256, generateSavingsOfferId } from "../../utils/index.js";
import type { BankSavingsParser, SavingsParserConfig } from "./types.js";

const SOURCE_URL = "https://example.com/savings-rates";

export class MyBankParser implements BankSavingsParser {
  bankId = BankId.MY_BANK;
  sourceUrl = SOURCE_URL;

  constructor(private config: SavingsParserConfig = {}) {}

  async parse(): Promise<BankSavingsParseResult> {
    const warnings: string[] = [];
    const offers: SavingsOffer[] = [];
    const retrievedAt = new Date().toISOString();

    // Fetch HTML (from fixture or live)
    let html: string;
    if (this.config.useFixtures && this.config.fixturesPath) {
      html = await readFile(this.config.fixturesPath, "utf-8");
    } else {
      const result = await fetchWithRetry(this.sourceUrl, {
        useBrowserUserAgent: true, // Set to true if bank blocks default user-agent
      });
      html = result.content.toString("utf-8");
    }

    const rawTextHash = sha256(html);
    const $ = cheerio.load(html);

    // === PARSING LOGIC HERE ===
    // Find tables/divs with rate information
    // Extract account type, rates, and amount tiers

    // Validate we got expected offers
    if (offers.length === 0) {
      throw new Error("No offers extracted - page structure may have changed");
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
```

### PDF Parser Template

```typescript
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

const SOURCE_URL = "https://example.com/savings-rates.pdf";

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

export class MyBankParser implements BankSavingsParser {
  bankId = BankId.MY_BANK;
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
    const fullText = pageTexts.join(" "); // Combine pages for cross-page sections

    // Verify document header
    if (!/EXPECTED_HEADER_TEXT/i.test(fullText)) {
      throw new Error("Could not find expected header - PDF structure may have changed");
    }

    // === PARSING LOGIC HERE ===
    // Use regex to extract sections and rates from fullText
    // Example: const sectionMatch = fullText.match(/Account\s+Name[\s\S]*?NEXT_SECTION/i);

    // Validate we got expected offers
    if (offers.length === 0) {
      throw new Error("No offers extracted - PDF structure may have changed");
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}
```

### Creating a Savings Offer

```typescript
const offer: SavingsOffer = {
  id: generateSavingsOfferId({
    bank_id: this.bankId,
    account_type: SavingsAccountType.HIGH_YIELD,
    account_name: "Cuenta de Alto Rendimiento",
    ea_percent: 10.0,
    min_amount_cop: 1,
  }),
  bank_id: this.bankId,
  bank_name: BankNames[this.bankId],
  account_type: SavingsAccountType.HIGH_YIELD,
  account_name: "Cuenta de Alto Rendimiento",
  rate: { ea_percent: 10.0 },
  min_amount_cop: 1,
  max_amount_cop: 10_000_000, // optional - omit if no upper limit
  source: {
    url: this.sourceUrl,
    source_type: SourceType.HTML,
    document_label: "Cuenta de Ahorro",
    retrieved_at: retrievedAt,
    extracted_text_fingerprint: rawTextHash,
    extraction: {
      method: ExtractionMethod.CSS_SELECTOR,
      locator: "table.rates tbody tr",
      excerpt: "$1 - $10,000,000: 10.00% E.A.",
    },
  },
};
```

### Account Types

Use `SavingsAccountType` enum from `@compara-tasa/core`:

```typescript
SavingsAccountType.STANDARD; // Regular savings account
SavingsAccountType.HIGH_YIELD; // High-yield/premium account
SavingsAccountType.DIGITAL; // Digital-only account
```

### Utility Functions

```typescript
import {
  sha256, // Hash content for fingerprinting
  generateSavingsOfferId, // Generate stable offer ID
  fetchWithRetry, // Fetch with retry logic
  parseColombianNumber, // Parse "12,50" -> 12.5 or "12.50" -> 12.5
} from "../../utils/index.js";
```

### Parsing Colombian Number Formats

**Amounts (use periods as thousand separators):**

```typescript
function parseColombianAmount(text: string): number {
  // "$10.000.000" -> 10000000
  const cleaned = text.replace(/[$\s]/g, "").replace(/\./g, "");
  return parseInt(cleaned, 10);
}
```

**Percentages (use comma as decimal separator):**

```typescript
function parseColombianPercent(text: string): number {
  // "6,50% E.A." -> 6.5
  const match = text.match(/(\d+),(\d+)\s*%/);
  if (!match) throw new Error(`Failed to parse: ${text}`);
  return parseFloat(`${match[1]}.${match[2]}`);
}
```

---

## Step 4: Register the Parser

Edit `packages/updater/src/parsers/savings/index.ts`:

```typescript
import { MyBankParser } from "./my-bank.js";

export function createAllSavingsParsers(config: SavingsParserConfig = {}): BankSavingsParser[] {
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
packages/updater/src/parsers/savings/{bank_id}.test.ts
```

### Test Template

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { MyBankParser } from "./my-bank.js";
import { BankId, SavingsAccountType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../../fixtures/{bank_id}/savings-page.html");

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
    expect(result.offers.length).toBeGreaterThanOrEqual(1);
  });

  it("should have no critical warnings", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("should return a valid raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("high yield account", () => {
    it("should extract highest tier rate", () => {
      const offer = result.offers.find(
        (o) => o.account_type === SavingsAccountType.HIGH_YIELD && !o.max_amount_cop
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBeCloseTo(10.0, 1);
    });
  });

  describe("common properties", () => {
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
pnpm --filter @compara-tasa/updater test -- --run savings/{bank_id}
```

---

## Step 6: Update PROGRESS-SAVINGS.md

Add the new bank to the completed tasks:

```markdown
- [x] **BankName**: Implement HTML parsing (N tests)
```

---

## Checklist

- [ ] Bank added to `BankId` enum (if new)
- [ ] Bank URL added to `BankSavingsUrls` map
- [ ] Fixture downloaded to `fixtures/{bank_id}/savings-page.html` or `.pdf`
- [ ] (PDF only) Debug PDF text to understand actual format before writing regex
- [ ] Parser implemented in `packages/updater/src/parsers/savings/{bank_id}.ts`
- [ ] Parser registered in `packages/updater/src/parsers/savings/index.ts`
- [ ] Tests written in `packages/updater/src/parsers/savings/{bank_id}.test.ts`
- [ ] All tests pass: `pnpm --filter @compara-tasa/updater test -- --run savings`
- [ ] Type check passes: `pnpm typecheck`
- [ ] PROGRESS-SAVINGS.md updated
- [ ] Commit with message: `feat: add savings parser for BankName`

---

## Reference Implementations

### HTML Parsing (Ban100)

See `packages/updater/src/parsers/savings/ban100.ts` for a complete example that handles:

- Multiple account types (high-yield and standard)
- Tiered rates based on balance amounts
- Colombian number format parsing
- cheerio CSS selectors

### PDF Parsing (BBVA)

See `packages/updater/src/parsers/savings/bbva.ts` for a complete example that handles:

- PDF text extraction with pdfjs-dist
- Multiple account types (7 different products)
- Complex tiered rate structures (up to 7 tiers)
- Cross-page section parsing
- PDF-specific text format quirks (e.g., `-$ 1- -$ 4.999.999-`)

### Playwright + Cloudflare Bypass (Lulo Bank)

See `packages/updater/src/parsers/savings/lulo.ts` for a complete example that handles:

- Cloudflare-protected Zendesk help pages
- Playwright with stealth plugin for bot detection bypass
- cheerio parsing of the rendered HTML
- Multiple rate tiers (regular vs Lulo Pro customers)
- Regex extraction from article body text

---

## Common Issues

### SPA/JavaScript-rendered pages

Some banks (RappiPay, Pibank, Nu) use Single Page Applications where rates are loaded via JavaScript. For these:

1. **Check for API endpoints** in browser DevTools Network tab - sometimes rates come from a JSON API
2. **Use Playwright** to render the page and extract rates after JavaScript execution
3. **Check Zendesk/help articles** - some banks publish rates in support articles (e.g., Lulo Bank)

### Rate not visible in source

If `curl` doesn't show the rates but they appear in browser:

1. The page likely uses JavaScript rendering
2. Try finding the underlying API that provides the rate data
3. Use Playwright with stealth plugin as last resort

### Multiple account products

Create separate offers for each account type. Use the `account_name` field to distinguish between products from the same bank.

### Cloudflare-protected Zendesk help pages (e.g., Lulo Bank)

Lulo Bank's help center (ayuda.lulobank.com) is behind Cloudflare protection. Regular HTTP requests fail with 403 errors. The solution:

1. **Use Playwright with stealth plugin** - already configured in the project:

   ```typescript
   import { chromium } from "playwright-extra";
   import StealthPlugin from "puppeteer-extra-plugin-stealth";
   chromium.use(StealthPlugin());
   ```

2. **Wait for content** - Zendesk pages load content dynamically:

   ```typescript
   await page.waitForSelector(".article-body", { timeout: 30000 });
   ```

3. **Rate information location** - Lulo Bank rates are found in the `.article-body` div of their Zendesk help articles.

See `packages/updater/src/parsers/savings/lulo.ts` for a complete implementation example.

### PDFs that appear image-based but are actually text-based (e.g., Banco Caja Social)

Some bank PDFs may visually appear to be image-based (scanned documents) but actually contain extractable text. Always try `pdfjs-dist` extraction first before assuming OCR is needed. The Banco Caja Social Alcancía PDF is an example - it looks like a styled image but `pdfjs-dist` successfully extracts the text.

See `packages/updater/src/parsers/savings/caja_social.ts` for a complete implementation example.
