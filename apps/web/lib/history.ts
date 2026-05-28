// Client-side helpers for turning sparse rate change-points into chart rows.
//
// History files store change-points (one record per series per day the rate
// changed). To plot them as step lines we carry each series' last known value
// forward across the union of all observation dates, then aggregate per bank.

export type SeriesValues = {
  bankId: string;
  values: { date: string; value: number }[]; // sorted ascending by date
};

export type ChartRow = { date: string; [bank: string]: string | number | null };

/** The value of a step series as of `date`: the last change-point on or before it. */
function steppedValueAt(values: { date: string; value: number }[], date: string): number | null {
  let current: number | null = null;
  for (const v of values) {
    if (v.date <= date) current = v.value;
    else break;
  }
  return current;
}

/** Sorted union of every observation date, plus a trailing `today` so the last
 *  rate visibly holds to the present. */
export function timelineDates(series: SeriesValues[], today: string): string[] {
  const dates = new Set<string>([today]);
  for (const s of series) for (const v of s.values) dates.add(v.date);
  return [...dates].sort((a, b) => a.localeCompare(b));
}

/**
 * One row per date; one column per bank. A bank's value on a date is the
 * aggregate (max for savings, min for mortgage) across that bank's active
 * series. Banks with no series active yet on a date get null (gap → series
 * birth), so the chart doesn't draw a line before the product existed.
 */
export function buildTimeline(
  series: SeriesValues[],
  dates: string[],
  aggregate: (vals: number[]) => number
): ChartRow[] {
  const banks = [...new Set(series.map((s) => s.bankId))];
  return dates.map((date) => {
    const row: ChartRow = { date };
    for (const bank of banks) {
      const vals = series
        .filter((s) => s.bankId === bank)
        .map((s) => steppedValueAt(s.values, date))
        .filter((v): v is number => v !== null);
      row[bank] = vals.length ? aggregate(vals) : null;
    }
    return row;
  });
}

export const min = (vals: number[]): number => Math.min(...vals);
export const max = (vals: number[]): number => Math.max(...vals);

/** Distinct, reasonably accessible line colors assigned to banks by index. */
export const SERIES_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#d97706", // amber
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#db2777", // pink
  "#65a30d", // lime
  "#ea580c", // orange
  "#0d9488", // teal
  "#9333ea", // purple
  "#4f46e5", // indigo
  "#ca8a04", // yellow
  "#be123c", // rose
  "#15803d", // emerald
  "#1d4ed8", // blue-700
  "#b91c1c", // red-700
  "#a16207", // amber-700
  "#6d28d9", // violet-700
];

export function colorForIndex(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length];
}
