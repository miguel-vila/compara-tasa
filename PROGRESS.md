# Progress

> **Status: FUNCTIONAL** - All 6 bank parsers implemented and tested (Bancolombia, Scotiabank Colpatria, BBVA, Caja Social, AV Villas, Itaú). Note: Itaú requires manual PDF download due to 403 blocking.

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
- [x] Parser stubs for all 6 banks:
  - Bancolombia (HTML)
  - BBVA (PDF)
  - Scotiabank Colpatria (PDF)
  - Banco Caja Social (PDF)
  - AV Villas (PDF)
  - Itaú (PDF)

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

### Testing

- [x] Download HTML/PDF fixtures for each bank (all 6 banks done)
- [x] Write unit tests for parsers (Bancolombia: 14, Scotiabank: 13, BBVA: 18, Caja Social: 13, AV Villas: 15, Itaú: 13 - Total: 86 tests)
- [ ] Snapshot tests for extracted offers

### Deployment

- [ ] Railway configuration
- [ ] GitHub Actions for scheduled ETL runs
- [ ] Data storage setup (where to host JSON files)

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
9. Deploy to Railway

## Running the Project

```bash
pnpm install
pnpm --filter @mejor-tasa/core build
pnpm dev
```

Run `pnpm update-rates` to fetch live rates and generate data files for the frontend.
