# Mortgage Rates Feature

## Overview

The mortgage rates feature scrapes publicly disclosed mortgage interest rates from 13 Colombian banks and presents them on a consumer-facing comparison site. Colombian banks are required by the Superintendencia Financiera to disclose their rates, and most publish them as HTML pages or downloadable PDFs.

The ETL pipeline (`pnpm update-mortgage-rates`) runs each bank parser sequentially, aggregates all offers, validates them with Zod schemas, computes precomputed rankings for common scenarios, and writes the results as JSON files consumed by the Next.js frontend.

## Segmentation Dimensions

Each mortgage offer is classified along several dimensions that allow consumers to find the most relevant comparison:

### Product Type

- **Hipotecario** (traditional mortgage): The standard mortgage product. The borrower owns the property and makes loan payments.
- **Leasing Habitacional** (housing leasing): The bank owns the property and leases it to the borrower, who has an option to purchase at the end of the term. Lower initial costs but different tax treatment.

### Currency Index

- **COP (Colombian Pesos)**: Fixed-rate loans denominated in pesos. The rate is expressed as an E.A. (Effective Annual) percentage. These are simpler to understand but typically have higher nominal rates.
- **UVR (Unidad de Valor Real)**: Inflation-indexed loans. The rate is expressed as a spread above UVR (e.g., "UVR + 6.50% E.A."). The actual cost depends on inflation. These tend to have lower nominal spreads but carry inflation risk.

### Housing Segment

- **VIS (Vivienda de Interes Social)**: Social interest housing, capped at 150 SMLV (minimum monthly wages) in property value. Banks typically offer lower rates for VIS as a regulatory incentive.
- **NO_VIS**: Higher-value properties above the VIS threshold. Rates are generally higher.
- **UNKNOWN**: Used when a bank does not explicitly differentiate between VIS and NO_VIS.

### Distribution Channel

- **DIGITAL**: Rate offered through the bank's digital/online channel. Some banks (e.g., AV Villas) offer significantly lower rates for digital origination.
- **BRANCH**: In-person branch channel, sometimes with membership-based discounts.
- **UNSPECIFIED**: The bank does not distinguish by channel.

### Payroll Discount

Some banks offer preferential rates to customers who receive their salary through that bank ("cuenta de nomina"). This is modeled as a `PayrollDiscount` condition on the offer, with the discount expressed as either:

- **BPS_OFF**: Basis points subtracted from the rate (e.g., 200 bps off).
- **PERCENT_OFF**: A percentage reduction (e.g., 1.0% off).

## Ranking Scenarios

The system precomputes top-3 rankings for 9 scenarios. For mortgage rankings, **lower rates are better**:

| Scenario                      | Product     | Currency | Segment | Payroll |
| ----------------------------- | ----------- | -------- | ------- | ------- |
| `best_uvr_vis_hipotecario`    | Hipotecario | UVR      | VIS     | No      |
| `best_uvr_no_vis_hipotecario` | Hipotecario | UVR      | NO_VIS  | No      |
| `best_cop_vis_hipotecario`    | Hipotecario | COP      | VIS     | No      |
| `best_cop_no_vis_hipotecario` | Hipotecario | COP      | NO_VIS  | No      |
| `best_uvr_vis_payroll`        | Hipotecario | UVR      | VIS     | Yes     |
| `best_uvr_no_vis_payroll`     | Hipotecario | UVR      | NO_VIS  | Yes     |
| `best_cop_vis_payroll`        | Hipotecario | COP      | VIS     | Yes     |
| `best_cop_no_vis_payroll`     | Hipotecario | COP      | NO_VIS  | Yes     |
| `best_digital_hipotecario`    | Hipotecario | Any      | Any     | Any     |

## Bank Parsers

All parsers implement the `BankMortgageParser` interface, which requires a `bankId`, a `sourceUrl`, and a `parse()` method returning `BankMortgageParseResult`. Every parser supports a fixture mode for testing (reading from saved HTML/PDF files instead of fetching live).

---

### Bancolombia

- **Source**: HTML page
- **URL**: Product landing page for "Credito hipotecario para comprar vivienda"
- **Extraction**: CSS selectors + Cheerio. Locates the `#detalles-tasas-tarifas` section, iterates over `<h3>` headers to identify UVR vs. COP tables, then parses `<tbody>` rows to extract VIS/NO_VIS rates.
- **Products extracted**: Hipotecario (VIS/NO_VIS x COP/UVR) = 4 offers.
- **Payroll**: All offers include a 1.0% payroll discount for customers with nomina at Bancolombia.
- **Fetching**: Standard HTTP fetch via `fetchWithRetry`.

---

### BBVA Colombia

- **Source**: PDF document
- **URL**: Direct link to the "Tasas de interes lineas de vivienda" PDF.
- **Extraction**: `pdfjs-dist` for text extraction, then regex matching. The PDF is organized into clearly labeled sections ("VIS - Pesos", "VIS - UVR", "NO VIS - Pesos", "NO VIS - UVR", "Leasing Habitacional"). Each section's "Tradicional" rate line is matched via regex.
- **Products extracted**: Hipotecario (VIS/NO_VIS x COP/UVR) + Leasing (VIS/NO_VIS x COP) = up to 6 offers.
- **Payroll**: Each product has a specific BPS discount (150-250 bps depending on segment). The advertised rate includes the payroll benefit; without payroll the rate is higher by the stated amount.
- **Fetching**: Standard HTTP fetch via `fetchWithRetry`.

---

### Scotiabank Colpatria

- **Source**: PDF document
- **URL**: Direct link to "Tasas y productos de credito" PDF hosted on their CDN.
- **Extraction**: `pdfjs-dist` + regex. Looks for the "Hipotecario y leasing habitacional" section, then matches specific product line patterns like "CREDITO HIPOTECARIO VIVIENDA EN UVR NO VIS" followed by from/to rate pairs.
- **Products extracted**: Hipotecario (VIS/NO_VIS x COP/UVR) + Leasing COP = up to 5 offers. Rates are expressed as from/to ranges.
- **Payroll**: No payroll discount modeled.
- **Fetching**: Standard HTTP fetch via `fetchWithRetry`.

---

### Banco Caja Social

- **Source**: PDF document
- **URL**: Direct link to "Tasas Credito Vivienda" PDF.
- **Extraction**: `pdfjs-dist` + regex. The PDF has a table format with VIS and NO VIS rows, each containing 8 values: COP from/monthly, UVR from/monthly, COP to/monthly, UVR to/monthly. Two large regex patterns capture the full VIS and NO VIS rows respectively.
- **Products extracted**: Hipotecario (VIS/NO_VIS x COP/UVR) = 4 offers. Includes both E.A. and M.V. (monthly) rates, plus from/to ranges.
- **Payroll**: No payroll discount modeled.
- **Fetching**: Standard HTTP fetch via `fetchWithRetry`.

---

### AV Villas

- **Source**: PDF document (discovered dynamically)
- **URL**: Landing page at `avvillas.com.co/credito-hipotecario`. The parser first fetches the landing page HTML, scans for PDF links matching "tasas", and follows the discovered URL to fetch the actual PDF.
- **Extraction**: `pdfjs-dist` + regex. Parses three distinct sections within the PDF:
  1. **Standard Hipotecario**: VIS UVR, NO_VIS UVR, NO_VIS COP (no VIS COP in standard).
  2. **Leasing Habitacional**: A single UVR rate for all segments.
  3. **Hipotecarios-Digital**: VIS COP, NO_VIS COP, and a shared VIS/NO_VIS UVR rate.
- **Products extracted**: ~8 offers covering hipotecario, leasing, and digital channels.
- **Payroll**: No payroll discount modeled.
- **Fetching**: Two-step fetch -- landing page HTML (to discover PDF URL) then the PDF itself. Both via `fetchWithRetry`.
- **Notable**: Only bank with explicit **digital channel** rates, which are typically substantially lower than branch rates.

---

### Itau Colombia

- **Source**: PDF document (fixture-only)
- **URL**: Landing page at `banco.itau.co`. However, direct PDF downloads return HTTP 403.
- **Extraction**: `pdfjs-dist` + regex. The PDF has spacing artifacts between digits (e.g., "1 3 , 1 4 0" instead of "13,140"), which the parser handles by stripping whitespace before parsing. Looks for "Adquisicion de vivienda nueva y usada" patterns with "Desde X% Hasta Y%" format.
- **Products extracted**: Hipotecario COP + Leasing COP = 2 offers. Itau only offers COP-denominated products (no UVR) and does not differentiate VIS/NO_VIS.
- **Payroll**: No payroll discount modeled.
- **Fetching**: Always uses fixtures. The PDF must be manually downloaded and saved to `fixtures/itau/rates.pdf`. The parser checks for file existence and warns if missing.
- **Notable**: The only parser that **cannot fetch live** due to bot protection.

---

### Fondo Nacional del Ahorro (FNA)

- **Source**: HTML page
- **URL**: `fna.gov.co/sobre-el-fna/tasas`
- **Extraction**: CSS selectors + Cheerio. Finds all `table.table-bordered` elements and reads their `<caption>` headers to determine funding source (Cesantias vs. AVC), currency (UVR vs. COP), and product type (Hipotecario vs. Leasing). Rate rows are segmented by income range (0-2 SMLV, 2-4 SMLV, 4+ SMLV).
- **Products extracted**: Multiple tables yield many raw offers, which are then **deduplicated** by keeping only the best rate per (product_type, currency_index, segment) combination. The 0-2 SMLV income range maps to VIS, 4+ SMLV maps to NO_VIS.
- **Payroll**: Models a "Generacion FNA" discount of 50 bps for applicants under 30.
- **Fetching**: Standard HTTP fetch via `fetchWithRetry`.
- **Notable**: FNA is not a traditional bank but a government savings fund. It segments by **income range** rather than VIS/NO_VIS directly.

---

### Banco Popular

- **Source**: HTML page
- **URL**: Tasas page at `bancopopular.com.co`
- **Extraction**: CSS selectors + Cheerio. Locates the `#table-rates-casaya` section (their "Casaya" housing product), finds the `table.simple-table`, and parses rows. Each row has a product name (Hipotecario or Leasing), a 15-year rate, and a 20-year rate.
- **Products extracted**: Hipotecario COP + Leasing COP = 2 offers. Banco Popular only publishes COP rates and does not differentiate VIS/NO_VIS (segment = UNKNOWN). The 15-year rate is used as the primary value, with the 20-year rate as the upper bound.
- **Payroll**: No payroll discount modeled.
- **Fetching**: Standard HTTP fetch via `fetchWithRetry`.

---

### Banco de Bogota

- **Source**: PDF document (dynamic URL resolution)
- **URL**: The PDF uses a date-based naming scheme (`tasas-{month}-{year}`). The parser uses a dedicated `fetchBancoDeBogotaPdf` utility that tries the current month's URL and falls back to the previous month.
- **Extraction**: `pdfjs-dist` + regex. Parses the "PORTAFOLIO DE VIVIENDA" section on page 7. Matches product lines like "CREDITO NO VIS", "CREDITO VIS O VIP", "CREDITO DIRECTO UVR NO VIS", etc. Each line includes a term (plazo) and a rate percentage.
- **Products extracted**: Hipotecario (VIS/NO_VIS x COP/UVR) + Leasing COP = up to 5 offers. Single rates (not ranges).
- **Payroll**: No payroll discount modeled.
- **Fetching**: Custom `fetchBancoDeBogotaPdf` utility with browser user-agent. Handles month-based URL rotation.

---

### Banco de Occidente

- **Source**: PDF document
- **URL**: Direct link to "tasas-personas.pdf".
- **Extraction**: `pdfjs-dist` + regex. The PDF text extraction produces digits with spaces between them (e.g., "1 1 , 62 %" for 11.62%), requiring a specialized `parseRateWithSpaces` function. Looks for the "Vivienda" / "Tasas Vivienda" section with "DESDE HASTA" columns for both Hipotecario and Leasing.
- **Products extracted**: Hipotecario COP + Leasing COP = 2 offers. Only COP rates, segment = UNKNOWN (no VIS/NO_VIS distinction). Rates expressed as from/to ranges.
- **Payroll**: No payroll discount modeled.
- **Fetching**: Uses **Playwright with stealth plugin** (`playwright-extra` + `puppeteer-extra-plugin-stealth`) to bypass CloudFront bot protection. Visits the bank's main page first to establish a valid session/cookies, then navigates to the PDF URL. Handles both inline PDFs and download-triggered PDFs.
- **Notable**: One of two parsers requiring a full browser (Playwright) to bypass bot protection.

---

### Davivienda

- **Source**: PDF document
- **URL**: Stable URL at `davivienda.com/documents/d/guest/tasas-tarifas-davivienda` that always points to the latest rates PDF.
- **Extraction**: `pdfjs-dist` + regex. Locates the page containing "FINANCIACION DE VIVIENDA", then searches for groups of 4 consecutive percentages (COP E.A., COP M.V., UVR E.A., UVR M.V.) that fall within expected mortgage rate ranges (COP 10-14%, UVR 5-10%). The positional order of matches determines the product: VIS Hipotecario, NO_VIS Hipotecario, VIS Leasing, NO_VIS Leasing.
- **Products extracted**: Hipotecario (VIS/NO_VIS x COP/UVR) + Leasing (VIS/NO_VIS x COP/UVR) = up to 8 offers.
- **Payroll**: No payroll discount modeled.
- **Fetching**: Standard HTTP fetch via `fetchWithRetry` with browser user-agent.
- **Notable**: Extracts the most complete product matrix (all combinations of VIS/NO_VIS, COP/UVR, Hipotecario/Leasing).

---

### Banco Agrario

- **Source**: PDF document
- **URL**: The PDF URL changes weekly with a date-based naming scheme. The parser currently uses a hardcoded fallback PDF URL that must be updated periodically.
- **Extraction**: `pdfjs-dist` + regex. Matches labeled sections like "VIVIENDA DE INTERES SOCIAL EN UVR (UVR + X%)", "VIVIENDA DE INTERES SOCIAL EN PESOS X%", "VIVIENDA NO VIS EN UVR", and "VIVIENDA NO VIS EN PESOS". Also attempts to extract Leasing rates by finding a second occurrence of the VIS/NO_VIS COP pattern (with different values from Hipotecario).
- **Products extracted**: Hipotecario (VIS/NO_VIS x COP/UVR) + optionally Leasing (VIS/NO_VIS x COP) = 4-6 offers.
- **Payroll**: No payroll discount modeled.
- **Fetching**: Standard HTTP fetch via `fetchWithRetry` with browser user-agent.
- **Notable**: The fallback PDF URL needs manual updating as it changes weekly.

---

### Bancoomeva

- **Source**: PDF document (discovered dynamically)
- **URL**: Rates page at `bancoomeva.com.co/publicaciones/164289/tasas-de-credito/`. The parser first fetches this HTML page, extracts the latest `idFile` from download links, and constructs the PDF download URL.
- **Extraction**: `pdfjs-dist` + regex. The PDF has two relevant sections on different pages:
  1. **Page 1 - Clientes Bancoomeva**: Standard client rates.
  2. **Page 4 - Asociados a Coomeva**: Better rates for cooperative members.

  Each section is parsed independently. Regex patterns match product lines like "Compra vivienda urbana" (NO_VIS COP), "Vivienda UVR - NO VIS", "VIS en pesos", and "Vivienda VIS - UVR".

- **Products extracted**: Up to 8 offers (VIS/NO_VIS x COP/UVR for both regular clients and cooperative members). Cooperative member rates use `Channel.BRANCH`.
- **Payroll**: No payroll discount, but cooperative member rates are annotated in the offer conditions.
- **Fetching**: Two-step fetch with `skipSslVerification: true` (Bancoomeva's server has an incomplete SSL certificate chain).
- **Notable**: Only bank with a **cooperative membership** tier producing separate, lower rates.

## Output

The pipeline writes two files to `apps/web/public/data/`:

- **`mortgage-offers-latest.json`**: Full dataset of all extracted offers, validated against `MortgageOffersDatasetSchema`.
- **`mortgage-rankings-latest.json`**: Precomputed top-3 rankings for each scenario, validated against `MortgageRankingsSchema`.

## Summary Table

| Bank                 | Source            | Fetch Method            | Products                        | Segments                    | Payroll           |
| -------------------- | ----------------- | ----------------------- | ------------------------------- | --------------------------- | ----------------- |
| Bancolombia          | HTML              | HTTP                    | Hipotecario                     | VIS, NO_VIS                 | Yes (1% off)      |
| BBVA                 | PDF               | HTTP                    | Hipotecario + Leasing           | VIS, NO_VIS                 | Yes (150-250 bps) |
| Scotiabank Colpatria | PDF               | HTTP                    | Hipotecario + Leasing           | VIS, NO_VIS                 | No                |
| Caja Social          | PDF               | HTTP                    | Hipotecario                     | VIS, NO_VIS                 | No                |
| AV Villas            | PDF (discovered)  | HTTP (2-step)           | Hipotecario + Leasing + Digital | VIS, NO_VIS                 | No                |
| Itau                 | PDF (fixture)     | Manual download         | Hipotecario + Leasing           | UNKNOWN                     | No                |
| FNA                  | HTML              | HTTP                    | Hipotecario + Leasing           | VIS, NO_VIS (income-mapped) | Yes (50 bps)      |
| Banco Popular        | HTML              | HTTP                    | Hipotecario + Leasing           | UNKNOWN                     | No                |
| Banco de Bogota      | PDF (dynamic URL) | HTTP (month-based)      | Hipotecario + Leasing           | VIS, NO_VIS                 | No                |
| Banco de Occidente   | PDF               | Playwright (stealth)    | Hipotecario + Leasing           | UNKNOWN                     | No                |
| Davivienda           | PDF (stable URL)  | HTTP                    | Hipotecario + Leasing           | VIS, NO_VIS                 | No                |
| Banco Agrario        | PDF (weekly URL)  | HTTP                    | Hipotecario + Leasing           | VIS, NO_VIS                 | No                |
| Bancoomeva           | PDF (discovered)  | HTTP (2-step, skip SSL) | Hipotecario                     | VIS, NO_VIS                 | No                |
