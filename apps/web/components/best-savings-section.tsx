import Link from "next/link";
import { fetchSavingsOffers } from "@/lib/data";
import { BankUrls, type BankId, type SavingsOffer } from "@compara-tasa/core";

export async function BestSavingsSection() {
  const { offers } = await fetchSavingsOffers();

  if (offers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          No hay datos disponibles en este momento. Por favor, intenta más tarde.
        </p>
      </div>
    );
  }

  // Get top 3 offers by rate, preferring different banks
  const topOffers = getTopOffersByRate(offers, 3);

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Mejores Cuentas de Ahorro</h2>
            <p className="text-sm text-gray-500">Las tasas más altas para tus ahorros</p>
          </div>
        </div>
        <Link
          href="/ahorros"
          className="hidden md:inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
        >
          Ver todas
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Top Rates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topOffers.map((offer, index) => (
          <SavingsCard key={offer.id} offer={offer} position={index + 1} />
        ))}
      </div>

      {/* Mobile link */}
      <div className="mt-6 md:hidden text-center">
        <Link
          href="/ahorros"
          className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
        >
          Ver todas las cuentas
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function SavingsCard({ offer, position }: { offer: SavingsOffer; position: number }) {
  const bankUrl = BankUrls[offer.bank_id as BankId];

  const positionStyles: Record<number, { bg: string; text: string }> = {
    1: { bg: "bg-gradient-to-r from-amber-500 to-yellow-500", text: "text-slate-900" },
    2: { bg: "bg-gradient-to-r from-slate-400 to-slate-300", text: "text-slate-900" },
    3: { bg: "bg-gradient-to-r from-amber-700 to-amber-600", text: "text-white" },
  };

  const style = positionStyles[position] || positionStyles[3];

  return (
    <a
      href={bankUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`block bg-white rounded-xl border-2 p-4 transition-all hover:shadow-md hover:border-amber-300 ${
        position === 1 ? "border-amber-400 shadow-sm" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${style.bg} ${style.text}`}
        >
          {position}
        </div>
        <p className="text-2xl font-bold text-amber-600">{offer.rate.ea_percent.toFixed(1)}%</p>
      </div>

      <p className="font-semibold text-gray-900 mb-1">{offer.bank_name}</p>
      <p className="text-sm text-gray-500 truncate">{offer.account_name}</p>

      {offer.min_amount_cop && offer.min_amount_cop > 1 && (
        <p className="text-xs text-gray-400 mt-2">
          Desde ${(offer.min_amount_cop / 1_000_000).toFixed(0)}M
        </p>
      )}
    </a>
  );
}

function getTopOffersByRate(offers: SavingsOffer[], count: number): SavingsOffer[] {
  // Sort by rate descending
  const sorted = [...offers].sort((a, b) => b.rate.ea_percent - a.rate.ea_percent);

  // Prefer different banks for diversity
  const result: SavingsOffer[] = [];
  const seenBanks = new Set<string>();

  for (const offer of sorted) {
    if (result.length >= count) break;

    // First pass: pick best from each bank
    if (!seenBanks.has(offer.bank_id)) {
      result.push(offer);
      seenBanks.add(offer.bank_id);
    }
  }

  // If we don't have enough banks, fill with remaining top rates
  if (result.length < count) {
    for (const offer of sorted) {
      if (result.length >= count) break;
      if (!result.includes(offer)) {
        result.push(offer);
      }
    }
  }

  return result;
}
