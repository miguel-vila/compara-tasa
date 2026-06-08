# Rate History Feature

## Overview

The rate history feature tracks how each bank's published rates change over time and renders them as line charts on the `/hipotecario` and `/ahorros` pages.

History is stored as a flat list of **change-points**: one record per logical product per day on which its rate differed from the previously recorded value. This keeps the files compact (a product that never changes its rate contributes a single point) and makes the series trivial to plot as step functions.

### Output Files

The pipeline writes two files to `apps/web/public/data/`:

- **`mortgage-history.json`** — `{ generated_at, points: MortgageHistoryPoint[] }`
- **`savings-history.json`** — `{ generated_at, points: SavingsHistoryPoint[] }`

Each point carries the **structured product dimensions plus the rate** — never a pre-joined series key. The series key is derived at read time (see below), so the grouping logic can change without rewriting historical data.

## Series identity

A "series" is one logical product followed across time. The series key deliberately **excludes the rate** (the rate is what varies along a series) and is keyed on stable identifiers:

- **Mortgage**: `bank_id | product_type | currency_index | segment | channel`
- **Savings**: `bank_id | account_type | account_name | min_amount_cop`

Critically, the key uses `bank_id`, **not** the display `bank_name`. The display name has already churned once (the Davibank merger renamed `bank_name` while `bank_id` stayed put), and keying on it would have split those series in two.

Helpers live in `packages/core/src/history.ts`: `deriveMortgageSeriesKey`, `deriveSavingsSeriesKey`, `mortgageRateKey` / `savingsRateKey` (rate-equality for change detection), `mortgagePlotValue` / `savingsPlotValue` (the scalar to chart), and `groupMortgageHistory` / `groupSavingsHistory`.

> **Note on M.V. fields.** `mortgageRateKey` ignores the `*_mv_*` (monthly-equivalent) fields — they are derived from the E.A. rate, so a scrape that merely populates them later must not register as a phantom rate change.

## Data flow

### Going forward (incremental append)

After each scrape, `update-mortgage-rates` / `update-savings-rates` call `appendMortgageHistory` / `appendSavingsHistory` (`packages/updater/src/historyUpdate.ts`):

1. Read the existing history file (empty if absent).
2. For each current offer, compute its series key and rate key.
3. Append a new point dated today **only if** the rate differs from the series' last recorded value.
4. If a point already exists for today (a same-day re-run), update it in place — so there is at most one point per series per day.

This makes re-runs idempotent: running twice in a day with unchanged rates is a no-op.

### Initial backfill

The history files were seeded once by reconstructing rates from git: every scrape since 2026-01-11 had been committed as a full snapshot of the offers JSON, so each committed version was read (`git show <commit>:<path>`), its observation day taken from the file's own `generated_at`, bucketed by day (keeping the last snapshot per day to collapse the rapid-fire 2026-01-11 test runs), and reduced to change-points.

Because every history record carries the structured product dimensions (not a baked-in key), the files can always be regenerated from those same git snapshots if they ever need to be rebuilt.

## Frontend

`apps/web/lib/history.ts` turns sparse change-points into chart rows by carrying each series' last known value forward across the union of observation dates (`buildTimeline`), aggregating per bank (max for savings, min for mortgage). The React components `RateHistoryChart` (in `apps/web/components/rate-history-chart.tsx`) renders step lines with Recharts; `SavingsHistorySection` (in `apps/web/components/savings-history-section.tsx`) and `MortgageHistorySection` (in `apps/web/components/mortgage-history-section.tsx`) add the bank toggles (and, for mortgages, a currency × segment view selector, since UVR spreads and COP E.A. rates are not comparable).
