import {
  SavingsScenarioKey,
  SavingsBankType,
  BankTypeClassification,
  type SavingsOffer,
  type SavingsRankings,
  type SavingsScenarioRanking,
  type SavingsRankedEntry,
  type SavingsRankingMetric,
} from "@compara-tasa/core";

type SavingsScenarioFilter = {
  bankType?: SavingsBankType;
  // For balance tier scenarios, we need to find offers accessible at a given balance
  balanceAmount?: number;
};

const SAVINGS_SCENARIO_FILTERS: Record<SavingsScenarioKey, SavingsScenarioFilter> = {
  // Balance tier scenarios - find best rate for a person with X amount
  [SavingsScenarioKey.BEST_RATE_UNDER_10M]: {
    balanceAmount: 5_000_000, // Representative amount: 5M COP
  },
  [SavingsScenarioKey.BEST_RATE_10M_TO_50M]: {
    balanceAmount: 25_000_000, // Representative amount: 25M COP
  },
  [SavingsScenarioKey.BEST_RATE_OVER_50M]: {
    balanceAmount: 100_000_000, // Representative amount: 100M COP
  },
  // Bank type scenarios - find best rate regardless of balance tier
  [SavingsScenarioKey.BEST_NEOBANK]: {
    bankType: SavingsBankType.NEOBANK,
  },
  [SavingsScenarioKey.BEST_TRADITIONAL]: {
    bankType: SavingsBankType.TRADITIONAL,
  },
};

/**
 * Check if an offer is accessible (applies) for a given balance amount.
 * An offer applies if the balance is >= min_amount and <= max_amount (if defined).
 */
function offerAppliesToBalance(offer: SavingsOffer, balance: number): boolean {
  const minAmount = offer.min_amount_cop ?? 0;
  const maxAmount = offer.max_amount_cop ?? Infinity;
  return balance >= minAmount && balance <= maxAmount;
}

function matchesFilter(offer: SavingsOffer, filter: SavingsScenarioFilter): boolean {
  // Check bank type
  if (filter.bankType !== undefined) {
    const offerBankType = BankTypeClassification[offer.bank_id];
    if (offerBankType !== filter.bankType) {
      return false;
    }
  }

  // Check balance tier accessibility
  if (filter.balanceAmount !== undefined) {
    if (!offerAppliesToBalance(offer, filter.balanceAmount)) {
      return false;
    }
  }

  return true;
}

function getOfferMetric(offer: SavingsOffer): SavingsRankingMetric {
  return { kind: "EA_PERCENT", value: offer.rate.ea_percent };
}

/**
 * For savings, we want the HIGHEST rate (unlike mortgages where lower is better).
 * Also, we deduplicate by bank - only show the best offer from each bank.
 */
function findTopOffers(
  offers: SavingsOffer[],
  filter: SavingsScenarioFilter
): SavingsScenarioRanking {
  const matching = offers.filter((o) => matchesFilter(o, filter));

  if (matching.length === 0) {
    return [];
  }

  // Deduplicate by bank - keep only the best offer per bank
  const bestByBank = new Map<string, SavingsOffer>();
  for (const offer of matching) {
    const existing = bestByBank.get(offer.bank_id);
    if (!existing || offer.rate.ea_percent > existing.rate.ea_percent) {
      bestByBank.set(offer.bank_id, offer);
    }
  }

  const deduped = Array.from(bestByBank.values());

  // Sort by rate value (descending = highest rate is best for savings)
  deduped.sort((a, b) => b.rate.ea_percent - a.rate.ea_percent);

  // Return top 3 offers with their positions
  return deduped.slice(0, 3).map(
    (offer, index): SavingsRankedEntry => ({
      position: index + 1,
      offer_id: offer.id,
      metric: getOfferMetric(offer),
    })
  );
}

/**
 * Computes rankings for all savings scenarios based on the offers
 */
export function computeSavingsRankings(offers: SavingsOffer[]): SavingsRankings {
  const scenarios: Partial<Record<SavingsScenarioKey, SavingsScenarioRanking>> = {};

  for (const [key, filter] of Object.entries(SAVINGS_SCENARIO_FILTERS)) {
    const topOffers = findTopOffers(offers, filter);
    if (topOffers.length > 0) {
      scenarios[key as SavingsScenarioKey] = topOffers;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    scenarios,
  };
}
