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

`apps/web/lib/history.ts` turns sparse change-points into chart rows by carrying each series' last known value forward across the union of observation dates (`buildTimeline`), aggregating per bank (max for savings, min for mortgage). `RateHistoryChart` renders step lines with Recharts; `SavingsHistorySection` and `MortgageHistorySection` add the bank toggles (and, for mortgages, a currency × segment view selector, since UVR spreads and COP E.A. rates are not comparable).

## BanRep reference lines

Both charts overlay vertical reference lines marking each **tasa de intervención** decision by Banco de la República. These give viewers instant context for why bank rates moved.

### Data file

`apps/web/public/data/banrep-rates.json` — a hand-maintained static file. Each entry:

```json
{
  "effective_date": "YYYY-MM-DD",
  "decision_date": "YYYY-MM-DD",
  "label": "Junta BanRep - Mayo 2026",
  "rate_ea_percent": 9.75
}
```

- **`effective_date`** — the day the new rate takes effect (used as the X position of the reference line); this is what matters for chart alignment since it's when bank rates start responding
- **`decision_date`** — when BanRep announced (kept for reference, not used for rendering)
- **`label`** — human-readable name shown in the hover tooltip
- **`rate_ea_percent`** — the policy rate (E.A. %)

BanRep's MPC meets ~8 times per year, so this file needs a few manual additions per year.

### Frontend

**Fetching:** A shared hook `useBanrepRates()` (in `apps/web/lib/` or `apps/web/hooks/`) fetches the file client-side and is used by both `MortgageHistorySection` and `SavingsHistorySection`.

**Filtering:** Each section component filters the loaded entries to only those whose `effective_date` falls within the bank-data date range (earliest bank change-point → today). This prevents stale historical decisions from cluttering a chart that only shows recent bank data.

**Rendering:** `RateHistoryChart` accepts a new `referenceLines` prop:

```ts
referenceLines?: { date: string; label: string; rate: number }[]
```

Each entry renders as a Recharts `ReferenceLine` at `x={date}` — a dashed gray vertical line with the rate value anchored at the top, and a tooltip on hover showing `label` + `rate_ea_percent`. BanRep dates are **not** injected into the `ChartRow[]` timeline; `ReferenceLine` places itself at any X value without needing a corresponding data point.
