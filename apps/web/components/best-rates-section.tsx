import { fetchRankings, fetchOffers } from "@/lib/data";
import { formatRate, formatDateTime, SCENARIO_LABELS, SCENARIO_DESCRIPTIONS } from "@/lib/format";
import { ScenarioKey, type Offer } from "@compara-tasa/core";

export async function BestRatesSection() {
  const [rankings, { offers }] = await Promise.all([fetchRankings(), fetchOffers()]);

  const offerMap = new Map(offers.map((o) => [o.id, o]));

  const scenarios = Object.values(ScenarioKey);

  if (Object.keys(rankings.scenarios).length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          No hay datos disponibles en este momento. Por favor, intenta más tarde.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {scenarios.map((scenarioKey) => {
        const ranking = rankings.scenarios[scenarioKey];
        if (!ranking) return null;

        const offer = offerMap.get(ranking.offer_id);
        if (!offer) return null;

        return <BestRateCard key={scenarioKey} scenarioKey={scenarioKey} offer={offer} />;
      })}
    </div>
  );
}

function BestRateCard({ scenarioKey, offer }: { scenarioKey: ScenarioKey; offer: Offer }) {
  const isUvr = offer.currency_index === "UVR";

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <span
            className={`inline-block px-2 py-1 text-xs font-medium rounded ${
              isUvr ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
            }`}
          >
            {isUvr ? "UVR" : "Pesos"}
          </span>
          {offer.segment !== "UNKNOWN" && (
            <span className="ml-2 inline-block px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
              {offer.segment === "VIS" ? "VIS" : "No VIS"}
            </span>
          )}
        </div>
        {offer.channel === "DIGITAL" && (
          <span className="text-xs text-purple-600 font-medium">Digital</span>
        )}
      </div>

      <h3 className="text-sm font-medium text-gray-500 mb-1">{SCENARIO_LABELS[scenarioKey]}</h3>

      <p className="text-3xl font-bold text-gray-900 mb-2">{formatRate(offer.rate)}</p>

      <p className="text-lg font-medium text-gray-700 mb-4">{offer.bank_name}</p>

      <p className="text-xs text-gray-500 mb-2">{SCENARIO_DESCRIPTIONS[scenarioKey]}</p>

      {offer.conditions.payroll_discount && (
        <div className="mt-3 p-2 bg-amber-50 rounded text-xs text-amber-700">
          Descuento nómina:{" "}
          {offer.conditions.payroll_discount.type === "BPS_OFF"
            ? `${offer.conditions.payroll_discount.value} pbs`
            : `${offer.conditions.payroll_discount.value}%`}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
        <p>Recuperado: {formatDateTime(offer.source.retrieved_at)}</p>
        {offer.source.valid_from && <p>Vigente desde: {offer.source.valid_from}</p>}
      </div>
    </div>
  );
}
