# Progress

> **Status: READY TO DEPLOY** - All 11 bank parsers implemented (159 tests). Railway + GitHub Actions configured. Note: Itaú requires manual PDF download due to 403 blocking. Banco de Bogotá, Banco de Occidente, and Davivienda require browser user-agent.

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
- [x] Parser stubs for all 11 banks:
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

### Testing

- [x] Download HTML/PDF fixtures for each bank (all 11 banks done)
- [x] Write unit tests for parsers (Bancolombia: 14, Scotiabank: 13, BBVA: 18, Caja Social: 13, AV Villas: 15, Itaú: 13, FNA: 16, Banco Popular: 14, Banco de Bogotá: 13, Banco de Occidente: 14, Davivienda: 16 - Total: 159 tests)
- [ ] Snapshot tests for extracted offers

### Deployment

- [x] Railway configuration (`railway.json`, `nixpacks.toml`)
- [x] GitHub Actions for scheduled ETL runs (weekly on Mondays)
- [x] Data storage setup (JSON files in git, committed by GitHub Actions)

### Future Banks (Expansion)

Additional Colombian banks that could be added:

**High Priority (PDF disclosures available):**

- [x] **Banco de Bogotá** (Grupo Aval) - [Tasas y Tarifas](https://www.bancodebogota.com/tasas-y-tarifas/tasas-2025) - Implemented! (13 tests) Requires browser user-agent
- [x] **Davivienda** - [Tasas y Tarifas](https://www.davivienda.com/tasas-y-tarifas) - Implemented! (16 tests) Requires browser user-agent. Direct PDF links bypass Incapsula protection.

**Medium Priority (HTML scraping or investigation needed):**

- [x] **Banco de Occidente** (Grupo Aval) - Implemented! (14 tests) Requires browser user-agent - COP rates only (~11.62% E.A.)

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
10. Connect GitHub repo to Railway and deploy

## Running the Project

```bash
pnpm install
pnpm --filter @mejor-tasa/core build
pnpm dev
```

Run `pnpm update-rates` to fetch live rates and generate data files for the frontend.
