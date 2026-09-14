# AGENTS.md

## Project Overview

ComparaTasa is a Colombia rates aggregator that scrapes publicly disclosed rates from Colombian banks and presents them on a consumer-facing comparison site. It does it for mortgage rates and savings account rates. The system consists of an ETL pipeline that extracts rates from HTML/PDF sources and a Next.js frontend for displaying them.

- [Commands](./docs/commands.md): Commands to run the ETL, build the project, run the web server and others.
- [Architecture](./docs/architecture.md): High-level architecture and data flow.

## Data Flow

### Mortgage Rates

1. `pnpm update-mortgage-rates` runs the mortgage updater
2. Parsers fetch from bank URLs and extract mortgage rates
3. Offers are validated with Zod schemas
4. Rankings are computed for predefined scenarios
5. Output files written to `apps/web/public/data/`:
   - `mortgage-offers-latest.json`
   - `mortgage-rankings-latest.json`
   - `mortgage-history.json` (rate change-points appended on each run)

### Savings Rates

1. `pnpm update-savings-rates` runs the savings updater
2. Parsers fetch from bank URLs and extract savings rates
3. Offers are validated with Zod schemas
4. Rankings are computed for predefined scenarios
5. Output files written to `apps/web/public/data/`:
   - `savings-offers-latest.json`
   - `savings-rankings-latest.json`
   - `savings-history.json` (rate change-points appended on each run)

### Rate History

Both updaters also maintain `*-history.json` files of rate change-points over time (one record per product per day its rate changed), rendered as charts on the frontend. See [Rate History](./docs/rate-history/index.md).

## Feature Documentation

- [Mortgage Rates](./docs/mortgage-rates/index.md): Segmentation dimensions, ranking scenarios, and per-bank parser implementation details.
- [Savings Rates](./docs/savings-rates/index.md): Balance tier and bank type segmentation, ranking scenarios, and per-bank parser implementation details.
- [Rate History](./docs/rate-history/index.md): Change-point storage model, series identity, and the frontend charts.

## Domain Concepts

- **COP rates**: Fixed rates in Colombian Pesos (E.A. percentage)
- **UVR rates**: Inflation-indexed with a spread (UVR + X% E.A.)
- **VIS**: Vivienda de Interés Social (up to 150 SMLV property value)
- **NO_VIS**: Higher value properties
- **Payroll discount**: Banks offer rate reductions for customers with payroll deposits

## Error Handling Philosophy

**Graceful degradation with diagnostics.** Parsers return whatever data they can extract, with warnings for issues.

- If a parser cannot extract rates, return an empty array with a warning
- If a required field is missing, skip that offer and log a warning
- If a fetch fails, the exception is caught and logged; the updater continues with other parsers
- Warnings document what went wrong; the dataset is built from all successfully extracted offers

This approach allows partial datasets to be published even when some parsers encounter issues, while diagnostic warnings help identify which banks or fields may need parser updates.

## Testing

Tests use Vitest. Bank parsers should have fixture-based tests using saved HTML/PDF files in `fixtures/{bank_id}/`.

## Adding a New Bank Parser

### Mortgage Rate Parser

See `.claude/skills/add-mortgage-rate-parser/` for detailed instructions. Quick summary:

### Savings Account Parser

See `.claude/skills/add-savings-bank-account-parser/` for detailed instructions. Quick summary:
