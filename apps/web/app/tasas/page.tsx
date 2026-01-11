import { Suspense } from "react";
import { RatesTable } from "@/components/rates-table";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata = {
  title: "Todas las Tasas | Mejor Tasa",
  description:
    "Tabla completa de tasas de crédito hipotecario y leasing habitacional en Colombia. Filtra por banco, tipo de crédito, moneda y más.",
};

export default function TasasPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Todas las Tasas</h1>
          <p className="text-gray-600 mb-8">
            Explora y filtra todas las ofertas de crédito hipotecario y leasing habitacional
            disponibles.
          </p>

          <Suspense fallback={<TableSkeleton />}>
            <RatesTable />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 bg-gray-100 rounded animate-pulse" />
      <div className="h-96 bg-gray-50 rounded animate-pulse" />
    </div>
  );
}
