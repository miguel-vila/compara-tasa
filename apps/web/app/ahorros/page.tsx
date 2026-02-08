import { Suspense } from "react";
import { SavingsRatesTable } from "@/components/savings-rates-table";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata = {
  title: "Cuentas de Ahorro | ComparaTasa",
  description:
    "Compara las mejores tasas de cuentas de ahorro en Colombia. Encuentra la cuenta con mayor rentabilidad para tus ahorros.",
};

export default function AhorrosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-300 mb-2">Cuentas de Ahorro</h1>
          <p className="text-gray-400 mb-8">
            Compara las tasas de interés de las cuentas de ahorro de los bancos colombianos.
          </p>

          <Suspense fallback={<TableSkeleton />}>
            <SavingsRatesTable />
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
