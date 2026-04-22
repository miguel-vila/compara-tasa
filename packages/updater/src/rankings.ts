import {
  MortgageScenarioKey,
  CurrencyIndex,
  Segment,
  MortgageType,
  Channel,
  type MortgageOffer,
  type MortgageRankings,
  type ScenarioRanking,
  type RankingMetric,
} from "@compara-tasa/core";

type MortgageScenarioFilter = {
  product_type?: MortgageType;
  currency_index?: CurrencyIndex;
  segment?: Segment;
  channel?: Channel;
  hasPayrollDiscount?: boolean;
};

const MORTGAGE_SCENARIO_FILTERS: Record<MortgageScenarioKey, MortgageScenarioFilter> = {
  // Base scenarios - explicitly exclude payroll offers
  [MortgageScenarioKey.BEST_UVR_VIS_HIPOTECARIO]: {
    product_type: MortgageType.HIPOTECARIO,
    currency_index: CurrencyIndex.UVR,
    segment: Segment.VIS,
    hasPayrollDiscount: false,
  },
  [MortgageScenarioKey.BEST_UVR_NO_VIS_HIPOTECARIO]: {
    product_type: MortgageType.HIPOTECARIO,
    currency_index: CurrencyIndex.UVR,
    segment: Segment.NO_VIS,
    hasPayrollDiscount: false,
  },
  [MortgageScenarioKey.BEST_COP_VIS_HIPOTECARIO]: {
    product_type: MortgageType.HIPOTECARIO,
    currency_index: CurrencyIndex.COP,
    segment: Segment.VIS,
    hasPayrollDiscount: false,
  },
  [MortgageScenarioKey.BEST_COP_NO_VIS_HIPOTECARIO]: {
    product_type: MortgageType.HIPOTECARIO,
    currency_index: CurrencyIndex.COP,
    segment: Segment.NO_VIS,
    hasPayrollDiscount: false,
  },
  // Payroll scenarios - only offers with payroll discount
  [MortgageScenarioKey.BEST_UVR_VIS_PAYROLL]: {
    product_type: MortgageType.HIPOTECARIO,
    currency_index: CurrencyIndex.UVR,
    segment: Segment.VIS,
    hasPayrollDiscount: true,
  },
  [MortgageScenarioKey.BEST_UVR_NO_VIS_PAYROLL]: {
    product_type: MortgageType.HIPOTECARIO,
    currency_index: CurrencyIndex.UVR,
    segment: Segment.NO_VIS,
    hasPayrollDiscount: true,
  },
  [MortgageScenarioKey.BEST_COP_VIS_PAYROLL]: {
    product_type: MortgageType.HIPOTECARIO,
    currency_index: CurrencyIndex.COP,
    segment: Segment.VIS,
    hasPayrollDiscount: true,
  },
  [MortgageScenarioKey.BEST_COP_NO_VIS_PAYROLL]: {
    product_type: MortgageType.HIPOTECARIO,
    currency_index: CurrencyIndex.COP,
    segment: Segment.NO_VIS,
    hasPayrollDiscount: true,
  },
  // Other scenarios
  [MortgageScenarioKey.BEST_DIGITAL_HIPOTECARIO]: {
    product_type: MortgageType.HIPOTECARIO,
    channel: Channel.DIGITAL,
  },
};

function matchesFilter(offer: MortgageOffer, filter: MortgageScenarioFilter): boolean {
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

function getOfferMetric(offer: MortgageOffer): RankingMetric {
  if (offer.rate.kind === "COP_FIXED") {
    return { kind: "EA_PERCENT", value: offer.rate.ea_percent_from };
  } else {
    return { kind: "UVR_SPREAD_EA", value: offer.rate.spread_ea_from };
  }
}

function findTopOffers(offers: MortgageOffer[], filter: MortgageScenarioFilter): ScenarioRanking {
  const matching = offers.filter((o) => matchesFilter(o, filter));

  if (matching.length === 0) {
    return [];
  }

  // Sort by metric value (ascending = best)
  matching.sort((a, b) => getOfferMetric(a).value - getOfferMetric(b).value);

  // Group consecutive equal metric values into ranked positions.
  // Cap at 3 distinct rates (so ties are always shown together).
  const groups: ScenarioRanking = [];
  for (const offer of matching) {
    const metric = getOfferMetric(offer);
    const last = groups[groups.length - 1];
    if (last && last.metric.value === metric.value) {
      last.entries.push({ offer_id: offer.id });
    } else {
      if (groups.length >= 3) break;
      groups.push({
        position: groups.length + 1,
        metric,
        entries: [{ offer_id: offer.id }],
      });
    }
  }
  return groups;
}

/**
 * Computes rankings for all mortgage scenarios based on the offers
 */
export function computeMortgageRankings(offers: MortgageOffer[]): MortgageRankings {
  const mortgageScenarios: Partial<Record<MortgageScenarioKey, ScenarioRanking>> = {};

  for (const [key, filter] of Object.entries(MORTGAGE_SCENARIO_FILTERS)) {
    const topOffers = findTopOffers(offers, filter);
    if (topOffers.length > 0) {
      mortgageScenarios[key as MortgageScenarioKey] = topOffers;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    mortgageScenarios,
  };
}
