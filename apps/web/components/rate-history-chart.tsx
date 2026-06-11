"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { ChartRow } from "@/lib/history";

export type ChartLine = { key: string; label: string; color: string };
export type ReferenceLineData = { date: string; label: string; rate: number };

const REFERENCE_LINE_COLOR = "#6b7280";
const BANREP_RATE_COLOR = "#92400e";

function BanrepLabel({
  viewBox,
  rate,
  date,
}: {
  viewBox?: { x: number; y: number };
  rate: number;
  date: string;
}) {
  if (!viewBox) return null;
  const x = viewBox.x + 3;
  const y = viewBox.y + 2;
  const w = 48;
  const h = 30;
  const cx = x + w / 2;
  return (
    <g>
      <title>{`${shortDate(date)} · ${rate.toFixed(2)}%`}</title>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        fill="white"
        stroke="#e5e7eb"
        strokeWidth={0.5}
        opacity={0.95}
      />
      <text x={cx} y={y + 12} fontSize={9} fill={REFERENCE_LINE_COLOR} textAnchor="middle">
        {shortDate(date)}
      </text>
      <text
        x={cx}
        y={y + 25}
        fontSize={11}
        fill={BANREP_RATE_COLOR}
        fontWeight={700}
        textAnchor="middle"
      >
        {rate.toFixed(2)}%
      </text>
    </g>
  );
}

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
  referenceLines,
  referenceLinesLabel,
}: {
  rows: ChartRow[];
  lines: ChartLine[];
  formatValue: (n: number) => string;
  height?: number;
  referenceLines?: ReferenceLineData[];
  referenceLinesLabel?: string;
}) {
  if (lines.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Selecciona al menos un banco para ver la evolución.
      </div>
    );
  }

  return (
    <div>
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
          {referenceLines?.map((rl) => (
            <ReferenceLine
              key={rl.date}
              x={rl.date}
              stroke={REFERENCE_LINE_COLOR}
              strokeDasharray="4 2"
              label={(props: { viewBox?: { x: number; y: number } }) => (
                <BanrepLabel viewBox={props.viewBox} rate={rl.rate} date={rl.date} />
              )}
            />
          ))}
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
      {referenceLinesLabel && referenceLines && referenceLines.length > 0 && (
        <div className="flex items-center gap-1.5 mt-1 pl-16 text-xs text-gray-500">
          <svg width="20" height="10" aria-hidden="true">
            <line
              x1="0"
              y1="5"
              x2="20"
              y2="5"
              stroke={REFERENCE_LINE_COLOR}
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          </svg>
          {referenceLinesLabel}
        </div>
      )}
    </div>
  );
}
