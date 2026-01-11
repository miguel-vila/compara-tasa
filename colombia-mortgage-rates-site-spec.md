# Colombia Mortgage Rates Aggregator — Implementation Spec (Scrapeable Banks)

**Document date:** 2026-01-10  
**Scope:** MVP covering banks with publicly scrapeable rate disclosures (HTML/PDF). Banks blocked by WAF/bot protection are listed under **Future work**.

---

## Spec

### Goal

Publish a consumer-facing site that consolidates publicly disclosed mortgage (Crédito Hipotecario) and leasing (Leasing Habitacional) interest rates for Colombia, highlights “best” rates by scenario, and preserves traceability (source + date).

### Non-goals (MVP)

- Real-time personalization for an individual borrower’s full underwriting profile.
- Calling bank simulators or authenticated flows.
- Guaranteeing final approved rate (site shows published reference rates and conditions).

### Core user experience (MVP)

#### 1) Home page: “Best rates” dashboard

Show cards/tiles for predefined “best” groupings, computed from the current dataset:

- **Best UVR spreads (Hipotecario)**
  - VIS UVR “desde” (lowest spread)
  - No VIS UVR “desde” (lowest spread)

- **Best COP fixed rates (Hipotecario, pesos)**
  - VIS COP “desde” (lowest E.A.)
  - No VIS COP “desde” (lowest E.A.)

- **Best payroll-deposit benefits**
  - Banks that explicitly publish payroll (“nómina”) discounts as basis-point reductions or separate rate tables.
  - Display as either:
    - Separate “with payroll” scenario rate, or
    - Base rate + rule “-X bps if payroll deposited”.

- **Best digital channel offers** (when disclosed separately)
  - Example: “Hipotecarios-Digital” lines in AV Villas rate sheet.

Each “best” card shows:

- Bank name + product name
- Rate (E.A. for pesos; “UVR + spread” for UVR)
- Segment (VIS / No VIS)
- Product type (Hipotecario / Leasing)
- Conditions badges (Payroll, Digital, etc.)
- “Valid as of” (best-effort from source)
- “Retrieved at” timestamp (when your script captured it)
- Link to a detail page for the offer + direct source document link

#### 2) Rates table (browse + filter)

A table listing all extracted offers with filters:

- Bank
- Product type: Hipotecario, Leasing
- Currency/index: COP (pesos), UVR
- Segment: VIS / No VIS
- Channel: Digital / Branch / Unspecified
- Condition: Payroll benefit available (yes/no/unknown)
- Term range (months) when disclosed
- Amount range when disclosed
- Rate type:
  - COP: fixed E.A. (and optional M.V. if provided)
  - UVR: “UVR + spread” (E.A. spread, and optional M.V. equivalent if provided)

Sorting:

- Default: lowest “desde” within the current filter context.
- For UVR: sort by spread ascending.
- For COP: sort by E.A. ascending.

#### 3) Offer detail page

For each offer:

- Normalized fields (rate, min/max, term, amount, channel, conditions)
- Source metadata (URL, document title if available, “valid from”, “retrieved at”)
- Raw excerpt (minimal, non-copyright-infringing snippet) or structured “source lines” mapping (see Technical Architecture)
- Caveats text:
  - “Published rates are reference and may vary by risk policy, LTV, term, and borrower profile.”
  - “Final rate is set at disbursement.”

#### 4) Transparency / methodology page

Explain:

- What “best” means (lowest published “desde” for a defined scenario)
- UVR vs COP not directly comparable without assumptions
- Update frequency
- Data sources and limitations

### Data quality rules (MVP)

- Always show:
  - `retrieved_at` (ISO timestamp)
  - `source_url`
  - `valid_from` when explicitly present (otherwise omit)
- If a bank provides only ranges (“desde/hasta”), treat “best” as “desde”.
- Never compute a single “best overall” mixing UVR and COP.
- Never infer payroll discounts unless explicitly published.

### Banks included (scrapeable in this MVP)

- **Bancolombia** (HTML table for rates + explicit payroll discount)
- **BBVA Colombia** (PDF with mortgage/leasing rate tables and payroll/non-payroll adjustments)
- **Scotiabank Colpatria** (PDF “Tasas y productos de crédito” with mortgage/leasing rows)
- **Banco Caja Social** (PDF “Tasas Crédito Vivienda” style disclosure)
- **Banco AV Villas** (PDF “Tasas activas / Tasas de crédito según línea y plazo” with Hipotecarios + Hipotecarios-Digital)
- **Banco Itaú Colombia** (PDF “Préstamos Persona Natural” with Hipotecario/Leasing sections)

### Future work (not in MVP)

- Banks with anti-bot/WAF blocks for automated collection (require partnerships, feeds, or manual ingestion):
  - Davivienda
  - Banco de Bogotá
  - Banco de Occidente
- Add structured fee capture (estudio, avalúo, seguros) and compute APR-equivalent per scenario.
- Add employer-agreement and payroll bank-account nuance beyond “payroll yes/no”.
- Add scenario calculator (loan amount, term, LTV) and show the best offers per scenario grid.

---

## Technical Architecture

### High-level architecture

**Goal:** Static frontend + thin data-serving layer. Update pipeline runs separately and publishes versioned datasets.

Recommended production layout:

1. **Updater / ETL (Node.js + TypeScript)**

- Scheduled job (GitHub Actions cron or a server scheduler).
- Pulls sources (HTML/PDF).
- Parses and normalizes into `Offer[]`.
- Produces:
  - `offers-latest.json` (full normalized dataset)
  - `rankings-latest.json` (precomputed “best” lists for homepage)
  - Optional: `sources-latest.json` (fetch logs, checksums, parse diagnostics)
- Writes to object storage (S3-compatible) or commits to a data repo.

2. **Data serving**
   Preferred: **No backend**. Serve JSON directly from CDN/object storage.

- URL examples:
  - `/data/offers-latest.json`
  - `/data/rankings-latest.json`

If you still want an “API endpoint”, implement a **thin edge worker** that proxies those objects and adds caching headers (Cloudflare Worker / Vercel Edge Function). Keep it read-only.

3. **Frontend (static site)**

- Fetches `rankings-latest.json` + `offers-latest.json` at runtime.
- Renders:
  - Best-rate cards (from rankings)
  - Table + filters (from offers)

### Suggested stack (sensible defaults)

#### Frontend

- **Next.js (React) + TypeScript**
  - Static assets + client-side fetch for JSON.
  - If deploying on Vercel, you can still treat it as static + edge caching.
- UI/UX:
  - `@tanstack/react-table` for the rates table.
  - `zod` for runtime validation of fetched JSON.
  - `date-fns` for date formatting.
  - Minimal CSS via `tailwindcss` or `vanilla-extract` (choose one; tailwind is fastest).

#### Data updater / ETL

- Node 20+, TypeScript.
- HTTP:
  - built-in `fetch` (Node 20) + retries with `p-retry`.
- HTML parsing:
  - `cheerio` for DOM extraction.
- PDF text extraction:
  - `pdfjs-dist` (extract text content reliably in JS/TS).
- Validation:
  - `zod` schemas for parsed intermediate + final dataset.
- Testing:
  - `vitest` for unit tests.
  - Store fixtures (downloaded PDFs/HTML snapshots) in `fixtures/`.
  - Snapshot tests on extracted offers.

#### Thin API (optional)

- Cloudflare Worker (TypeScript) or Vercel Edge Function:
  - Only serves `/api/offers` and `/api/rankings` by reading from object storage.
  - Adds long-lived cache headers + ETag.

### Data model

#### Core enums

- `BankId`: `"bancolombia" | "bbva" | "scotiabank_colpatria" | "banco_caja_social" | "avvillas" | "itau"`
- `ProductType`: `"hipotecario" | "leasing"`
- `CurrencyIndex`: `"COP" | "UVR"`
- `Segment`: `"VIS" | "NO_VIS" | "UNKNOWN"`
- `Channel`: `"DIGITAL" | "BRANCH" | "UNSPECIFIED"`

#### Normalized rate representation

Store both raw and normalized forms.

```ts
type RateBasis = "EA" | "MV";

type Rate =
  | {
      kind: "COP_FIXED";
      ea_percent_from: number; // e.g. 12.0
      ea_percent_to?: number; // optional
      mv_percent_from?: number; // optional if provided
      mv_percent_to?: number;
    }
  | {
      kind: "UVR_SPREAD";
      spread_ea_from: number; // e.g. 6.50 means "UVR + 6.50%"
      spread_ea_to?: number;
      spread_mv_from?: number; // optional if provided
      spread_mv_to?: number;
    };
```

#### Offer object

```ts
type Offer = {
  id: string; // stable hash from key fields + source
  bank_id: BankId;
  bank_name: string;

  product_type: ProductType; // hipotecario | leasing
  currency_index: CurrencyIndex; // COP | UVR
  segment: Segment; // VIS | NO_VIS | UNKNOWN
  channel: Channel; // DIGITAL | BRANCH | UNSPECIFIED

  // Rate
  rate: Rate;

  // Constraints (optional unless explicitly disclosed)
  term_months_min?: number;
  term_months_max?: number;
  amount_min_cop?: number;
  amount_max_cop?: number;

  // Conditions and rules
  conditions: {
    payroll_discount?: {
      type: "BPS_OFF" | "PERCENT_OFF";
      value: number; // e.g. 100 (bps) or 1.0 (%)
      applies_to: "RATE"; // future-proof (fees, etc.)
      note?: string;
    };
    notes?: string[]; // any important footnotes
  };

  // Provenance
  source: {
    url: string;
    source_type: "HTML" | "PDF";
    document_label?: string; // e.g. "Tasas y productos de crédito"
    valid_from?: string; // ISO date if present (YYYY-MM-DD)
    retrieved_at: string; // ISO timestamp
    extracted_text_fingerprint?: string; // hash for diffing
    extraction: {
      method: "CSS_SELECTOR" | "REGEX";
      locator: string; // selector or regex identifier
      excerpt?: string; // short snippet for debugging (keep small)
    };
  };
};
```

#### Rankings object (precomputed)

```ts
type ScenarioKey =
  | "best_uvr_vis_hipotecario"
  | "best_uvr_no_vis_hipotecario"
  | "best_cop_vis_hipotecario"
  | "best_cop_no_vis_hipotecario"
  | "best_payroll_benefit"
  | "best_digital_hipotecario";

type Rankings = {
  generated_at: string;
  scenarios: Record<
    ScenarioKey,
    {
      offer_id: string;
      metric: {
        kind: "EA_PERCENT" | "UVR_SPREAD_EA";
        value: number;
      };
    }
  >;
};
```

### “Best” computation logic (MVP)

- For COP offers: metric = `rate.ea_percent_from`.
- For UVR offers: metric = `rate.spread_ea_from`.
- Scenario filters:
  - UVR VIS hipotecario: `product_type=hipotecario`, `currency_index=UVR`, `segment=VIS`.
  - Digital: `channel=DIGITAL` and `product_type=hipotecario`.
  - Payroll: any offer where `conditions.payroll_discount` exists OR explicit payroll-benefit rate table exists.

### Storage format and deployment

#### Versioning

Publish every run as immutable:

- `offers-YYYY-MM-DDTHHMMSSZ.json`
- `rankings-YYYY-MM-DDTHHMMSSZ.json`

Then update pointers:

- `offers-latest.json`
- `rankings-latest.json`

#### Hosting

- Frontend: static hosting (Vercel / Cloudflare Pages / S3+CloudFront).
- Data: object storage + CDN. Set:
  - `Cache-Control: public, max-age=300` for `*-latest.json`
  - `Cache-Control: public, max-age=31536000, immutable` for versioned files

### Update job

Run daily (or weekly) at a fixed time.

Steps:

1. Fetch all sources to `./artifacts/raw/` (store HTTP status, headers, bytes, sha256).
2. Parse per-bank into intermediate rows.
3. Normalize to `Offer[]`.
4. Validate with `zod`.
5. Compute `Rankings`.
6. Write JSON outputs.
7. Publish to storage.
8. Emit a JSON log summarizing:
   - fetched bytes, last-modified, etag
   - number of offers per bank
   - parse warnings

### Scraping / extraction details by bank (URLs + parsing rules)

> Implementation note: keep each bank as an isolated module returning `Offer[]` + parse diagnostics. Do not mix parsing logic across banks.

---

#### 1) Bancolombia (HTML)

**Primary page (rates embedded as HTML table):**  
https://www.bancolombia.com/personas/creditos/vivienda/credito-hipotecario-para-comprar-vivienda citeturn4view0

**What to extract**
From “Tasas y tarifas”:

- UVR rates:
  - VIS: `UVR + 6.50%`
  - No VIS: `UVR + 8.00%`
- COP rates:
  - VIS: `12.00%` E.A. (also has MV)
  - No VIS: `12.00%` E.A.
- Payroll discount rule:
  - “descuento de 100 puntos básicos (1%)” for customers receiving payroll in Bancolombia (applies from 2025-03-14 per page text). citeturn4view0

**Parsing approach**

- Fetch HTML with standard GET.
- Use `cheerio` to locate the “Tasas para vivienda en UVR” and “Tasas para vivienda en pesos” sections.
- Extract the two-row table underneath each section (VIS/No VIS).
- Convert:
  - UVR + X,XX% → numeric spread in percent (`6.50`)
  - COP percent strings to floats, handling dot decimals.
- Create two offers per section (VIS and No VIS), `channel=UNSPECIFIED`, `product_type=hipotecario`.
- Attach `conditions.payroll_discount = { type: "PERCENT_OFF", value: 1.0 }` to each Bancolombia offer (or to a separate “rule” object if you prefer keeping base rate clean).

**Stability**
This is likely stable but still DOM-fragile. Protect with tests using saved HTML fixture and selectors.

---

#### 2) BBVA Colombia (PDF)

**Primary PDF (mortgage/leasing tables; payroll benefit and add-on bps for non-payroll):**  
https://www.bbva.com.co/content/dam/public-web/colombia/documents/home/prefooter/tarifas/DO-11-TASAS-VIVIENDA.pdf citeturn2view0

**What to extract (MVP subset)**

- Crédito Hipotecario:
  - VIS – Pesos: “TASA CON BENEFICIO CON CUENTA DE NÓMINA” with “Tasas desde …” and a note for “Créditos sin Cuenta de Nómina (+200pbs)”. citeturn2view0
  - VIS – UVR: “UVR + …”
  - NO VIS – Pesos: note “(+250pbs)” for non-payroll.
  - NO VIS – UVR: “UVR + …”
- Leasing Habitacional:
  - NO VIS – Pesos (and other rows present in the PDF)

**Parsing approach**

- Download PDF bytes.
- Use `pdfjs-dist` to extract text.
- Use deterministic regex blocks:
  - Identify section headers: “Crédito Hipotecario”, “Leasing Habitacional”.
  - Identify segment markers: “VIS - Pesos”, “VIS - UVR”, “NO VIS - Pesos”, etc.
  - Capture “Tasas desde” E.A. and UVR spread patterns:
    - COP: `(\d+,\d+)%` or `(\d+\.\d+)%` for E.A.
    - UVR: `UVR \+ (\d+,\d+)%`
- Convert commas to dots before parsing floats.
- Payroll rule extraction:
  - If PDF states a specific “(+200pbs)” for non-payroll, encode payroll as the _base_ and add a derived “no-payroll” variant if you want both scenarios.
  - Minimal MVP: store payroll as a condition rule with `BPS_OFF` only if the doc explicitly defines it; otherwise keep separate offers.

**Validity date**
PDF includes “VIGENTE DESDE …” in text header. Map it to `valid_from` (ISO) when present. citeturn2view0

---

#### 3) Scotiabank Colpatria (PDF)

**Primary PDF (“Tasas y productos crédito”, includes mortgage and leasing rows):**  
https://cdn.aglty.io/scotiabank-colombia/scotiabank-colpatria/pdf/tasas-y-tarifas/Tasas-y-productos-credito.pdf citeturn2view1

**What to extract**
Look for the “Hipotecario y leasing habitacional” section. Examples present:

- Crédito hipotecario vivienda en UVR NO VIS: `UVR + 7,60%` … `UVR + 7,80%`
- Crédito hipotecario vivienda en pesos NO VIS: `12,25%` … `12,45%`
- VIS rows using “valor comercial hasta 150 SMLV (VIS)” in UVR and pesos
- Leasing habitacional en pesos: `12,25%` … `12,45%` citeturn2view1

**Parsing approach**

- Extract text with `pdfjs-dist`.
- Find the block starting with “Hipotecario y leasing habitacional”.
- Parse each line matching:
  - `CREDITO HIPOTECARIO.*UVR.*(UVR \+ \d+,\d+%)`
  - `CREDITO HIPOTECARIO.*PESOS.*(\d+,\d+%)`
  - `CREDITOS LEASING.*PESOS.*(\d+,\d+%)`
- Map “(VIS)”/“hasta 150 SMLV (VIS)” to `segment=VIS`.
- Map “NO VIS” to `segment=NO_VIS`.
- For lines that include “Desde/Hasta”, populate `_from` and `_to`.
- This PDF is monthly labeled (e.g., “Enero … 2026” appears). Use that as `valid_from` only if an explicit day is present; otherwise omit and rely on `retrieved_at`.

---

#### 4) Banco Caja Social (PDF)

**Primary PDF:**  
https://www.bancocajasocial.com/content/dam/bcs/documentos/informacion-corporativa/tasas-precios-y-comisiones/credito-vivienda/Tasas-Credito-Vivienda.pdf citeturn6view0

**What to extract**
From the 1-page disclosure:

- “Vigentes a partir del …” (validity date).
- VIS and NO VIS rows with:
  - COP E.A. / M.V. “Desde/Hasta”
  - UVR + spread “Desde/Hasta” (and sometimes MV equivalents) citeturn6view0

**Parsing approach**

- Use `pdfjs-dist` text extraction.
- This PDF’s text is compact; use regex keyed off:
  - `Vigentes a partir del (\d{2}-\w{3}-\d{4})`
  - Row starts: `VIS` and `NO VIS`
  - Column order: the PDF indicates “PESOS UVR PESOS UVR” and “Desde Hasta” in the footer. citeturn6view0
- Implement a bank-specific parser:
  - Split by line breaks.
  - For the `VIS` line, extract four rate “cells” in order and map them to:
    - COP from/to (E.A. + optional M.V.)
    - UVR spread from/to (E.A. spread + optional M.V. spread)
- If the PDF’s structure changes, fail with a clear parse error and preserve raw text in logs.

**Tooling caveat**
In the current research environment, PDF screenshots failed due to a tool validation error; parsing guidance here is based on extracted text. Keep fixtures for regression testing.

---

#### 5) Banco AV Villas (PDF)

**Entry page with stable link to the current “Tasas de Crédito Según Línea y Plazo”:**  
https://www.avvillas.com.co/credito-hipotecario citeturn8view0

**Current PDF (as linked on that page):**  
https://www.avvillas.com.co/documents/37648/10212085/Tasas%2BActivas%2B02%2BEnero%2B2026.pdf/8b05999b-577b-efed-e7e4-12280dd0b9a6?t=1767383069074 citeturn9view0

**What to extract**
From page 0, section “Créditos Hipotecarios”:

- UVR spreads for VIS and NO VIS (from/to)
- COP rates for NO VIS (from/to) in same row group citeturn9view0

From “Créditos Hipotecarios-Digital”:

- COP “Desde” for VIS and NO VIS (single value)
- Additional UVR and COP ranges under “VIS/NO VIS” citeturn9view0

Optional (MVP+):

- Leasing Habitacional lines exist but are less structured across pages; only implement once you confirm consistent placement.

**Parsing approach**

- Extract text with `pdfjs-dist`.
- Page 0 contains the key mortgage blocks; parse by locating:
  - “Créditos Hipotecarios”
  - “Créditos Hipotecarios-Digital”
- Parse structured lines like:
  - `VIS UVR \+ (\d+,\d+)% UVR \+ (\d+,\d+)%`
  - `NO VIS UVR \+ (\d+,\d+)% UVR \+ (\d+,\d+)%`
  - `VIS (\d+,\d+)% E\.A\.` (for digital “Desde”)
- Normalize:
  - Create one offer per combination: (segment, currency_index, channel, product_type=hipotecario).
  - For “Digital” rows: `channel=DIGITAL`.

**Stability**
AV Villas provides a “current” PDF linked from an HTML page. Your updater should:

- Fetch the HTML page.
- Discover the PDF link dynamically (avoid hardcoding the `t=` query param).
- Then fetch the PDF.

---

#### 6) Banco Itaú Colombia (PDF)

**Example current disclosure (Dec 2025; treat as latest until a newer doc is found):**  
https://banco.itau.co/documents/d/personas/tasas-vigentes-pn-color-01-dic-2025 citeturn2view4

**What to extract**
From sections:

- “Crédito hipotecario”:
  - Adquisición vivienda nueva y usada: E.A. from/to, MV from/to
  - Compra de cartera, Remodelación (each as separate offers or a single “purpose” dimension)
- “Leasing habitacional”:
  - Adquisición vivienda nueva y usada
  - Recolocación citeturn2view4

**Parsing approach**

- Extract text with `pdfjs-dist`.
- Find headings:
  - “Crédito hipotecario”
  - “Leasing habitacional”
- Parse each “PRODUCTO … Desde … Hasta …” row. citeturn2view4
- Map:
  - product_type = hipotecario or leasing by current section.
  - segment: not explicitly VIS/No VIS in this doc excerpt; set `UNKNOWN` unless present.
  - currency_index: COP (rates are E.A./M.V. percentages, not UVR spreads).
- For MVP homepage, include Itaú in COP “best” only where segment is comparable (UNKNOWN can be excluded from VIS/No VIS leaderboards, but still appears in the table).

---

### Implementation guidance: repo layout

```
repo/
  apps/
    web/                     # Next.js frontend
    api/                     # optional worker (or omit)
  packages/
    core/                    # shared types + zod schemas
    updater/                 # ETL/scraper
  data/                      # generated JSON (optional if stored elsewhere)
  fixtures/
    bancolombia/...
    bbva/...
    scotiabank_colpatria/...
    banco_caja_social/...
    avvillas/...
    itau/...
```

### Parsing utilities (recommended)

- Locale number parsing:
  - Replace `.` thousands separators if present.
  - Replace decimal comma `,` with `.`.
  - Strip `%`.
- UVR spread parsing:
  - Accept patterns: `UVR + 6,50%`, `5.15% + UVR`, `0.42% + UVR` (Caja Social format includes both). citeturn6view0
  - Normalize to `spread_ea_from` (E.A. spread).

### Reliability guardrails

- Every bank parser must:
  - Return `offers` + `warnings` + `raw_text_hash`.
  - Fail loudly if:
    - Offers drop to 0 unexpectedly.
    - A required section header is missing.
- Maintain fixtures and CI tests to detect bank format changes.

### Legal / operational notes (engineering-relevant)

- Respect cache headers and reasonable request rates.
- Store and surface “validity” and “retrieval” timestamps.
- Keep raw documents in cold storage for audit (optional but recommended).
- Add a site-wide disclaimer that rates are reference and final approval depends on underwriting.

---

**End of document.**
