"use client";

import { useEffect, useState, useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { type SavingsOffer, SavingsAccountType } from "@compara-tasa/core";
import { formatSavingsRate, formatAmountRange, formatDateTime } from "@/lib/format";

const columnHelper = createColumnHelper<SavingsOffer>();

const ACCOUNT_TYPE_LABELS: Record<SavingsAccountType, string> = {
  standard: "Estándar",
  high_yield: "Alto Rendimiento",
  digital: "Digital",
};

export function SavingsRatesTable() {
  const [offers, setOffers] = useState<SavingsOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: "rate", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  useEffect(() => {
    fetch("/data/savings-offers-latest.json")
      .then((res) => res.json())
      .then((data) => {
        setOffers(data.offers || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch savings offers:", err);
        setLoading(false);
      });
  }, []);

  const columns = useMemo(
    () => [
      columnHelper.accessor("bank_name", {
        header: "Banco",
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor("account_name", {
        header: "Cuenta",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("account_type", {
        header: "Tipo",
        cell: (info) => (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              info.getValue() === "high_yield"
                ? "bg-green-100 text-green-700"
                : info.getValue() === "digital"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700"
            }`}
          >
            {ACCOUNT_TYPE_LABELS[info.getValue()]}
          </span>
        ),
        filterFn: "equals",
      }),
      columnHelper.accessor("rate", {
        id: "rate",
        header: "Tasa",
        cell: (info) => (
          <span className="font-mono text-sm">{formatSavingsRate(info.getValue())}</span>
        ),
        sortingFn: (rowA, rowB) => rowA.original.rate.ea_percent - rowB.original.rate.ea_percent,
      }),
      columnHelper.accessor((row) => ({ min: row.min_amount_cop, max: row.max_amount_cop }), {
        id: "amount_range",
        header: "Rango de Saldo",
        cell: (info) => (
          <span className="text-sm">
            {formatAmountRange(info.getValue().min, info.getValue().max)}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.source.retrieved_at, {
        id: "retrieved_at",
        header: "Actualizado",
        cell: (info) => (
          <span className="text-xs text-gray-500">{formatDateTime(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor((row) => row.source, {
        id: "source_url",
        header: "Fuente",
        cell: (info) => {
          const source = info.getValue();
          return (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
            >
              {source.source_type === "PDF" ? "Ver PDF" : "Ver sitio"}
            </a>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: offers,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return <div className="h-96 bg-gray-50 rounded animate-pulse" />;
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
          value={(table.getColumn("account_type")?.getFilterValue() as string) ?? ""}
          onChange={(e) =>
            table.getColumn("account_type")?.setFilterValue(e.target.value || undefined)
          }
        >
          <option value="">Todos los tipos</option>
          <option value={SavingsAccountType.STANDARD}>Estándar</option>
          <option value={SavingsAccountType.HIGH_YIELD}>Alto Rendimiento</option>
          <option value={SavingsAccountType.DIGITAL}>Digital</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  No hay ofertas de cuentas de ahorro disponibles.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap text-gray-900">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-400">
        Mostrando {table.getFilteredRowModel().rows.length} de {offers.length} ofertas
      </div>
    </div>
  );
}
