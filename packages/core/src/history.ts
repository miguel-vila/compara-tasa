import type {
  MortgageOffer,
  SavingsOffer,
  Rate,
  SavingsRate,
  MortgageHistoryPoint,
  SavingsHistoryPoint,
} from "./types.js";

// ============================================
// Series keys
// ============================================
//
// A "series" is a single logical product tracked over time. The series key is
// derived from the structured product dimensions and deliberately EXCLUDES the
// rate (the rate is what changes along the series). It is keyed on bank_id, not
// the display bank_name — which has already churned once (the Davibank merger)
// without changing identity. account_name IS part of a savings account's
// identity, so it is included there. Keys are derived on demand, never
// persisted, so the grouping logic can evolve without rewriting historical data.

const SEP = "|";

type MortgageSeriesDimensions = Pick<
  MortgageOffer,
  "bank_id" | "product_type" | "currency_index" | "segment" | "channel"
>;

export function deriveMortgageSeriesKey(d: MortgageSeriesDimensions): string {
  return [d.bank_id, d.product_type, d.currency_index, d.segment, d.channel].join(SEP);
}

type SavingsSeriesDimensions = Pick<
  SavingsOffer,
  "bank_id" | "account_type" | "account_name" | "min_amount_cop"
>;

export function deriveSavingsSeriesKey(d: SavingsSeriesDimensions): string {
  // Mirrors generateSavingsOfferId's identity fields (minus the rate): a tier
  // is identified by its lower bound, so two snapshots of the same tier line up
  // even if the upper bound shifts slightly.
  return [d.bank_id, d.account_type, d.account_name, d.min_amount_cop ?? 0].join(SEP);
}

// ============================================
// Rate equality (for change-point detection)
// ============================================
//
// Two observations belong to the same change-point run when their rate is
// identical. We compare a normalized key rather than object identity.

export function mortgageRateKey(rate: Rate): string {
  // Only the E.A. value(s) and kind define a rate change. The M.V. fields are
  // just the monthly-equivalent of the E.A., so they're ignored — otherwise a
  // later scrape that merely populates M.V. would register as a phantom change.
  if (rate.kind === "COP_FIXED") {
    return ["COP_FIXED", rate.ea_percent_from, rate.ea_percent_to ?? ""].join(SEP);
  }
  return ["UVR_SPREAD", rate.spread_ea_from, rate.spread_ea_to ?? ""].join(SEP);
}

export function savingsRateKey(rate: SavingsRate): string {
  return String(rate.ea_percent);
}

// ============================================
// Plotting helpers
// ============================================
//
// The single comparable scalar to plot for a history point. For UVR mortgages
// this is the spread (UVR + X%), which is NOT comparable to a COP E.A. rate —
// callers should separate series by currency_index before charting.

export function mortgagePlotValue(rate: Rate): number {
  return rate.kind === "COP_FIXED" ? rate.ea_percent_from : rate.spread_ea_from;
}

export function savingsPlotValue(rate: SavingsRate): number {
  return rate.ea_percent;
}

// ============================================
// Grouping
// ============================================

export type RateSeries<P> = {
  key: string;
  points: P[]; // sorted ascending by date
};

function groupBy<P>(points: P[], keyOf: (p: P) => string): RateSeries<P>[] {
  const byKey = new Map<string, P[]>();
  for (const p of points) {
    const k = keyOf(p);
    const bucket = byKey.get(k);
    if (bucket) bucket.push(p);
    else byKey.set(k, [p]);
  }
  return [...byKey.entries()].map(([key, pts]) => ({ key, points: pts }));
}

export function groupMortgageHistory(
  points: MortgageHistoryPoint[]
): RateSeries<MortgageHistoryPoint>[] {
  const series = groupBy(points, deriveMortgageSeriesKey);
  for (const s of series) s.points.sort((a, b) => a.date.localeCompare(b.date));
  return series;
}

export function groupSavingsHistory(
  points: SavingsHistoryPoint[]
): RateSeries<SavingsHistoryPoint>[] {
  const series = groupBy(points, deriveSavingsSeriesKey);
  for (const s of series) s.points.sort((a, b) => a.date.localeCompare(b.date));
  return series;
}
