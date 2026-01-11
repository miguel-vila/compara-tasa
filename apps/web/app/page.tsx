import { Suspense } from "react";
import { BestRatesSection } from "@/components/best-rates-section";
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
              Las Mejores Tasas Hipotecarias de Colombia
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mb-8">
              Comparamos las tasas publicadas por los principales bancos para ayudarte a encontrar
              el mejor crédito de vivienda.
            </p>
            <Suspense fallback={<StatsSkeleton />}>
              <StatsSection />
            </Suspense>
          </div>
        </section>

        <section className="py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-300 mb-8">
              Mejores Tasas por Categoría
            </h2>
            <Suspense fallback={<BestRatesSkeleton />}>
              <BestRatesSection />
            </Suspense>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function BestRatesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="flex flex-wrap gap-8">
      <div className="h-20 w-40 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-20 w-40 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  );
}
