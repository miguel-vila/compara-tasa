"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { ChartRow } from "@/lib/history";

export type ChartLine = { key: string; label: string; color: string };

function shortDate(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yy", { locale: es });
  } catch {
    return iso;
  }
}

export function RateHistoryChart({
  rows,
  lines,
  formatValue,
  height = 380,
}: {
  rows: ChartRow[];
  lines: ChartLine[];
  formatValue: (n: number) => string;
  height?: number;
}) {
  if (lines.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Selecciona al menos un banco para ver la evolución.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={formatValue}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          width={64}
          domain={["auto", "auto"]}
        />
        <Tooltip
          labelFormatter={(d) => shortDate(String(d))}
          formatter={(value, name) => [formatValue(Number(value)), name]}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e7eb" }}
        />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="stepAfter"
            dataKey={line.key}
            name={line.label}
            stroke={line.color}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
