# Architecture

This is a pnpm monorepo with three packages:

## `packages/core` (@compara-tasa/core)

Shared TypeScript types and Zod schemas. Must be built first as other packages depend on it.

Key exports:

- **Enums**: `BankId`, `MortgageType`, `CurrencyIndex`, `Segment`, `Channel`, `SourceType`, `ExtractionMethod`, `MortgageScenarioKey`, `SavingsScenarioKey`
- **Types**: `MortgageOffer`, `Rate` (union of `CopFixedRate` | `UvrSpreadRate`), `MortgageRankings`, `MortgageOffersDataset`, `BankMortgageParseResult`, `SavingsOffer`, `SavingsRankings`, `SavingsOffersDataset`, `BankSavingsParseResult`, `MortgageRateHistory`, `SavingsRateHistory`
- **Schemas**: Zod validators for all types (e.g., `MortgageOfferSchema`, `MortgageRankingsSchema`, `SavingsOfferSchema`)
- **History helpers**: `deriveMortgageSeriesKey` / `deriveSavingsSeriesKey` (identify a logical product across time, excluding the rate), `mortgageRateKey` / `savingsRateKey` (change detection), `mortgagePlotValue` / `savingsPlotValue`, and `groupMortgageHistory` / `groupSavingsHistory`. See [Rate History](./rate-history/index.md).

## `packages/updater` (@compara-tasa/updater)

ETL pipeline that scrapes bank rate disclosures and produces JSON datasets.

Key patterns:

- **Mortgage parsers**: Implement `BankMortgageParser` interface, return `BankMortgageParseResult`
- **Savings parsers**: Implement `BankSavingsParser` interface, return `BankSavingsParseResult`
- Uses `cheerio` for HTML parsing and `pdfjs-dist` for PDF text extraction
- Outputs JSON files to `apps/web/public/data/` directory
- **History maintenance**: `historyUpdate.ts` appends rate change-points after each run. See [Rate History](./rate-history/index.md).

## `apps/web` (@compara-tasa/web)

Next.js 15 frontend with React 19, TailwindCSS, TanStack React Table, and Recharts (rate history charts).
