import { describe, it, expect } from "vitest";
import { computeSavingsRankings } from "./savingsRankings.js";
import type { SavingsOffer } from "@compara-tasa/core";
import { SavingsScenarioKey, SavingsAccountType, BankId } from "@compara-tasa/core";

function createTestOffer(
  id: string,
  bankId: BankId,
  rate: number,
  minAmount?: number,
  maxAmount?: number
): SavingsOffer {
  return {
    id,
    bank_id: bankId,
    bank_name: bankId,
    account_type: SavingsAccountType.HIGH_YIELD,
    account_name: "Test Account",
    rate: { ea_percent: rate },
    min_amount_cop: minAmount,
    max_amount_cop: maxAmount,
    source: {
      kind: "scrapped",
      url: "https://test.com",
      source_type: "HTML",
      retrieved_at: new Date().toISOString(),
      extraction: {
        method: "REGEX",
        locator: "test",
      },
    },
  };
}

describe("computeSavingsRankings", () => {
  it("should rank offers by highest rate (descending)", () => {
    const offers: SavingsOffer[] = [
      createTestOffer("1", BankId.BAN100, 8.0, 1),
      createTestOffer("2", BankId.LULO, 10.0, 1),
      createTestOffer("3", BankId.RAPPIPAY, 9.0, 1),
    ];

    const rankings = computeSavingsRankings(offers);

    const neobankRanking = rankings.scenarios[SavingsScenarioKey.BEST_NEOBANK];
    expect(neobankRanking).toBeDefined();
    expect(neobankRanking!.length).toBe(3);

    // Highest rate should be first
    expect(neobankRanking![0].offer_id).toBe("2"); // Lulo 10%
    expect(neobankRanking![0].metric.value).toBe(10.0);

    expect(neobankRanking![1].offer_id).toBe("3"); // RappiPay 9%
    expect(neobankRanking![2].offer_id).toBe("1"); // Ban100 8%
  });

  it("should deduplicate by bank, keeping best offer per bank", () => {
    const offers: SavingsOffer[] = [
      createTestOffer("1", BankId.BAN100, 6.0, 1, 10_000_000),
      createTestOffer("2", BankId.BAN100, 9.0, 10_000_001, 30_000_000),
      createTestOffer("3", BankId.BAN100, 10.0, 30_000_001),
      createTestOffer("4", BankId.LULO, 7.5, 1),
    ];

    const rankings = computeSavingsRankings(offers);

    const neobankRanking = rankings.scenarios[SavingsScenarioKey.BEST_NEOBANK];
    expect(neobankRanking).toBeDefined();
    // Should have 2 banks (Ban100 best offer + Lulo), not 4 offers
    expect(neobankRanking!.length).toBe(2);

    // Ban100's best offer (10%) should be first
    expect(neobankRanking![0].offer_id).toBe("3");
    expect(neobankRanking![0].metric.value).toBe(10.0);

    // Lulo's offer should be second
    expect(neobankRanking![1].offer_id).toBe("4");
  });

  it("should filter by balance tier for under_10m scenario", () => {
    const offers: SavingsOffer[] = [
      // Ban100 tiered rates
      createTestOffer("ban100-low", BankId.BAN100, 6.0, 1, 10_000_000),
      createTestOffer("ban100-mid", BankId.BAN100, 9.0, 10_000_001, 30_000_000),
      createTestOffer("ban100-high", BankId.BAN100, 10.0, 30_000_001),
      // Lulo single rate
      createTestOffer("lulo", BankId.LULO, 7.5, 1),
    ];

    const rankings = computeSavingsRankings(offers);

    // For under 10M scenario, only offers with min <= 5M and max >= 5M should apply
    const under10mRanking = rankings.scenarios[SavingsScenarioKey.BEST_RATE_UNDER_10M];
    expect(under10mRanking).toBeDefined();

    // Lulo (7.5%) should be best, then Ban100 low tier (6.0%)
    expect(under10mRanking![0].offer_id).toBe("lulo");
    expect(under10mRanking![0].metric.value).toBe(7.5);

    expect(under10mRanking![1].offer_id).toBe("ban100-low");
    expect(under10mRanking![1].metric.value).toBe(6.0);
  });

  it("should filter by balance tier for over_50m scenario", () => {
    const offers: SavingsOffer[] = [
      // Ban100 tiered rates
      createTestOffer("ban100-low", BankId.BAN100, 6.0, 1, 10_000_000),
      createTestOffer("ban100-high", BankId.BAN100, 10.0, 30_000_001),
      // BBVA premium tier
      createTestOffer("bbva-premium", BankId.BBVA, 8.0, 50_000_000),
    ];

    const rankings = computeSavingsRankings(offers);

    // For over 50M scenario (100M test amount), only high tier offers should apply
    const over50mRanking = rankings.scenarios[SavingsScenarioKey.BEST_RATE_OVER_50M];
    expect(over50mRanking).toBeDefined();

    // Ban100 high tier (10%) should be first (accessible at 100M)
    expect(over50mRanking![0].offer_id).toBe("ban100-high");
    expect(over50mRanking![0].metric.value).toBe(10.0);

    // BBVA premium (8%) should be second
    expect(over50mRanking![1].offer_id).toBe("bbva-premium");
  });

  it("should separate neobank and traditional bank rankings", () => {
    const offers: SavingsOffer[] = [
      createTestOffer("ban100", BankId.BAN100, 10.0, 1), // neobank
      createTestOffer("lulo", BankId.LULO, 9.0, 1), // neobank
      createTestOffer("bbva", BankId.BBVA, 8.0, 1), // traditional
      createTestOffer("caja", BankId.BANCO_CAJA_SOCIAL, 7.0, 1), // traditional
    ];

    const rankings = computeSavingsRankings(offers);

    // Neobank ranking should only include Ban100 and Lulo
    const neobankRanking = rankings.scenarios[SavingsScenarioKey.BEST_NEOBANK];
    expect(neobankRanking).toBeDefined();
    expect(neobankRanking!.length).toBe(2);
    expect(neobankRanking![0].offer_id).toBe("ban100");
    expect(neobankRanking![1].offer_id).toBe("lulo");

    // Traditional ranking should only include BBVA and Caja Social
    const traditionalRanking = rankings.scenarios[SavingsScenarioKey.BEST_TRADITIONAL];
    expect(traditionalRanking).toBeDefined();
    expect(traditionalRanking!.length).toBe(2);
    expect(traditionalRanking![0].offer_id).toBe("bbva");
    expect(traditionalRanking![1].offer_id).toBe("caja");
  });

  it("should limit rankings to top 3", () => {
    const offers: SavingsOffer[] = [
      createTestOffer("1", BankId.BAN100, 10.0, 1),
      createTestOffer("2", BankId.LULO, 9.5, 1),
      createTestOffer("3", BankId.RAPPIPAY, 9.0, 1),
      createTestOffer("4", BankId.PIBANK, 8.5, 1),
      createTestOffer("5", BankId.UALA, 8.0, 1),
    ];

    const rankings = computeSavingsRankings(offers);

    const neobankRanking = rankings.scenarios[SavingsScenarioKey.BEST_NEOBANK];
    expect(neobankRanking).toBeDefined();
    expect(neobankRanking!.length).toBe(3);

    // Verify positions
    expect(neobankRanking![0].position).toBe(1);
    expect(neobankRanking![1].position).toBe(2);
    expect(neobankRanking![2].position).toBe(3);
  });
});
