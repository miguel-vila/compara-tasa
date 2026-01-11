import {
  ScenarioKey,
  CurrencyIndex,
  Segment,
  ProductType,
  Channel,
  type Offer,
  type Rankings,
  type ScenarioRanking,
  type RankingMetric,
} from "@mejor-tasa/core";

type ScenarioFilter = {
  product_type?: ProductType;
  currency_index?: CurrencyIndex;
  segment?: Segment;
  channel?: Channel;
  hasPayrollDiscount?: boolean;
};

const SCENARIO_FILTERS: Record<ScenarioKey, ScenarioFilter> = {
  [ScenarioKey.BEST_UVR_VIS_HIPOTECARIO]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.UVR,
    segment: Segment.VIS,
  },
  [ScenarioKey.BEST_UVR_NO_VIS_HIPOTECARIO]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.UVR,
    segment: Segment.NO_VIS,
  },
  [ScenarioKey.BEST_COP_VIS_HIPOTECARIO]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.COP,
    segment: Segment.VIS,
  },
  [ScenarioKey.BEST_COP_NO_VIS_HIPOTECARIO]: {
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.COP,
    segment: Segment.NO_VIS,
  },
  [ScenarioKey.BEST_PAYROLL_BENEFIT]: {
    hasPayrollDiscount: true,
  },
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
  if (filter.hasPayrollDiscount && !offer.conditions.payroll_discount) {
    return false;
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

function findBestOffer(offers: Offer[], filter: ScenarioFilter): ScenarioRanking | undefined {
  const matching = offers.filter((o) => matchesFilter(o, filter));

  if (matching.length === 0) {
    return undefined;
  }

  // Sort by metric value (ascending = best)
  matching.sort((a, b) => {
    const metricA = getOfferMetric(a);
    const metricB = getOfferMetric(b);
    return metricA.value - metricB.value;
  });

  const best = matching[0];
  return {
    offer_id: best.id,
    metric: getOfferMetric(best),
  };
}

/**
 * Computes rankings for all scenarios based on the offers
 */
export function computeRankings(offers: Offer[]): Rankings {
  const scenarios: Partial<Record<ScenarioKey, ScenarioRanking>> = {};

  for (const [key, filter] of Object.entries(SCENARIO_FILTERS)) {
    const best = findBestOffer(offers, filter);
    if (best) {
      scenarios[key as ScenarioKey] = best;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    scenarios,
  };
}
