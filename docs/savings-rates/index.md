# Savings Rates Feature

## Overview

The savings rates feature aggregates publicly disclosed interest rates for savings accounts across Colombian banks. It scrapes rate data from each bank's website (HTML pages or PDF documents), validates the extracted offers, computes ranked comparisons across predefined scenarios, and outputs structured JSON datasets consumed by the frontend.

The pipeline runs via `pnpm update-savings-rates`. Each bank has a dedicated parser that implements the `BankSavingsParser` interface and returns a `BankSavingsParseResult`. All parsers run sequentially; individual parser failures are tolerated as long as at least one parser succeeds.

### Output Files

The pipeline writes three files to `apps/web/public/data/`:

- **`savings-offers-latest.json`** -- every extracted offer with full provenance metadata.
- **`savings-rankings-latest.json`** -- top-3 banks for each ranking scenario.
- **`savings-history.json`** -- rate change-points over time, appended on each run. See [Rate History](../rate-history/index.md).

## Segmentation

Offers are segmented along two dimensions for ranking purposes.

### By Balance Amount

Many banks offer tiered rates where higher balances earn better returns. The system defines three balance tiers and computes a "best rate" ranking for each:

| Tier       | Balance Range                | Representative Amount |
| ---------- | ---------------------------- | --------------------- |
| Under 10M  | < 10,000,000 COP             | 5,000,000 COP         |
| 10M to 50M | 10,000,000 -- 50,000,000 COP | 25,000,000 COP        |
| Over 50M   | > 50,000,000 COP             | 100,000,000 COP       |

For each scenario, offers are filtered to those whose `[min_amount_cop, max_amount_cop]` range contains the representative amount, then the highest rate per bank is kept, and the top 3 are returned.

### By Bank Type

Banks are classified into two categories:

| Type                       | Banks                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| **Neobank** (digital-only) | Ban100, Lulo Bank, RappiPay, Pibank, Ualá, Nu Colombia               |
| **Traditional**            | Banco AV Villas, Banco Popular, BBVA, Banco Caja Social, Bancamía    |

Two ranking scenarios find the best rate among neobanks and traditional banks respectively, without filtering by balance amount.

### Account Types

Each offer is tagged with an account type, used for display but not for ranking segmentation:

- **`standard`** -- Traditional savings accounts.
- **`high_yield`** -- High-interest products, often with conditions (e.g., no withdrawals).
- **`digital`** -- Digital-only savings accounts.

## Bank Parsers

### Banco AV Villas

- **Source**: PDF hosted on `avvillas.com.co`
- **Extraction**: `pdfjs-dist` for text extraction, regex for parsing
- **Products**: 3 products with tiered rates
  - **Bolsillos con Rentabilidad (Cuenta Premium)** -- High-yield product with a 5-column table organized by holding period (0-30, 31-90, 91-180, 181-365, >365 days). The parser extracts the >365-day column (best rates). 5+ balance tiers.
  - **Cuenta Premium** -- High-yield tiered savings account. 7+ balance tiers parsed from a table with a "Rango Saldo" header.
  - **RentaVillas** -- First rate table on page 1. 7+ balance tiers.
- **Notes**: Bolsillos con Rentabilidad requires no withdrawals for >365 days to obtain the best advertised rate.

### Ban100

- **Source**: HTML at `ban100.com.co/productos/cuenta-de-ahorro`
- **Extraction**: `cheerio` with CSS selectors over HTML tables
- **Products**: 2 products
  - **Cuenta de Ahorro 100pre** -- High-yield account with 3 balance tiers. Rates are parsed from table rows containing "% E.A." in the last cell; amount ranges are parsed from the first cell.
  - **Cuenta de Ahorro Clásica** -- Standard account with a single flat rate for all balances.
- **Notes**: Amount strings use Colombian number formatting (periods as thousand separators, e.g., `$10.000.000`).

### Bancamía

- **Source**: PDF hosted on `bancamia.com.co`
- **Extraction**: `pdfjs-dist` for text extraction, pattern matching against expected rate values
- **Products**: 1 product
  - **RentaPlus** -- 6 balance tiers with rates ranging from 5.0% to 10.5% E.A.
- **Notes**: Uses a hybrid validation approach. The parser has hardcoded expected rate values for each tier and cross-validates against the rates extracted from the PDF. If there is a mismatch, a warning is emitted but the extracted values are used in the final offer. The hardcoded values serve primarily for validation and tier structure definition. This guards against unexpected changes in the PDF structure.

### Banco Popular

- **Source**: HTML at `bancopopular.com.co/.../informacion-interes/tasas`
- **Extraction**: `cheerio` to navigate article sections by `<h4><em>` text, then parse `table.simple-table` rows
- **Products**: 2 products
  - **Cuenta para Ahorrar (Persona Natural)** -- Standard savings account with 3+ balance tiers.
  - **Cuenta Ahorro Cuenta Plateada** -- High-yield savings account with 3+ balance tiers.
- **Notes**: Sends a browser-like `User-Agent` header to avoid bot detection. Amount ranges use patterns like "De $0 a $10.000.000" and "en adelante" for the unlimited upper bound.

### BBVA Colombia

- **Source**: PDF at `bbva.com.co/content/dam/.../DO-01-Tasas-cuenta-ahorro.pdf`
- **Extraction**: `pdfjs-dist` for text extraction, product-specific regex patterns
- **Products**: 7 products (the most comprehensive parser)
  - **Cuenta Especial Premium** (high yield) -- 7 balance tiers with custom regex for range/rate pairs. Uses "Superiores a:" for the unlimited upper-bound tier.
  - **Cuenta de Nómina y Digital** (digital) -- Flat rate, parsed from "Todos los montos X%" pattern.
  - **Cuenta Blue** (digital) -- Flat rate.
  - **Cuenta Blue Kids** (standard) -- Flat rate.
  - **Cuenta Hogar** (standard) -- Tiered.
  - **AFC** (standard) -- Tiered, tax-advantaged housing savings (Ahorro para el Fomento de la Construcción).
  - **Ahorro Fijo** (high yield) -- Term-based rates; the parser extracts the longest-term (best) rate.
- **Notes**: Each product section in the PDF has a different layout, so dedicated regex patterns and parsing functions are used for each. The parser emits warnings if the flagship Cuenta Especial Premium yields fewer than 7 tiers.

### Banco Caja Social

- **Source**: PDF at `bancocajasocial.com/content/dam/.../Tasas-Cuenta-Alcancia.pdf`
- **Extraction**: `pdfjs-dist` for text extraction, regex pattern matching with count validation
- **Products**: 2 products
  - **Cuenta Alcancía Digital** (digital) -- Single flat rate for all balances.
  - **Cuenta Alcancía Digital (Tasa Premio)** (high yield) -- Variable balance tiers, premium rate applies when no withdrawals were made during the previous month.
- **Notes**: The parser extracts all rate entries from the PDF, categorizing them by whether they have a minimum balance constraint. Entries without a minimum (or with `null` min) are assigned to the standard digital account, while entries with a minimum are assigned to the premium variant based on their balance tier ranges.

### Lulo Bank

- **Source**: HTML help article at `ayuda.lulobank.com/hc/es/articles/...`
- **Extraction**: **Playwright with stealth plugin** to bypass Cloudflare, then `cheerio` + regex on the article body
- **Products**: 2 products, each with regular and Lulo Pro variants (4 offers total)
  - **Bolsillos Flex** -- Extracted via regex on "El rendimiento de tus Bolsillos Flex es del X% E.A."
  - **Bolsillos Programados** -- Extracted via regex on "va desde X% E.A."
  - For each, a "Lulo Pro" variant is also extracted with its own rate.
- **Notes**: The only parser that uses Playwright (headless Chromium with `puppeteer-extra-plugin-stealth`) because Lulo's help center is behind Cloudflare anti-bot protection. The page is loaded with `waitUntil: "networkidle"` and waits for the `.article-body` selector before extracting text.

### Pibank

- **Source**: PDF with a dynamically changing URL, resolved from `pibank.co/tasas-y-tarifas`
- **Extraction**: Custom `fetchPibankPdf()` utility to resolve the current PDF URL, then `pdfjs-dist` + regex
- **Products**: 1 product
  - **Cuenta Pibank** (high yield) -- Single flat rate for all balances (min $1, no maximum).
- **Notes**: The PDF URL changes monthly, so a custom fetcher first visits the landing page to discover the current document link. The parser also handles a PDF text-extraction quirk where digits in the rate may be space-separated (e.g., "1 1 %" instead of "11%").

### RappiPay

- **Source**: HTML at `rappipay.co/tasas-y-tarifas/`
- **Extraction**: `cheerio` with complex tab/panel navigation
- **Products**: Up to 4 offers across 2 product types
  - **Saldo en Bolsillos** (high yield) -- Rate for money held in "Bolsillos" (savings pockets).
  - **Saldo fuera de Bolsillos** (standard) -- Rate for money in the main account balance.
  - Each product may appear in two sections: "Depósito de Bajo Monto" and "Cuenta de ahorros".
- **Notes**: The page has nested tab structures (outer tabs: Personas/Empresas; inner tabs: monthly tariff periods). The parser navigates to the active tab panel (`.e-n-tabs-content [role='tabpanel'].e-active`) and iterates inner active tabs to find the table with "Rentabilidad" and "Bolsillos" headings. "Bóvedas" (fixed-term vaults) are intentionally skipped.

### Nu Colombia (Manual)

- **Source**: Manually maintained JSON file at `manual/nu.json`
- **Extraction**: Direct JSON parsing with schema validation
- **Products**: 1 product
  - **Cajitas** (high yield) -- Self-reported rate from the Nu app.
- **Notes**: Nu Colombia does not publish rates on a publicly scrapeable page, so rates are entered manually. The manual parser validates the JSON structure (bank_id, account_name, account_type, ea_percent 0-30%, observed_date in YYYY-MM-DD format) and produces `SavingsOffer` objects with `ManualSavingsSource` provenance. Any bank without a public rate disclosure page can be added through this mechanism.

## Summary

| Bank              | Type        | Source Format     | Extraction                    | Products        | Tiered? |
| ----------------- | ----------- | ----------------- | ----------------------------- | --------------- | ------- |
| Banco AV Villas   | Traditional | PDF               | pdfjs-dist + regex            | 3               | Yes     |
| Ban100            | Neobank     | HTML              | cheerio                       | 2               | Yes     |
| Bancamía          | Traditional | PDF               | pdfjs-dist + pattern matching | 1               | Yes     |
| Banco Popular     | Traditional | HTML              | cheerio                       | 2               | Yes     |
| BBVA Colombia     | Traditional | PDF               | pdfjs-dist + regex            | 7               | Mixed   |
| Banco Caja Social | Traditional | PDF               | pdfjs-dist + regex            | 2               | Yes     |
| Lulo Bank         | Neobank     | HTML (Cloudflare) | Playwright + cheerio + regex  | 2 (x2 variants) | No      |
| Pibank            | Neobank     | PDF (dynamic URL) | pdfjs-dist + regex            | 1               | No      |
| RappiPay          | Neobank     | HTML              | cheerio                       | 2               | No      |
| Nu Colombia       | Neobank     | Manual JSON       | JSON parsing                  | 1               | No      |
