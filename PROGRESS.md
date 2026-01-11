# Progress

> **Status: READY TO DEPLOY** - All 12 bank parsers implemented (187 tests). Railway + GitHub Actions configured. Note: Itaú requires manual PDF download due to 403 blocking. Banco de Bogotá, Banco de Occidente, and Davivienda require browser user-agent. Banco Agrario uses date-based PDF URLs (may need periodic updates).

## What's Done

### Project Structure

- [x] pnpm monorepo with workspaces
- [x] TypeScript configuration
- [x] ESLint + Prettier + Husky pre-commit hooks

### `packages/core`

- [x] Type definitions matching the spec (Offer, Rankings, Rate, etc.)
- [x] Zod schemas for validation
- [x] Enums for BankId, Segment, Channel, ProductType, etc.

### `packages/updater`

- [x] Project setup with vitest
- [x] Utility functions (number parsing, fetch with retry, hashing)
- [x] Rankings computation logic
- [x] Parser stubs for all 12 banks:
  - Bancolombia (HTML)
  - BBVA (PDF)
  - Scotiabank Colpatria (PDF)
  - Banco Caja Social (PDF)
  - AV Villas (PDF)
  - Itaú (PDF)
  - FNA (HTML)
  - Banco Popular (HTML)
  - Banco de Bogotá (PDF)
  - Banco de Occidente (PDF)
  - Davivienda (PDF)
  - Banco Agrario (PDF)

### `apps/web`

- [x] Next.js 15 with App Router
- [x] Tailwind CSS styling
- [x] Home page with "best rates" cards
- [x] Rates table page with filters (bank, type, currency, segment)
- [x] Methodology page
- [x] Fake data for testing UI

### Infrastructure

- [x] Fixture directories for each bank
- [x] Sample JSON data files for frontend testing

## What's NOT Done

### Parsers (Critical)

- [x] **Bancolombia**: Implement HTML parsing with cheerio selectors (14 tests)
- [x] **BBVA**: Implement PDF text extraction with pdfjs-dist (18 tests)
- [x] **Scotiabank**: Implement PDF parsing with pdfjs-dist (13 tests)
- [x] **Caja Social**: Implement PDF parsing with pdfjs-dist (13 tests)
- [x] **AV Villas**: Implement PDF link discovery + parsing (15 tests)
- [x] **Itaú**: Implement PDF parsing (13 tests) - Note: requires manual PDF download
- [x] **FNA**: Implement HTML parsing with cheerio (16 tests) - Government entity, best rates
- [x] **Banco Popular**: Implement HTML parsing with cheerio (14 tests) - COP rates only, no VIS/NO_VIS segmentation
- [x] **Banco de Bogotá**: Implement PDF parsing (13 tests) - Grupo Aval, requires browser user-agent
- [x] **Banco Agrario**: Implement PDF parsing (13 tests) - Government bank, date-based PDF URLs

### Testing

- [x] Download HTML/PDF fixtures for each bank (all 12 banks done)
- [x] Write unit tests for parsers (Bancolombia: 14, Scotiabank: 13, BBVA: 18, Caja Social: 13, AV Villas: 15, Itaú: 13, FNA: 16, Banco Popular: 14, Banco de Bogotá: 13, Banco de Occidente: 14, Davivienda: 16, Banco Agrario: 13 - Total: 187 tests including utilities)
- [ ] Snapshot tests for extracted offers

### Deployment

- [x] Railway configuration (`railway.json`, `nixpacks.toml`)
- [x] GitHub Actions for scheduled ETL runs (weekly on Mondays)
- [x] Data storage setup (JSON files in git, committed by GitHub Actions)

### Future Banks (Expansion)

Additional Colombian banks that could be added:

**High Priority (PDF disclosures available):**

- [x] **Banco de Bogotá** (Grupo Aval) - [Tasas y Tarifas](https://www.bancodebogota.com/tasas-y-tarifas/tasas-2025) - Implemented! (13 tests) Requires browser user-agent
- [x] **Davivienda** - [Tasas y Tarifas](https://www.davivienda.com/documents/d/guest/tasas-tarifas-davivienda) - Implemented! (16 tests) Requires browser user-agent. Uses stable `/documents/d/guest/` URL that bypasses Incapsula.
- [x] **Banco Agrario** - [Tasas y Tarifas](https://www.bancoagrario.gov.co/tasas-y-tarifas) - Implemented! (13 tests) Government bank with competitive rates (VIS COP: 10.70%, NO_VIS COP: 12.50%). PDF URLs are date-based and may need periodic updates.

**Medium Priority (HTML scraping or investigation needed):**

- [x] **Banco de Occidente** (Grupo Aval) - Implemented! (14 tests) Requires browser user-agent - COP rates only (~11.62% E.A.)

**Low Priority (May require additional work):**

- [ ] **Bancoomeva** - [Tasas de Crédito](https://www.bancoomeva.com.co/publicaciones/164289/tasas-de-credito/) - Monthly PDF documents available. VIS ~14.5%, NO_VIS ~16.5%. Cooperative bank with UVR and COP options.
- [ ] **Banco GNB Sudameris** - [Documentos de Tasas](https://www.gnbsudameris.com.co/ws/documentos?d=TASAS) - Low rates for libre inversión (16.40% E.A.). Need to verify if they offer mortgage products.
- [ ] **Banco Serfinanza** - [Tasas](https://bancoserfinanza.com/servicio-al-cliente/tasas/) - Has bot protection (Radware verification). May require manual download.
- [ ] **Mibanco** - NO_VIS ~15.94% E.A. according to Superfinanciera data. Need to find disclosure URL.
- [ ] **Banco Unión** - NO_VIS ~17.6% E.A. Need to find disclosure URL.
- [ ] **Banco Pichincha Colombia** - [Tasas vigentes PDF](https://www.bancopichincha.com.co/documents/158126/259294/Tasas+vigentes.pdf) - Need to verify if they offer mortgage products in Colombia (main mortgage products are in Ecuador).

**Banks NOT offering mortgages in Colombia:**

- **Banco Falabella Colombia** - Only offers credit cards, savings accounts, and CDTs. Mortgage products only available in Chile.

### Frontend Polish

- [ ] Mobile navigation menu
- [ ] Offer detail page
- [ ] Loading states refinement
- [ ] Error boundaries

## Next Steps

1. ~~Download sample HTML/PDFs to `fixtures/` for each bank~~ ✓ (Bancolombia, Scotiabank, BBVA done)
2. ~~Implement Bancolombia parser first (simplest - HTML)~~ ✓
3. ~~Implement one PDF parser as a template (recommend BBVA or Scotiabank)~~ ✓ (Scotiabank done)
4. ~~Add tests with fixtures~~ ✓ (Bancolombia: 14 tests, Scotiabank: 13 tests, BBVA: 18 tests)
5. ~~Implement BBVA PDF parser~~ ✓ (18 tests)
6. ~~Implement Caja Social PDF parser~~ ✓ (13 tests)
7. ~~Implement AV Villas PDF parser~~ ✓ (15 tests)
8. ~~Implement Itaú PDF parser~~ ✓ (13 tests) - requires manual PDF download
9. ~~Deploy to Railway~~ ✓ (railway.json + nixpacks.toml + GitHub Actions)
10. ~~Connect GitHub repo to Railway and deploy~~ ✓

## Running the Project

```bash
pnpm install
pnpm --filter @mejor-tasa/core build
pnpm dev
```

Run `pnpm update-rates` to fetch live rates and generate data files for the frontend.
