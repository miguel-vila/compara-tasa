import {
  ScenarioKey,
  CurrencyIndex,
  Segment,
  ProductType,
  Channel,
  type Offer,
  type Rankings,
  type ScenarioRanking,
  type RankedEntry,
  type RankingMetric,
} from "@compara-tasa/core";

type ScenarioFilter = {
  product_type?: ProductType;
  currency_index?: CurrencyIndex;
  segment?: Segment;
  channel?: Channel;
  hasPayrollDiscount?: boolean;
};

const SCENARIO_FILTERS: Record<ScenarioKey, ScenarioFilter> = {
  // Base scenarios - explicitly exclude payroll offers
  [ScenarioKey.BEST_UVR_VIS_HIPOTECARIO]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.UVR,
    segment: Segment.VIS,
    hasPayrollDiscount: false,
  },
  [ScenarioKey.BEST_UVR_NO_VIS_HIPOTECARIO]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.UVR,
    segment: Segment.NO_VIS,
    hasPayrollDiscount: false,
  },
  [ScenarioKey.BEST_COP_VIS_HIPOTECARIO]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.COP,
    segment: Segment.VIS,
    hasPayrollDiscount: false,
  },
  [ScenarioKey.BEST_COP_NO_VIS_HIPOTECARIO]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.COP,
    segment: Segment.NO_VIS,
    hasPayrollDiscount: false,
  },
  // Payroll scenarios - only offers with payroll discount
  [ScenarioKey.BEST_UVR_VIS_PAYROLL]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.UVR,
    segment: Segment.VIS,
    hasPayrollDiscount: true,
  },
  [ScenarioKey.BEST_UVR_NO_VIS_PAYROLL]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.UVR,
    segment: Segment.NO_VIS,
    hasPayrollDiscount: true,
  },
  [ScenarioKey.BEST_COP_VIS_PAYROLL]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.COP,
    segment: Segment.VIS,
    hasPayrollDiscount: true,
  },
  [ScenarioKey.BEST_COP_NO_VIS_PAYROLL]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.COP,
    segment: Segment.NO_VIS,
    hasPayrollDiscount: true,
  },
  // Other scenarios
  [ScenarioKey.BEST_DIGITAL_HIPOTECARIO]: {
    product_type: ProductType.HIPOTECARIO,
    channel: Channel.DIGITAL,
  },
};

function matchesFilter(offer: Offer, filter: ScenarioFilter): boolean {
  if (filter.product_type && offer.product_type !== filter.product_type) {
    return false;
  }
  if (filter.currency_index && offer.currency_index !== filter.currency_index) {
    return false;
  }
  if (filter.segment && offer.segment !== filter.segment) {
    return false;
  }
  if (filter.channel && offer.channel !== filter.channel) {
    return false;
  }
  // Handle payroll filter: true = must have payroll, false = must NOT have payroll
  if (filter.hasPayrollDiscount !== undefined) {
    const hasPayroll = !!offer.conditions.payroll_discount;
    if (filter.hasPayrollDiscount !== hasPayroll) {
      return false;
    }
  }
  return true;
}

function getOfferMetric(offer: Offer): RankingMetric {
  if (offer.rate.kind === "COP_FIXED") {
    return { kind: "EA_PERCENT", value: offer.rate.ea_percent_from };
  } else {
    return { kind: "UVR_SPREAD_EA", value: offer.rate.spread_ea_from };
  }
}

function findTopOffers(offers: Offer[], filter: ScenarioFilter): ScenarioRanking {
  const matching = offers.filter((o) => matchesFilter(o, filter));

  if (matching.length === 0) {
    return [];
  }

  // Sort by metric value (ascending = best)
  matching.sort((a, b) => {
    const metricA = getOfferMetric(a);
    const metricB = getOfferMetric(b);
    return metricA.value - metricB.value;
  });

  // Return top 3 offers with their positions
  return matching.slice(0, 3).map(
    (offer, index): RankedEntry => ({
      position: index + 1,
      offer_id: offer.id,
      metric: getOfferMetric(offer),
    })
  );
}

/**
 * Computes rankings for all scenarios based on the offers
 */
export function computeRankings(offers: Offer[]): Rankings {
  const scenarios: Partial<Record<ScenarioKey, ScenarioRanking>> = {};

  for (const [key, filter] of Object.entries(SCENARIO_FILTERS)) {
    const topOffers = findTopOffers(offers, filter);
    if (topOffers.length > 0) {
      scenarios[key as ScenarioKey] = topOffers;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    scenarios,
  };
}
