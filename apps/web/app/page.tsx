import { Suspense } from "react";
import Link from "next/link";
import { BestMortgageRatesSection } from "@/components/best-mortgage-rates-section";
import { BestSavingsSection } from "@/components/best-savings-section";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StatsSection } from "@/components/stats-section";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="bg-gradient-to-b from-primary-50 to-white py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Las Mejores Tasas Bancarias de Colombia
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mb-8">
              Comparamos las tasas publicadas por los principales bancos para ayudarte a encontrar
              las mejores opciones en créditos de vivienda y cuentas de ahorro.
            </p>
            <Suspense fallback={<StatsSkeleton />}>
              <StatsSection />
            </Suspense>
          </div>
        </section>

        <section
          id="hipotecas"
          className="py-12 px-4 bg-gradient-to-b from-slate-900 to-slate-800 scroll-mt-4"
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-semibold text-white">Mejores Tasas Hipotecarias</h2>
              <Link
                href="/hipotecario"
                className="hidden md:inline-flex items-center gap-1 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
              >
                Ver todas
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
            <Suspense fallback={<MortgageRatesSkeleton />}>
              <BestMortgageRatesSection />
            </Suspense>
            <div className="mt-8 md:hidden text-center">
              <Link
                href="/hipotecario"
                className="inline-flex items-center gap-1 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
              >
                Ver todas las tasas hipotecarias
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        <section
          id="ahorros"
          className="py-12 px-4 bg-gradient-to-b from-amber-50 to-white scroll-mt-4"
        >
          <div className="max-w-6xl mx-auto">
            <Suspense fallback={<SavingsRatesSkeleton />}>
              <BestSavingsSection />
            </Suspense>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function MortgageRatesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-56 bg-slate-800 rounded-2xl border border-slate-700 animate-pulse"
        />
      ))}
    </div>
  );
}

function SavingsRatesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 bg-amber-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  );
}
