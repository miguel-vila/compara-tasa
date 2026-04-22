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

    expect(neobankRanking![0].position).toBe(1);
    expect(neobankRanking![0].metric.value).toBe(10.0);
    expect(neobankRanking![0].entries).toEqual([{ offer_id: "2" }]);

    expect(neobankRanking![1].position).toBe(2);
    expect(neobankRanking![1].entries).toEqual([{ offer_id: "3" }]);

    expect(neobankRanking![2].position).toBe(3);
    expect(neobankRanking![2].entries).toEqual([{ offer_id: "1" }]);
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

    expect(neobankRanking![0].metric.value).toBe(10.0);
    expect(neobankRanking![0].entries).toEqual([{ offer_id: "3" }]);
    expect(neobankRanking![1].entries).toEqual([{ offer_id: "4" }]);
  });

  it("should filter by balance tier for under_10m scenario", () => {
    const offers: SavingsOffer[] = [
      createTestOffer("ban100-low", BankId.BAN100, 6.0, 1, 10_000_000),
      createTestOffer("ban100-mid", BankId.BAN100, 9.0, 10_000_001, 30_000_000),
      createTestOffer("ban100-high", BankId.BAN100, 10.0, 30_000_001),
      createTestOffer("lulo", BankId.LULO, 7.5, 1),
    ];

    const rankings = computeSavingsRankings(offers);

    const under10mRanking = rankings.scenarios[SavingsScenarioKey.BEST_RATE_UNDER_10M];
    expect(under10mRanking).toBeDefined();

    expect(under10mRanking![0].metric.value).toBe(7.5);
    expect(under10mRanking![0].entries).toEqual([{ offer_id: "lulo" }]);

    expect(under10mRanking![1].metric.value).toBe(6.0);
    expect(under10mRanking![1].entries).toEqual([{ offer_id: "ban100-low" }]);
  });

  it("should filter by balance tier for over_50m scenario", () => {
    const offers: SavingsOffer[] = [
      createTestOffer("ban100-low", BankId.BAN100, 6.0, 1, 10_000_000),
      createTestOffer("ban100-high", BankId.BAN100, 10.0, 30_000_001),
      createTestOffer("bbva-premium", BankId.BBVA, 8.0, 50_000_000),
    ];

    const rankings = computeSavingsRankings(offers);

    const over50mRanking = rankings.scenarios[SavingsScenarioKey.BEST_RATE_OVER_50M];
    expect(over50mRanking).toBeDefined();

    expect(over50mRanking![0].metric.value).toBe(10.0);
    expect(over50mRanking![0].entries).toEqual([{ offer_id: "ban100-high" }]);

    expect(over50mRanking![1].metric.value).toBe(8.0);
    expect(over50mRanking![1].entries).toEqual([{ offer_id: "bbva-premium" }]);
  });

  it("should separate neobank and traditional bank rankings", () => {
    const offers: SavingsOffer[] = [
      createTestOffer("ban100", BankId.BAN100, 10.0, 1),
      createTestOffer("lulo", BankId.LULO, 9.0, 1),
      createTestOffer("bbva", BankId.BBVA, 8.0, 1),
      createTestOffer("caja", BankId.BANCO_CAJA_SOCIAL, 7.0, 1),
    ];

    const rankings = computeSavingsRankings(offers);

    const neobankRanking = rankings.scenarios[SavingsScenarioKey.BEST_NEOBANK];
    expect(neobankRanking).toBeDefined();
    expect(neobankRanking!.length).toBe(2);
    expect(neobankRanking![0].entries).toEqual([{ offer_id: "ban100" }]);
    expect(neobankRanking![1].entries).toEqual([{ offer_id: "lulo" }]);

    const traditionalRanking = rankings.scenarios[SavingsScenarioKey.BEST_TRADITIONAL];
    expect(traditionalRanking).toBeDefined();
    expect(traditionalRanking!.length).toBe(2);
    expect(traditionalRanking![0].entries).toEqual([{ offer_id: "bbva" }]);
    expect(traditionalRanking![1].entries).toEqual([{ offer_id: "caja" }]);
  });

  it("should cap at 3 distinct rates", () => {
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

    expect(neobankRanking![0].position).toBe(1);
    expect(neobankRanking![1].position).toBe(2);
    expect(neobankRanking![2].position).toBe(3);
  });

  describe("ties", () => {
    it("should group two banks tied at the top rate into one position-1 group", () => {
      const offers: SavingsOffer[] = [
        createTestOffer("bbva", BankId.BBVA, 11.0, 1),
        createTestOffer("pibank", BankId.PIBANK, 11.0, 1),
        createTestOffer("bancamia", BankId.BANCAMIA, 10.0, 1),
      ];

      const rankings = computeSavingsRankings(offers);

      const ranking = rankings.scenarios[SavingsScenarioKey.BEST_RATE_UNDER_10M];
      expect(ranking).toBeDefined();
      expect(ranking!.length).toBe(2);

      expect(ranking![0]).toEqual({
        position: 1,
        metric: { kind: "EA_PERCENT", value: 11.0 },
        entries: [{ offer_id: "bbva" }, { offer_id: "pibank" }],
      });

      expect(ranking![1]).toEqual({
        position: 2,
        metric: { kind: "EA_PERCENT", value: 10.0 },
        entries: [{ offer_id: "bancamia" }],
      });
    });

    it("should include all entries tied at the third position even when more banks exist", () => {
      const offers: SavingsOffer[] = [
        createTestOffer("a", BankId.LULO, 10.0, 1),
        createTestOffer("b", BankId.NU, 9.0, 1),
        createTestOffer("c", BankId.RAPPIPAY, 8.5, 1),
        createTestOffer("d", BankId.UALA, 8.5, 1),
        createTestOffer("e", BankId.PIBANK, 8.0, 1),
      ];

      const rankings = computeSavingsRankings(offers);

      const ranking = rankings.scenarios[SavingsScenarioKey.BEST_NEOBANK];
      expect(ranking).toBeDefined();
      expect(ranking!.length).toBe(3);

      expect(ranking![2]).toEqual({
        position: 3,
        metric: { kind: "EA_PERCENT", value: 8.5 },
        entries: [{ offer_id: "c" }, { offer_id: "d" }],
      });
    });
  });
});
