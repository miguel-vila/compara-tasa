/**
 * Option-B history maintenance: after each scrape, append a change-point to the
 * committed history files — but only for series whose rate actually differs
 * from the last recorded value. This keeps the files small and the operation
 * idempotent (re-running the same day with the same rates is a no-op).
 *
 * The history files were seeded once from git snapshots; thereafter they are
 * maintained incrementally here on each scrape.
 */
import { readFile, writeFile } from "fs/promises";
import {
  MortgageRateHistorySchema,
  SavingsRateHistorySchema,
  deriveMortgageSeriesKey,
  deriveSavingsSeriesKey,
  mortgageRateKey,
  savingsRateKey,
  type MortgageOffer,
  type SavingsOffer,
  type MortgageHistoryPoint,
  type SavingsHistoryPoint,
  type MortgageRateHistory,
  type SavingsRateHistory,
} from "@compara-tasa/core";

type AppendResult = { added: number; updated: number; unchanged: number };

/**
 * Core change-point merge. Appends one point per series whose rate changed; if
 * a point already exists for `today` (a same-day re-run), it is updated in place
 * so there is at most one point per series per day.
 */
function mergeChangePoints<P extends { date: string }>(
  existing: P[],
  candidates: P[],
  seriesKeyOf: (p: P) => string,
  rateKeyOf: (p: P) => string
): { points: P[]; result: AppendResult } {
  const points = [...existing];
  const lastBySeries = new Map<string, P>();
  const todayIndexBySeries = new Map<string, number>();

  points.forEach((p, i) => {
    const key = seriesKeyOf(p);
    const last = lastBySeries.get(key);
    if (!last || p.date > last.date) lastBySeries.set(key, p);
    if (p.date === candidates[0]?.date) todayIndexBySeries.set(key, i);
  });

  const result: AppendResult = { added: 0, updated: 0, unchanged: 0 };

  for (const candidate of candidates) {
    const key = seriesKeyOf(candidate);
    const rk = rateKeyOf(candidate);
    const last = lastBySeries.get(key);

    if (last && last.date === candidate.date) {
      // A point already exists for today (prior run this day).
      if (rateKeyOf(last) === rk) {
        result.unchanged++;
      } else {
        points[todayIndexBySeries.get(key)!] = candidate;
        lastBySeries.set(key, candidate);
        result.updated++;
      }
      continue;
    }

    if (last && rateKeyOf(last) === rk) {
      result.unchanged++;
      continue;
    }

    points.push(candidate);
    lastBySeries.set(key, candidate);
    todayIndexBySeries.set(key, points.length - 1);
    result.added++;
  }

  return { points, result };
}

async function readJsonOrNull(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function appendMortgageHistory(
  path: string,
  offers: MortgageOffer[],
  generatedAt: string
): Promise<AppendResult> {
  const today = generatedAt.slice(0, 10);
  const raw = await readJsonOrNull(path);
  const existing: MortgageHistoryPoint[] = raw ? MortgageRateHistorySchema.parse(raw).points : [];

  const candidates: MortgageHistoryPoint[] = offers.map((o) => ({
    date: today,
    bank_id: o.bank_id,
    bank_name: o.bank_name,
    product_type: o.product_type,
    currency_index: o.currency_index,
    segment: o.segment,
    channel: o.channel,
    rate: o.rate,
  }));

  const { points, result } = mergeChangePoints(existing, candidates, deriveMortgageSeriesKey, (p) =>
    mortgageRateKey(p.rate)
  );

  points.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      deriveMortgageSeriesKey(a).localeCompare(deriveMortgageSeriesKey(b))
  );

  const history: MortgageRateHistory = { generated_at: generatedAt, points };
  await writeFile(path, JSON.stringify(MortgageRateHistorySchema.parse(history), null, 2), "utf-8");
  return result;
}

export async function appendSavingsHistory(
  path: string,
  offers: SavingsOffer[],
  generatedAt: string
): Promise<AppendResult> {
  const today = generatedAt.slice(0, 10);
  const raw = await readJsonOrNull(path);
  const existing: SavingsHistoryPoint[] = raw ? SavingsRateHistorySchema.parse(raw).points : [];

  const candidates: SavingsHistoryPoint[] = offers.map((o) => ({
    date: today,
    bank_id: o.bank_id,
    bank_name: o.bank_name,
    account_type: o.account_type,
    account_name: o.account_name,
    min_amount_cop: o.min_amount_cop,
    max_amount_cop: o.max_amount_cop,
    rate: o.rate,
  }));

  const { points, result } = mergeChangePoints(existing, candidates, deriveSavingsSeriesKey, (p) =>
    savingsRateKey(p.rate)
  );

  points.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      deriveSavingsSeriesKey(a).localeCompare(deriveSavingsSeriesKey(b))
  );

  const history: SavingsRateHistory = { generated_at: generatedAt, points };
  await writeFile(path, JSON.stringify(SavingsRateHistorySchema.parse(history), null, 2), "utf-8");
  return result;
}
