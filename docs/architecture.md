# Architecture

This is a pnpm monorepo with three packages:

## `packages/core` (@compara-tasa/core)

Shared TypeScript types and Zod schemas. Must be built first as other packages depend on it.

Key exports:

- **Enums**: `BankId`, `MortgageType`, `CurrencyIndex`, `Segment`, `Channel`, `SourceType`, `ExtractionMethod`, `MortgageScenarioKey`, `SavingsScenarioKey`
- **Types**: `MortgageOffer`, `Rate` (union of `CopFixedRate` | `UvrSpreadRate`), `MortgageRankings`, `MortgageOffersDataset`, `BankMortgageParseResult`, `SavingsOffer`, `SavingsRankings`, `SavingsOffersDataset`, `BankSavingsParseResult`
- **Schemas**: Zod validators for all types (e.g., `MortgageOfferSchema`, `MortgageRankingsSchema`, `SavingsOfferSchema`)

## `packages/updater` (@compara-tasa/updater)

ETL pipeline that scrapes bank rate disclosures and produces JSON datasets.

Key patterns:

- **Mortgage parsers**: Implement `BankMortgageParser` interface, return `BankMortgageParseResult`
- **Savings parsers**: Implement `BankSavingsParser` interface, return `BankSavingsParseResult`
- Uses `cheerio` for HTML parsing and `pdfjs-dist` for PDF text extraction
- Outputs JSON files to `apps/web/public/data/` directory

## `apps/web` (@compara-tasa/web)

Next.js 15 frontend with React 19, TailwindCSS, and TanStack React Table.
