"use client";

import { useEffect, useMemo, useState } from "react";
import {
  groupMortgageHistory,
  mortgagePlotValue,
  BankNames,
  type MortgageHistoryPoint,
} from "@compara-tasa/core";
import { buildTimeline, timelineDates, colorForIndex, min, type SeriesValues } from "@/lib/history";
import { RateHistoryChart, type ChartLine } from "./rate-history-chart";
import { useBanrepRates } from "@/lib/useBanrepRates";

const DEFAULT_BANK_COUNT = 5;

type View = {
  label: string;
  currency: "UVR" | "COP";
  segment: "VIS" | "NO_VIS";
};

const VIEWS: View[] = [
  { label: "UVR · VIS", currency: "UVR", segment: "VIS" },
  { label: "UVR · No VIS", currency: "UVR", segment: "NO_VIS" },
  { label: "Pesos · VIS", currency: "COP", segment: "VIS" },
  { label: "Pesos · No VIS", currency: "COP", segment: "NO_VIS" },
];

export function MortgageHistorySection() {
  const [points, setPoints] = useState<MortgageHistoryPoint[] | null>(null);
  const [today, setToday] = useState<string>("");
  const [viewIdx, setViewIdx] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const banrepRates = useBanrepRates();

  useEffect(() => {
    fetch("/data/mortgage-history.json")
      .then((res) => res.json())
      .then((data) => {
        setPoints(data.points ?? []);
        setToday(String(data.generated_at ?? "").slice(0, 10));
      })
      .catch((err) => {
        console.error("Failed to fetch mortgage history:", err);
        setPoints([]);
      });
  }, []);

  const view = VIEWS[viewIdx];

  const { banks, rows } = useMemo(() => {
    if (!points || points.length === 0) return { banks: [] as string[], rows: [] };
    const inView = points.filter(
      (p) => p.currency_index === view.currency && p.segment === view.segment
    );
    const series: SeriesValues[] = groupMortgageHistory(inView).map((s) => ({
      bankId: s.points[0].bank_id,
      values: s.points.map((p) => ({ date: p.date, value: mortgagePlotValue(p.rate) })),
    }));
    const dates = timelineDates(series, today || latestDate(series));
    const banrepDates = banrepRates
      .map((r) => r.effective_date)
      .filter((d) => d >= dates[0] && d <= dates[dates.length - 1]);
    const allDates = [...new Set([...dates, ...banrepDates])].sort();
    const rows = buildTimeline(series, allDates, min);
    // Best mortgage rate is the lowest → rank ascending (missing → worst).
    const lastVal = (bankId: string): number => {
      const v = Number(rows.at(-1)?.[bankId]);
      return Number.isFinite(v) ? v : Infinity;
    };
    const banks = [...new Set(series.map((s) => s.bankId))].sort((a, b) => lastVal(a) - lastVal(b));
    return { banks, rows };
  }, [points, today, view.currency, view.segment, banrepRates]);

  // Reset selection to the best banks whenever the view changes.
  useEffect(() => {
    setSelected(new Set(banks.slice(0, DEFAULT_BANK_COUNT)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewIdx, points]);

  if (points === null) {
    return <div className="h-96 bg-gray-50 rounded-xl animate-pulse" />;
  }
  if (points.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center">
        Aún no hay suficiente historial para mostrar la evolución de tasas.
      </p>
    );
  }

  const colorOf = (bankId: string) => colorForIndex(banks.indexOf(bankId));
  const lines: ChartLine[] = banks
    .filter((b) => selected.has(b))
    .map((b) => ({
      key: b,
      label: BankNames[b as keyof typeof BankNames] ?? b,
      color: colorOf(b),
    }));

  const unit = view.currency === "UVR" ? "UVR + tasa" : "tasa fija";
  const formatValue = (n: number) =>
    view.currency === "UVR" ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`;

  const toggle = (bankId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bankId)) next.delete(bankId);
      else next.add(bankId);
      return next;
    });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="mb-3">
        <h3 className="text-lg font-medium text-gray-800">Evolución de tasas hipotecarias</h3>
        <p className="text-sm text-gray-500">
          Mejor tasa por banco a lo largo del tiempo ({unit}). Las tasas en UVR (spread) y en pesos
          no son comparables entre sí.
        </p>
      </div>

      {/* View selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {VIEWS.map((v, i) => (
          <button
            key={v.label}
            onClick={() => setViewIdx(i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              i === viewIdx
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-500 hover:text-gray-800"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Bank toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {banks.map((bankId) => {
          const isOn = selected.has(bankId);
          return (
            <button
              key={bankId}
              onClick={() => toggle(bankId)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                isOn
                  ? "border-gray-300 bg-gray-50 text-gray-900"
                  : "border-gray-200 bg-white text-gray-400 hover:text-gray-600"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: isOn ? colorOf(bankId) : "#d1d5db" }}
              />
              {BankNames[bankId as keyof typeof BankNames] ?? bankId}
            </button>
          );
        })}
      </div>

      <RateHistoryChart
        rows={rows}
        lines={lines}
        formatValue={formatValue}
        referenceLinesLabel="Tasa de intervención BanRep"
        referenceLines={banrepRates
          .filter(
            (r) =>
              r.effective_date >= (rows[0]?.date ?? "") &&
              r.effective_date <= (rows.at(-1)?.date ?? "")
          )
          .map((r) => ({ date: r.effective_date, label: r.label, rate: r.rate_ea_percent }))}
      />
    </div>
  );
}

function latestDate(series: SeriesValues[]): string {
  let latest = "";
  for (const s of series) for (const v of s.values) if (v.date > latest) latest = v.date;
  return latest;
}
