"use client";

import { useEffect, useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { type Offer, ProductType, CurrencyIndex, Segment } from "@mejor-tasa/core";
import { formatRate, formatDateTime } from "@/lib/format";

export function RatesTable() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  useEffect(() => {
    fetch("/data/offers-latest.json")
      .then((res) => res.json())
      .then((data) => {
        setOffers(data.offers || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch offers:", err);
        setLoading(false);
      });
  }, []);

  const columns = useMemo<ColumnDef<Offer>[]>(
    () => [
      {
        accessorKey: "bank_name",
        header: "Banco",
        cell: (info) => <span className="font-medium">{info.getValue() as string}</span>,
      },
      {
        accessorKey: "product_type",
        header: "Tipo",
        cell: (info) => <span className="capitalize">{info.getValue() as string}</span>,
        filterFn: "equals",
      },
      {
        accessorKey: "currency_index",
        header: "Moneda",
        cell: (info) => {
          const value = info.getValue() as string;
          return (
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                value === "UVR" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
              }`}
            >
              {value}
            </span>
          );
        },
        filterFn: "equals",
      },
      {
        accessorKey: "segment",
        header: "Segmento",
        cell: (info) => {
          const value = info.getValue() as string;
          if (value === "UNKNOWN") return "-";
          return value === "VIS" ? "VIS" : "No VIS";
        },
        filterFn: "equals",
      },
      {
        accessorKey: "rate",
        header: "Tasa",
        cell: (info) => (
          <span className="font-mono text-sm">{formatRate(info.getValue() as Offer["rate"])}</span>
        ),
        sortingFn: (rowA, rowB) => {
          const rateA = rowA.original.rate;
          const rateB = rowB.original.rate;
          const valA = rateA.kind === "COP_FIXED" ? rateA.ea_percent_from : rateA.spread_ea_from;
          const valB = rateB.kind === "COP_FIXED" ? rateB.ea_percent_from : rateB.spread_ea_from;
          return valA - valB;
        },
      },
      {
        accessorKey: "channel",
        header: "Canal",
        cell: (info) => {
          const value = info.getValue() as string;
          if (value === "DIGITAL") {
            return <span className="text-purple-600 text-xs font-medium">Digital</span>;
          }
          return <span className="text-gray-400 text-xs">-</span>;
        },
      },
      {
        accessorFn: (row) => row.conditions.payroll_discount != null,
        id: "payroll",
        header: "Nómina",
        cell: (info) =>
          info.getValue() ? (
            <span className="text-amber-600 text-xs">Sí</span>
          ) : (
            <span className="text-gray-400 text-xs">-</span>
          ),
      },
      {
        accessorFn: (row) => row.source.retrieved_at,
        id: "retrieved_at",
        header: "Actualizado",
        cell: (info) => (
          <span className="text-xs text-gray-500">{formatDateTime(info.getValue() as string)}</span>
        ),
      },
      {
        accessorFn: (row) => row.source,
        id: "source_url",
        header: "Fuente",
        cell: (info) => {
          const source = info.getValue() as Offer["source"];
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
      },
    ],
    []
  );

  const table = useReactTable({
    data: offers,
    columns,
    state: {
      sorting,
      columnFilters,
    },
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
          value={(table.getColumn("product_type")?.getFilterValue() as string) ?? ""}
          onChange={(e) =>
            table.getColumn("product_type")?.setFilterValue(e.target.value || undefined)
          }
        >
          <option value="">Todos los tipos</option>
          <option value={ProductType.HIPOTECARIO}>Hipotecario</option>
          <option value={ProductType.LEASING}>Leasing</option>
        </select>

        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
          value={(table.getColumn("currency_index")?.getFilterValue() as string) ?? ""}
          onChange={(e) =>
            table.getColumn("currency_index")?.setFilterValue(e.target.value || undefined)
          }
        >
          <option value="">Todas las monedas</option>
          <option value={CurrencyIndex.COP}>Pesos (COP)</option>
          <option value={CurrencyIndex.UVR}>UVR</option>
        </select>

        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
          value={(table.getColumn("segment")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("segment")?.setFilterValue(e.target.value || undefined)}
        >
          <option value="">Todos los segmentos</option>
          <option value={Segment.VIS}>VIS</option>
          <option value={Segment.NO_VIS}>No VIS</option>
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
                  No hay ofertas disponibles con los filtros seleccionados.
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

      <div className="mt-4 text-sm text-gray-500">
        Mostrando {table.getFilteredRowModel().rows.length} de {offers.length} ofertas
      </div>
    </div>
  );
}
