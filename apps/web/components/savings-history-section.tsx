"use client";

import { useEffect, useMemo, useState } from "react";
import {
  groupSavingsHistory,
  savingsPlotValue,
  BankNames,
  type SavingsHistoryPoint,
} from "@compara-tasa/core";
import { buildTimeline, timelineDates, colorForIndex, max, type SeriesValues } from "@/lib/history";
import { RateHistoryChart, type ChartLine } from "./rate-history-chart";
import { useBanrepRates } from "@/lib/useBanrepRates";

const DEFAULT_BANK_COUNT = 5;

export function SavingsHistorySection() {
  const [points, setPoints] = useState<SavingsHistoryPoint[] | null>(null);
  const [today, setToday] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const banrepRates = useBanrepRates();

  useEffect(() => {
    fetch("/data/savings-history.json")
      .then((res) => res.json())
      .then((data) => {
        setPoints(data.points ?? []);
        setToday(String(data.generated_at ?? "").slice(0, 10));
      })
      .catch((err) => {
        console.error("Failed to fetch savings history:", err);
        setPoints([]);
      });
  }, []);

  const { banks, rows } = useMemo(() => {
    if (!points || points.length === 0) {
      return { banks: [] as string[], rows: [] };
    }
    const series: SeriesValues[] = groupSavingsHistory(points).map((s) => ({
      bankId: s.points[0].bank_id,
      values: s.points.map((p) => ({ date: p.date, value: savingsPlotValue(p.rate) })),
    }));
    const dates = timelineDates(series, today || datesFallback(series));
    const banrepDates = banrepRates
      .map((r) => r.effective_date)
      .filter((d) => d >= dates[0] && d <= dates[dates.length - 1]);
    const allDates = [...new Set([...dates, ...banrepDates])].sort();
    const rows = buildTimeline(series, allDates, max);

    // Rank banks by their most recent best rate (highest first) for color + default selection.
    const banks = [...new Set(series.map((s) => s.bankId))].sort(
      (a, b) => (Number(rows.at(-1)?.[b]) || 0) - (Number(rows.at(-1)?.[a]) || 0)
    );
    return { banks, rows };
  }, [points, today, banrepRates]);

  // Default to the top banks once data lands.
  useEffect(() => {
    if (banks.length > 0 && selected.size === 0) {
      setSelected(new Set(banks.slice(0, DEFAULT_BANK_COUNT)));
    }
  }, [banks, selected.size]);

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

  const toggle = (bankId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bankId)) next.delete(bankId);
      else next.add(bankId);
      return next;
    });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="mb-1">
        <h3 className="text-lg font-medium text-gray-800">Evolución de tasas de ahorro</h3>
        <p className="text-sm text-gray-500">
          Mejor tasa E.A. por banco a lo largo del tiempo. Pasa el cursor para ver el detalle.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 my-4">
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
        formatValue={(n) => `${n.toFixed(1)}%`}
        referenceLinesLabel="Cambio en tasa de intervención BanRep"
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

function datesFallback(series: SeriesValues[]): string {
  let latest = "";
  for (const s of series) for (const v of s.values) if (v.date > latest) latest = v.date;
  return latest;
}
