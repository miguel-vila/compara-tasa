import Link from "next/link";
import { fetchSavingsOffers, fetchSavingsRankings } from "@/lib/data";
import {
  SAVINGS_SCENARIO_LABELS,
  SAVINGS_SCENARIO_DESCRIPTIONS,
  SAVINGS_SCENARIO_ICONS,
} from "@/lib/format";
import {
  BankSavingsUrls,
  SavingsScenarioKey,
  type BankId,
  type SavingsOffer,
  type SavingsScenarioRanking,
  type SavingsRankedEntry,
} from "@compara-tasa/core";

// Group scenarios by type for display
const BALANCE_TIER_SCENARIOS: SavingsScenarioKey[] = [
  SavingsScenarioKey.BEST_RATE_UNDER_10M,
  SavingsScenarioKey.BEST_RATE_10M_TO_50M,
  SavingsScenarioKey.BEST_RATE_OVER_50M,
];

const BANK_TYPE_SCENARIOS: SavingsScenarioKey[] = [
  SavingsScenarioKey.BEST_NEOBANK,
  SavingsScenarioKey.BEST_TRADITIONAL,
];

export async function BestSavingsSection() {
  const [{ offers }, rankings] = await Promise.all([fetchSavingsOffers(), fetchSavingsRankings()]);

  const offerMap = new Map(offers.map((o) => [o.id, o]));

  if (offers.length === 0 || Object.keys(rankings.scenarios).length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          No hay datos disponibles en este momento. Por favor, intenta más tarde.
        </p>
      </div>
    );
  }

  const hasBalanceTierData = BALANCE_TIER_SCENARIOS.some(
    (key) => rankings.scenarios[key] && rankings.scenarios[key]!.length > 0
  );
  const hasBankTypeData = BANK_TYPE_SCENARIOS.some(
    (key) => rankings.scenarios[key] && rankings.scenarios[key]!.length > 0
  );

  return (
    <div className="space-y-10">
      {/* Section Header */}
      <div className="flex items-center justify-between">
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

      {/* Balance Tier Section */}
      {hasBalanceTierData && (
        <SavingsRatesSection
          title="Por Monto de Ahorro"
          subtitle="Encuentra la mejor tasa según cuánto quieras ahorrar"
          scenarios={BALANCE_TIER_SCENARIOS}
          rankings={rankings.scenarios}
          offerMap={offerMap}
          theme="amber"
        />
      )}

      {/* Bank Type Section */}
      {hasBankTypeData && (
        <SavingsRatesSection
          title="Por Tipo de Banco"
          subtitle="Compara entre bancos digitales y tradicionales"
          scenarios={BANK_TYPE_SCENARIOS}
          rankings={rankings.scenarios}
          offerMap={offerMap}
          theme="teal"
        />
      )}

      {/* Mobile link */}
      <div className="md:hidden text-center">
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

function SavingsRatesSection({
  title,
  subtitle,
  scenarios,
  rankings,
  offerMap,
  theme,
}: {
  title: string;
  subtitle: string;
  scenarios: SavingsScenarioKey[];
  rankings: Partial<Record<SavingsScenarioKey, SavingsScenarioRanking>>;
  offerMap: Map<string, SavingsOffer>;
  theme: "amber" | "teal";
}) {
  const themeColors = {
    amber: {
      divider: "from-amber-400 to-amber-200/0",
      cardBorder: "border-amber-200 hover:border-amber-300",
      rateColor: "text-amber-600",
      iconBg: "bg-amber-100 text-amber-600",
    },
    teal: {
      divider: "from-teal-400 to-teal-200/0",
      cardBorder: "border-teal-200 hover:border-teal-300",
      rateColor: "text-teal-600",
      iconBg: "bg-teal-100 text-teal-600",
    },
  };

  const colors = themeColors[theme];

  return (
    <div>
      {/* Sub-section Header */}
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-800">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
        <div className={`h-0.5 mt-2 bg-gradient-to-r ${colors.divider} rounded-full w-24`}></div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map((scenarioKey) => {
          const ranking = rankings[scenarioKey];
          if (!ranking || ranking.length === 0) return null;

          return (
            <SavingsScenarioCard
              key={scenarioKey}
              scenarioKey={scenarioKey}
              ranking={ranking}
              offerMap={offerMap}
              colors={colors}
            />
          );
        })}
      </div>
    </div>
  );
}

function SavingsScenarioCard({
  scenarioKey,
  ranking,
  offerMap,
  colors,
}: {
  scenarioKey: SavingsScenarioKey;
  ranking: SavingsRankedEntry[];
  offerMap: Map<string, SavingsOffer>;
  colors: {
    cardBorder: string;
    rateColor: string;
    iconBg: string;
  };
}) {
  return (
    <div
      className={`bg-white rounded-xl border-2 ${colors.cardBorder} overflow-hidden transition-all hover:shadow-md`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <div
          className={`w-10 h-10 ${colors.iconBg} rounded-xl flex items-center justify-center text-xl`}
        >
          {SAVINGS_SCENARIO_ICONS[scenarioKey]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
            Mejor Tasa
          </p>
          <h4 className="text-gray-900 font-semibold truncate">
            {SAVINGS_SCENARIO_LABELS[scenarioKey]}
          </h4>
        </div>
      </div>

      {/* Ranking List */}
      <div className="p-2 space-y-1.5">
        {ranking.map((entry) => {
          const offer = offerMap.get(entry.offer_id);
          if (!offer) return null;

          return (
            <SavingsRankingRow key={entry.offer_id} entry={entry} offer={offer} colors={colors} />
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100">
        <p className="text-[11px] text-gray-400">{SAVINGS_SCENARIO_DESCRIPTIONS[scenarioKey]}</p>
      </div>
    </div>
  );
}

function SavingsRankingRow({
  entry,
  offer,
  colors,
}: {
  entry: SavingsRankedEntry;
  offer: SavingsOffer;
  colors: { rateColor: string };
}) {
  const positionStyles: Record<number, { bg: string; text: string }> = {
    1: { bg: "bg-gradient-to-r from-amber-500 to-yellow-500", text: "text-slate-900" },
    2: { bg: "bg-gradient-to-r from-slate-400 to-slate-300", text: "text-slate-900" },
    3: { bg: "bg-gradient-to-r from-amber-700 to-amber-600", text: "text-white" },
  };

  const style = positionStyles[entry.position] || positionStyles[3];
  const bankUrl = BankSavingsUrls[offer.bank_id as BankId];
  const isFirst = entry.position === 1;

  return (
    <a
      href={bankUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
        isFirst
          ? "bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 hover:from-amber-100 hover:to-amber-100"
          : "bg-gray-50 hover:bg-gray-100"
      }`}
    >
      {/* Position Badge */}
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm ${style.bg} ${style.text}`}
      >
        {entry.position}
      </div>

      {/* Bank Info */}
      <div className="flex-1 min-w-0">
        <p className="text-gray-900 font-medium text-sm truncate">{offer.bank_name}</p>
        <p className="text-gray-500 text-xs truncate">{offer.account_name}</p>
      </div>

      {/* Rate */}
      <div className="text-right flex-shrink-0">
        <p
          className={`font-bold ${isFirst ? `${colors.rateColor} text-lg` : `${colors.rateColor} text-base`}`}
        >
          {entry.metric.value.toFixed(1)}%
        </p>
        <p className="text-[10px] text-gray-400">E.A.</p>
      </div>
    </a>
  );
}
