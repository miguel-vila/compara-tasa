import { fetchRankings, fetchOffers } from "@/lib/data";
import { formatRate, SCENARIO_LABELS, SCENARIO_DESCRIPTIONS } from "@/lib/format";
import {
  ScenarioKey,
  type Offer,
  type RankedEntry,
  type ScenarioRanking,
} from "@compara-tasa/core";

// Group scenarios by type
const STANDARD_SCENARIOS: ScenarioKey[] = [
  ScenarioKey.BEST_UVR_VIS_HIPOTECARIO,
  ScenarioKey.BEST_UVR_NO_VIS_HIPOTECARIO,
  ScenarioKey.BEST_COP_VIS_HIPOTECARIO,
  ScenarioKey.BEST_COP_NO_VIS_HIPOTECARIO,
  ScenarioKey.BEST_DIGITAL_HIPOTECARIO,
];

const PAYROLL_SCENARIOS: ScenarioKey[] = [
  ScenarioKey.BEST_UVR_VIS_PAYROLL,
  ScenarioKey.BEST_UVR_NO_VIS_PAYROLL,
  ScenarioKey.BEST_COP_VIS_PAYROLL,
  ScenarioKey.BEST_COP_NO_VIS_PAYROLL,
];

type ThemeConfig = {
  iconBg: string;
  accentText: string;
  cardBorder: string;
  rateColorFirst: string;
  rateColorOther: string;
  dividerGradient: string;
};

const STANDARD_THEME: ThemeConfig = {
  iconBg: "bg-gradient-to-br from-teal-600 to-teal-700",
  accentText: "text-teal-400",
  cardBorder: "border-slate-700",
  rateColorFirst: "text-teal-300",
  rateColorOther: "text-teal-400",
  dividerGradient: "from-teal-500 to-teal-600/0",
};

const PAYROLL_THEME: ThemeConfig = {
  iconBg: "bg-gradient-to-br from-violet-600 to-purple-700",
  accentText: "text-violet-400",
  cardBorder: "border-violet-500/30",
  rateColorFirst: "text-violet-300",
  rateColorOther: "text-violet-400",
  dividerGradient: "from-violet-500 to-purple-600/0",
};

export async function BestRatesSection() {
  const [rankings, { offers }] = await Promise.all([fetchRankings(), fetchOffers()]);

  const offerMap = new Map(offers.map((o) => [o.id, o]));

  if (Object.keys(rankings.scenarios).length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          No hay datos disponibles en este momento. Por favor, intenta más tarde.
        </p>
      </div>
    );
  }

  // Check which scenarios have data
  const hasStandardData = STANDARD_SCENARIOS.some(
    (key) => rankings.scenarios[key] && rankings.scenarios[key]!.length > 0
  );
  const hasPayrollData = PAYROLL_SCENARIOS.some(
    (key) => rankings.scenarios[key] && rankings.scenarios[key]!.length > 0
  );

  return (
    <div className="space-y-12">
      {/* Standard Rates Section */}
      {hasStandardData && (
        <RatesSection
          title="Tasas Estándar"
          subtitle="Sin requisito de nómina - Disponible para todos"
          icon={
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
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          scenarios={STANDARD_SCENARIOS}
          rankings={rankings.scenarios}
          offerMap={offerMap}
          theme={STANDARD_THEME}
        />
      )}

      {/* Payroll Rates Section */}
      {hasPayrollData && (
        <RatesSection
          title="Con Beneficio de Nómina"
          subtitle="Requiere tener tu nómina en el banco para acceder a estas tasas"
          icon={<span className="text-lg">💼</span>}
          scenarios={PAYROLL_SCENARIOS}
          rankings={rankings.scenarios}
          offerMap={offerMap}
          theme={PAYROLL_THEME}
        />
      )}
    </div>
  );
}

function RatesSection({
  title,
  subtitle,
  icon,
  scenarios,
  rankings,
  offerMap,
  theme,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  scenarios: ScenarioKey[];
  rankings: Partial<Record<ScenarioKey, ScenarioRanking>>;
  offerMap: Map<string, Offer>;
  theme: ThemeConfig;
}) {
  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 ${theme.iconBg} rounded-xl flex items-center justify-center`}>
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className={`h-1 bg-gradient-to-r ${theme.dividerGradient} rounded-full`}></div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenarios.map((scenarioKey) => {
          const ranking = rankings[scenarioKey];
          if (!ranking || ranking.length === 0) return null;

          return (
            <CompactRankingCard
              key={scenarioKey}
              scenarioKey={scenarioKey}
              ranking={ranking}
              offerMap={offerMap}
              theme={theme}
            />
          );
        })}
      </div>
    </div>
  );
}

function CompactRankingCard({
  scenarioKey,
  ranking,
  offerMap,
  theme,
}: {
  scenarioKey: ScenarioKey;
  ranking: RankedEntry[];
  offerMap: Map<string, Offer>;
  theme: ThemeConfig;
}) {
  // Determine icon based on scenario
  const getScenarioIcon = (key: ScenarioKey) => {
    if (key.includes("uvr")) return "📈";
    if (key.includes("cop")) return "💵";
    if (key.includes("digital")) return "📱";
    return "🏦";
  };

  return (
    <div className={`bg-slate-800 rounded-2xl border ${theme.cardBorder} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-700">
        <div
          className={`w-10 h-10 ${theme.iconBg} rounded-xl flex items-center justify-center text-lg`}
        >
          {getScenarioIcon(scenarioKey)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] uppercase tracking-wider ${theme.accentText} font-medium`}>
            Mejor Tasa
          </p>
          <h3 className="text-white font-semibold truncate">{SCENARIO_LABELS[scenarioKey]}</h3>
        </div>
      </div>

      {/* Ranking List */}
      <div className="p-2 space-y-1.5">
        {ranking.map((entry) => {
          const offer = offerMap.get(entry.offer_id);
          if (!offer) return null;

          return (
            <RankingRow
              key={entry.offer_id}
              entry={entry}
              offer={offer}
              isFirst={entry.position === 1}
              theme={theme}
            />
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-700">
        <p className="text-[11px] text-slate-500">{SCENARIO_DESCRIPTIONS[scenarioKey]}</p>
      </div>
    </div>
  );
}

function RankingRow({
  entry,
  offer,
  isFirst,
  theme,
}: {
  entry: RankedEntry;
  offer: Offer;
  isFirst: boolean;
  theme: ThemeConfig;
}) {
  const positionStyles: Record<number, { bg: string; text: string }> = {
    1: { bg: "bg-gradient-to-r from-amber-500 to-yellow-500", text: "text-slate-900" },
    2: { bg: "bg-gradient-to-r from-slate-400 to-slate-300", text: "text-slate-900" },
    3: { bg: "bg-gradient-to-r from-amber-700 to-amber-600", text: "text-white" },
  };

  const style = positionStyles[entry.position] || positionStyles[3];

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
        isFirst
          ? "bg-gradient-to-r from-slate-800 to-amber-500/10 border border-amber-500/30"
          : "bg-slate-800/50 hover:bg-slate-700/50"
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
        <p className="text-white font-medium text-sm truncate">{offer.bank_name}</p>
      </div>

      {/* Rate */}
      <div className="text-right flex-shrink-0">
        <p
          className={`font-bold ${isFirst ? `${theme.rateColorFirst} text-lg` : `${theme.rateColorOther} text-base`}`}
        >
          {formatRate(offer.rate)}
        </p>
      </div>
    </div>
  );
}
