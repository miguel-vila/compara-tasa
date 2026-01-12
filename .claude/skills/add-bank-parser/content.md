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

## Step 0: Find a Stable URL

Before downloading fixtures, investigate the bank's URL structure to find the most stable endpoint.

### URL Stability Guidelines

**Prefer (most stable):**

- Semantic paths: `/documents/d/guest/tasas-tarifas`
- Content delivery endpoints: `/documents/`, `/assets/`, `/files/`
- Simple filenames: `rates.pdf`, `tasas.pdf`

**Avoid (less stable):**

- UUID-based paths: `/wps/wcm/connect/personas/5f45e48c-8e91-49f2-b85e-71c14b09512b/...`
- Date-stamped filenames: `TASAS+TARIFAS+14+08+2025.pdf`
- Session-based URLs with tokens

### How to Find Stable URLs

1. **Check the bank's footer or "Tasas y Tarifas" page** for direct PDF links
2. **Use web search** to find indexed PDF URLs: `site:bankname.com tasas tarifas filetype:pdf`
3. **Inspect network requests** in browser DevTools when downloading the PDF manually
4. **Look for `/documents/d/guest/` patterns** (Liferay) or similar CMS document endpoints

### Example: Davivienda

- ❌ Unstable: `https://www.davivienda.com/wps/wcm/connect/personas/5f45e48c-8e91-49f2-b85e-71c14b09512b/TASAS+TARIFAS+DAVIVIENDA+02+09+2025.pdf`
- ✅ Stable: `https://www.davivienda.com/documents/d/guest/tasas-tarifas-davivienda`

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
curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  -o fixtures/{bank_id}/rates-page.html "https://example.com/rates-page"
```

### For PDF sources

```bash
mkdir -p fixtures/{bank_id}
curl -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  -o fixtures/{bank_id}/rates.pdf "https://example.com/rates.pdf"
```

**Note:** Always use a browser user-agent (`-A "Mozilla/5.0..."`) when downloading fixtures. Many banks block requests with default curl/wget user-agents.

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
      // Use browser user-agent if the bank blocks automated requests
      const result = await fetchWithRetry(this.sourceUrl, {
        useBrowserUserAgent: true, // Set to true if bank blocks default user-agent
      });
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

- [ ] Stable URL identified (avoid UUIDs, date-stamped filenames)
- [ ] Fixture downloaded to `fixtures/{bank_id}/` (using browser user-agent)
- [ ] Parser implemented in `packages/updater/src/parsers/{bank_id}.ts`
- [ ] Parser uses `useBrowserUserAgent: true` if needed
- [ ] If 403 persists, check for CloudFront WAF and use Playwright + stealth plugin
- [ ] Parser registered in `packages/updater/src/parsers/index.ts`
- [ ] Tests written in `packages/updater/src/parsers/{bank_id}.test.ts`
- [ ] All tests pass: `pnpm --filter @mejor-tasa/updater test -- --run`
- [ ] Type check passes: `pnpm typecheck`
- [ ] PROGRESS.md updated (note if browser user-agent or Playwright required)

---

## Reference Implementations

- **HTML parser**: `packages/updater/src/parsers/bancolombia.ts`
- **PDF parser**: `packages/updater/src/parsers/scotiabank.ts`

## Common Issues

### PDF returns 403 Forbidden or Bot Protection (Incapsula, Cloudflare, etc.)

Many banks use bot protection services. Here's how to work around them:

#### 1. Use Browser User-Agent (Most Common Fix)

Pass `useBrowserUserAgent: true` to `fetchWithRetry`:

```typescript
const result = await fetchWithRetry(SOURCE_URL, {
  useBrowserUserAgent: true, // Uses Chrome user-agent instead of "MejorTasa/1.0"
});
```

This works for: Banco de Bogotá, Banco de Occidente, Davivienda

#### 2. Find Alternative URLs

Bot protection often only applies to landing pages, not direct document URLs:

- **Landing page (protected):** `https://bank.com/tasas-y-tarifas` → Blocked by Incapsula
- **Direct PDF (unprotected):** `https://bank.com/documents/d/guest/tasas` → Works!

Use web search to find direct document URLs that bypass the protected pages.

#### 3. Manual Download Only (Last Resort)

If all else fails, download fixtures manually and document this limitation.

#### 4. CloudFront WAF Protection (Advanced)

Some banks use AWS CloudFront with WAF rules that block all automated requests, even with browser user-agents. Signs of CloudFront blocking:

- 403 response with HTML body mentioning "CloudFront"
- Error message: "Request blocked. We can't connect to the server..."
- Request ID starting with random characters

**Solution: Use `playwright-extra` with stealth plugin**

```typescript
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Apply stealth plugin ONCE at module level
chromium.use(StealthPlugin());

async function fetchPdfWithPlaywright(url: string, mainPageUrl: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: "es-CO",
      acceptDownloads: true,
    });
    const page = await context.newPage();

    // IMPORTANT: Visit main page first to establish session/cookies
    const mainResponse = await page.goto(mainPageUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    if (!mainResponse?.ok()) {
      throw new Error(`Failed to load main page: HTTP ${mainResponse?.status()}`);
    }

    // Brief wait before navigating to PDF
    await page.waitForTimeout(1000);

    // Handle both inline PDFs and download-triggered PDFs
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
    const [response, download] = await Promise.all([
      page.goto(url, { waitUntil: "commit", timeout: 30000 }).catch(() => null),
      downloadPromise,
    ]);

    // If download triggered, read from temp file
    if (download) {
      const path = await download.path();
      if (!path) throw new Error("Download failed");
      const { readFile } = await import("fs/promises");
      return await readFile(path);
    }

    // Otherwise read from response
    if (!response?.ok()) {
      throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
    }
    return await response.body();
  } finally {
    await browser.close();
  }
}
```

**Key points:**

- The stealth plugin patches browser fingerprinting detection
- Must visit main page first to get valid session cookies
- Some banks trigger downloads instead of inline PDF display - handle both cases
- Use `headless: true` for CI/automated runs

**Dependencies to add:**

```bash
pnpm --filter @mejor-tasa/updater add playwright playwright-extra puppeteer-extra-plugin-stealth
npx playwright install chromium
```

#### Known Banks Requiring Workarounds

| Bank               | Issue                         | Solution                                           |
| ------------------ | ----------------------------- | -------------------------------------------------- |
| Itaú               | 403 on all automated requests | Manual PDF download only                           |
| Banco de Bogotá    | CloudFront WAF                | Playwright + stealth plugin                        |
| Banco de Occidente | CloudFront WAF + download     | Playwright + stealth plugin + download handling    |
| Davivienda         | Incapsula on landing page     | Use `/documents/d/guest/` URL + browser user-agent |

### Colombian number formats

Use `parseColombianNumber()` which handles both `12,50` (comma decimal) and `12.50` (dot decimal).

### PDF text extraction order

PDF text may not extract in visual order. Join all pages and use regex patterns that account for variable whitespace.
