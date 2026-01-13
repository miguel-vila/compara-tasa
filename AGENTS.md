# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before You Start

**Read `PROGRESS.md` first.** It contains:

- Current project status (what works, what doesn't)
- Checklist of completed and pending tasks
- Next steps prioritized by importance

**After completing work**, update `PROGRESS.md`:

- Mark completed items with `[x]`
- Add new items discovered during implementation
- Update the status if the project becomes functional

## Project Overview

ComparaTasa is a Colombia mortgage rates aggregator that scrapes publicly disclosed rates from Colombian banks and presents them on a consumer-facing comparison site. The system consists of an ETL pipeline that extracts rates from HTML/PDF sources and a Next.js frontend for displaying them.

## Commands

```bash
# Install dependencies and build
pnpm install
pnpm --filter @compara-tasa/core build     # Required before other packages
pnpm --filter @compara-tasa/updater build  # Required before running update-rates
                                         # Also rebuild after any changes to updater code

# Development
pnpm dev                              # Run Next.js dev server (localhost:3000)

# Run rate update ETL pipeline
pnpm update-rates                     # Scrapes banks and generates apps/web/public/data/*.json

# Testing
pnpm test                             # Run all tests
pnpm --filter @compara-tasa/updater test:watch  # Watch mode for updater tests

# Code quality
pnpm lint                             # ESLint
pnpm lint:fix                         # ESLint with auto-fix
pnpm format                           # Prettier
pnpm typecheck                        # TypeScript across all packages
```

## Architecture

This is a pnpm monorepo with three packages:

### `packages/core` (@compara-tasa/core)

Shared TypeScript types and Zod schemas. Must be built first as other packages depend on it.

Key exports:

- **Enums**: `BankId`, `ProductType`, `CurrencyIndex`, `Segment`, `Channel`, `SourceType`, `ExtractionMethod`, `ScenarioKey`
- **Types**: `Offer`, `Rate` (union of `CopFixedRate` | `UvrSpreadRate`), `Rankings`, `OffersDataset`, `BankParseResult`
- **Schemas**: Zod validators for all types (e.g., `OfferSchema`, `RankingsSchema`)

### `packages/updater` (@compara-tasa/updater)

ETL pipeline that scrapes bank rate disclosures and produces JSON datasets.

Key patterns:

- Each bank has an isolated parser implementing `BankParser` interface
- Parsers return `BankParseResult` with `offers`, `warnings`, and `raw_text_hash`
- Uses `cheerio` for HTML parsing (Bancolombia)

- Uses `pdfjs-dist` for PDF text extraction (all other banks)
- Outputs JSON files to `apps/web/public/data/` directory

### `apps/web` (@compara-tasa/web)

Next.js 15 frontend with React 19, TailwindCSS, and TanStack React Table.

## Data Flow

1. `pnpm update-rates` runs the updater
2. Parsers fetch from bank URLs and extract rates
3. Offers are validated with Zod schemas
4. Rankings are computed for predefined scenarios
5. Output files written to `apps/web/public/data/`:
   - `offers-latest.json`
   - `rankings-latest.json`

## Domain Concepts

- **COP rates**: Fixed rates in Colombian Pesos (E.A. percentage)
- **UVR rates**: Inflation-indexed with a spread (UVR + X% E.A.)
- **VIS**: Vivienda de Interés Social (up to 150 SMLV property value)
- **NO_VIS**: Higher value properties
- **Payroll discount**: Banks offer rate reductions for customers with payroll deposits

## Testing

Tests use Vitest. Bank parsers should have fixture-based tests using saved HTML/PDF files in `fixtures/{bank_id}/`.

## Adding a New Bank Parser

See `.claude/skills/add-bank-parser/` for detailed instructions. Quick summary:

1. Download fixture to `fixtures/{bank_id}/`
2. Implement parser in `packages/updater/src/parsers/{bank_id}.ts`
3. Register in `packages/updater/src/parsers/index.ts`
4. Write tests in `packages/updater/src/parsers/{bank_id}.test.ts`
5. Update PROGRESS.md
