import { describe, it, expect } from "vitest";
import { computeRankings } from "./rankings.js";
import {
  BankId,
  CurrencyIndex,
  Segment,
  Channel,
  ProductType,
  ScenarioKey,
  type Offer,
} from "@compara-tasa/core";

function createMockOffer(overrides: Partial<Offer> & { id: string }): Offer {
  const { id, ...rest } = overrides;
  return {
    id,
    bank_id: BankId.BANCOLOMBIA,
    bank_name: "Bancolombia",
    product_type: ProductType.HIPOTECARIO,
    currency_index: CurrencyIndex.COP,
    segment: Segment.VIS,
    channel: Channel.UNSPECIFIED,
    rate: { kind: "COP_FIXED", ea_percent_from: 12.0 },
    conditions: {},
    source: {
      url: "https://example.com",
      source_type: "HTML",
      retrieved_at: new Date().toISOString(),
      extraction: { method: "CSS_SELECTOR", locator: ".rate" },
    },
    ...rest,
  };
}

describe("computeRankings", () => {
  describe("BEST_COP_VIS_HIPOTECARIO", () => {
    it("should return top 3 offers sorted by lowest COP rate for VIS segment", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "offer-1",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 12.0 },
        }),
        createMockOffer({
          id: "offer-2",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.5 },
        }),
        createMockOffer({
          id: "offer-3",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 13.0 },
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_HIPOTECARIO]).toEqual([
        { position: 1, offer_id: "offer-2", metric: { kind: "EA_PERCENT", value: 11.5 } },
        { position: 2, offer_id: "offer-1", metric: { kind: "EA_PERCENT", value: 12.0 } },
        { position: 3, offer_id: "offer-3", metric: { kind: "EA_PERCENT", value: 13.0 } },
      ]);
    });

    it("should not include NO_VIS offers in VIS ranking", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "vis-offer",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 14.0 },
        }),
        createMockOffer({
          id: "no-vis-offer",
          currency_index: CurrencyIndex.COP,
          segment: Segment.NO_VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 10.0 },
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_HIPOTECARIO]?.[0]?.offer_id).toBe(
        "vis-offer"
      );
    });
  });

  describe("BEST_COP_NO_VIS_HIPOTECARIO", () => {
    it("should return top offers sorted by lowest COP rate for NO_VIS segment", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "no-vis-1",
          currency_index: CurrencyIndex.COP,
          segment: Segment.NO_VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
        createMockOffer({
          id: "no-vis-2",
          currency_index: CurrencyIndex.COP,
          segment: Segment.NO_VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 10.5 },
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_COP_NO_VIS_HIPOTECARIO]).toEqual([
        { position: 1, offer_id: "no-vis-2", metric: { kind: "EA_PERCENT", value: 10.5 } },
        { position: 2, offer_id: "no-vis-1", metric: { kind: "EA_PERCENT", value: 11.0 } },
      ]);
    });
  });

  describe("BEST_UVR_VIS_HIPOTECARIO", () => {
    it("should return top offers sorted by lowest UVR spread for VIS segment", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "uvr-vis-1",
          currency_index: CurrencyIndex.UVR,
          segment: Segment.VIS,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 7.0 },
        }),
        createMockOffer({
          id: "uvr-vis-2",
          currency_index: CurrencyIndex.UVR,
          segment: Segment.VIS,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 6.5 },
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_UVR_VIS_HIPOTECARIO]).toEqual([
        { position: 1, offer_id: "uvr-vis-2", metric: { kind: "UVR_SPREAD_EA", value: 6.5 } },
        { position: 2, offer_id: "uvr-vis-1", metric: { kind: "UVR_SPREAD_EA", value: 7.0 } },
      ]);
    });

    it("should not include COP offers in UVR ranking", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "uvr-offer",
          currency_index: CurrencyIndex.UVR,
          segment: Segment.VIS,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 8.0 },
        }),
        createMockOffer({
          id: "cop-offer",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 5.0 },
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_UVR_VIS_HIPOTECARIO]?.[0]?.offer_id).toBe(
        "uvr-offer"
      );
    });
  });

  describe("BEST_UVR_NO_VIS_HIPOTECARIO", () => {
    it("should return top offers sorted by lowest UVR spread for NO_VIS segment", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "uvr-no-vis-1",
          currency_index: CurrencyIndex.UVR,
          segment: Segment.NO_VIS,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 8.5 },
        }),
        createMockOffer({
          id: "uvr-no-vis-2",
          currency_index: CurrencyIndex.UVR,
          segment: Segment.NO_VIS,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 7.5 },
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_UVR_NO_VIS_HIPOTECARIO]).toEqual([
        { position: 1, offer_id: "uvr-no-vis-2", metric: { kind: "UVR_SPREAD_EA", value: 7.5 } },
        { position: 2, offer_id: "uvr-no-vis-1", metric: { kind: "UVR_SPREAD_EA", value: 8.5 } },
      ]);
    });
  });

  describe("Payroll scenarios", () => {
    it("should return top offers sorted by lowest rate among those with payroll discount for COP VIS", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "no-payroll",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 10.0 },
          conditions: {},
        }),
        createMockOffer({
          id: "with-payroll-high",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 12.0 },
          conditions: {
            payroll_discount: { type: "PERCENT_OFF", value: 1.0, applies_to: "RATE" },
          },
        }),
        createMockOffer({
          id: "with-payroll-low",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
          conditions: {
            payroll_discount: { type: "PERCENT_OFF", value: 1.0, applies_to: "RATE" },
          },
        }),
      ];

      const rankings = computeRankings(offers);

      // Payroll offers appear in payroll scenario
      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_PAYROLL]).toEqual([
        { position: 1, offer_id: "with-payroll-low", metric: { kind: "EA_PERCENT", value: 11.0 } },
        { position: 2, offer_id: "with-payroll-high", metric: { kind: "EA_PERCENT", value: 12.0 } },
      ]);

      // Non-payroll offers appear in base scenario
      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_HIPOTECARIO]).toEqual([
        { position: 1, offer_id: "no-payroll", metric: { kind: "EA_PERCENT", value: 10.0 } },
      ]);
    });

    it("should return undefined when no offers have payroll discount", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "no-payroll-1",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          conditions: {},
        }),
        createMockOffer({
          id: "no-payroll-2",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          conditions: {},
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_PAYROLL]).toBeUndefined();
    });

    it("should separate payroll and non-payroll offers in UVR scenarios", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "uvr-no-payroll",
          currency_index: CurrencyIndex.UVR,
          segment: Segment.VIS,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 7.0 },
          conditions: {},
        }),
        createMockOffer({
          id: "uvr-with-payroll",
          currency_index: CurrencyIndex.UVR,
          segment: Segment.VIS,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 6.0 },
          conditions: {
            payroll_discount: { type: "BPS_OFF", value: 100, applies_to: "RATE" },
          },
        }),
      ];

      const rankings = computeRankings(offers);

      // Non-payroll in base scenario
      expect(rankings.scenarios[ScenarioKey.BEST_UVR_VIS_HIPOTECARIO]?.[0]?.offer_id).toBe(
        "uvr-no-payroll"
      );
      // Payroll in payroll scenario
      expect(rankings.scenarios[ScenarioKey.BEST_UVR_VIS_PAYROLL]?.[0]?.offer_id).toBe(
        "uvr-with-payroll"
      );
    });
  });

  describe("BEST_DIGITAL_HIPOTECARIO", () => {
    it("should return top offers sorted by lowest rate among digital channel offers", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "branch-offer",
          channel: Channel.BRANCH,
          rate: { kind: "COP_FIXED", ea_percent_from: 10.0 },
        }),
        createMockOffer({
          id: "digital-high",
          channel: Channel.DIGITAL,
          rate: { kind: "COP_FIXED", ea_percent_from: 12.0 },
        }),
        createMockOffer({
          id: "digital-low",
          channel: Channel.DIGITAL,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_DIGITAL_HIPOTECARIO]).toEqual([
        { position: 1, offer_id: "digital-low", metric: { kind: "EA_PERCENT", value: 11.0 } },
        { position: 2, offer_id: "digital-high", metric: { kind: "EA_PERCENT", value: 12.0 } },
      ]);
    });

    it("should only include HIPOTECARIO product type", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "leasing-digital",
          product_type: ProductType.LEASING,
          channel: Channel.DIGITAL,
          rate: { kind: "COP_FIXED", ea_percent_from: 9.0 },
        }),
        createMockOffer({
          id: "hipotecario-digital",
          product_type: ProductType.HIPOTECARIO,
          channel: Channel.DIGITAL,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_DIGITAL_HIPOTECARIO]?.[0]?.offer_id).toBe(
        "hipotecario-digital"
      );
    });
  });

  describe("edge cases", () => {
    it("should return empty scenarios when no offers provided", () => {
      const rankings = computeRankings([]);

      expect(rankings.scenarios).toEqual({});
    });

    it("should handle offers from multiple banks correctly", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "bancolombia-cop-vis",
          bank_id: BankId.BANCOLOMBIA,
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 12.0 },
        }),
        createMockOffer({
          id: "bbva-cop-vis",
          bank_id: BankId.BBVA,
          bank_name: "BBVA Colombia",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_HIPOTECARIO]?.[0]?.offer_id).toBe(
        "bbva-cop-vis"
      );
    });

    it("should include generated_at timestamp", () => {
      const rankings = computeRankings([]);

      expect(rankings.generated_at).toBeDefined();
      expect(new Date(rankings.generated_at).getTime()).not.toBeNaN();
    });

    it("should handle tie by including both offers in ranking", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "offer-a",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
        createMockOffer({
          id: "offer-b",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
      ];

      const rankings = computeRankings(offers);

      // Both have same rate, both should be included in rankings
      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_HIPOTECARIO]).toBeDefined();
      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_HIPOTECARIO]?.length).toBe(2);
      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_HIPOTECARIO]?.[0]?.metric.value).toBe(
        11.0
      );
      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_HIPOTECARIO]?.[1]?.metric.value).toBe(
        11.0
      );
    });

    it("should populate multiple scenarios from a comprehensive offer set", () => {
      const offers: Offer[] = [
        // Best for COP VIS (no payroll)
        createMockOffer({
          id: "cop-vis",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 12.0 },
        }),
        // Best for COP NO_VIS (no payroll)
        createMockOffer({
          id: "cop-no-vis",
          currency_index: CurrencyIndex.COP,
          segment: Segment.NO_VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.5 },
        }),
        // Best for UVR VIS (no payroll)
        createMockOffer({
          id: "uvr-vis",
          currency_index: CurrencyIndex.UVR,
          segment: Segment.VIS,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 6.5 },
        }),
        // Best for UVR NO_VIS (no payroll)
        createMockOffer({
          id: "uvr-no-vis",
          currency_index: CurrencyIndex.UVR,
          segment: Segment.NO_VIS,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 8.0 },
        }),
        // Best for DIGITAL (UVR VIS, no payroll)
        createMockOffer({
          id: "digital",
          channel: Channel.DIGITAL,
          currency_index: CurrencyIndex.UVR,
          segment: Segment.VIS,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 5.0 },
        }),
        // Best for UVR VIS PAYROLL scenario
        createMockOffer({
          id: "payroll-uvr-vis",
          currency_index: CurrencyIndex.UVR,
          segment: Segment.VIS,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 5.5 },
          conditions: {
            payroll_discount: { type: "PERCENT_OFF", value: 1.0, applies_to: "RATE" },
          },
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_HIPOTECARIO]?.[0]?.offer_id).toBe(
        "cop-vis"
      );
      expect(rankings.scenarios[ScenarioKey.BEST_COP_NO_VIS_HIPOTECARIO]?.[0]?.offer_id).toBe(
        "cop-no-vis"
      );
      // digital offer has 5.0 UVR spread which beats uvr-vis at 6.5
      expect(rankings.scenarios[ScenarioKey.BEST_UVR_VIS_HIPOTECARIO]?.[0]?.offer_id).toBe(
        "digital"
      );
      expect(rankings.scenarios[ScenarioKey.BEST_UVR_NO_VIS_HIPOTECARIO]?.[0]?.offer_id).toBe(
        "uvr-no-vis"
      );
      expect(rankings.scenarios[ScenarioKey.BEST_DIGITAL_HIPOTECARIO]?.[0]?.offer_id).toBe(
        "digital"
      );
      // Payroll UVR VIS scenario
      expect(rankings.scenarios[ScenarioKey.BEST_UVR_VIS_PAYROLL]?.[0]?.offer_id).toBe(
        "payroll-uvr-vis"
      );
    });

    it("should limit to top 3 offers even when more match", () => {
      const offers: Offer[] = [
        createMockOffer({
          id: "offer-1",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 10.0 },
        }),
        createMockOffer({
          id: "offer-2",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
        createMockOffer({
          id: "offer-3",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 12.0 },
        }),
        createMockOffer({
          id: "offer-4",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 13.0 },
        }),
        createMockOffer({
          id: "offer-5",
          currency_index: CurrencyIndex.COP,
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 14.0 },
        }),
      ];

      const rankings = computeRankings(offers);

      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_HIPOTECARIO]?.length).toBe(3);
      expect(rankings.scenarios[ScenarioKey.BEST_COP_VIS_HIPOTECARIO]).toEqual([
        { position: 1, offer_id: "offer-1", metric: { kind: "EA_PERCENT", value: 10.0 } },
        { position: 2, offer_id: "offer-2", metric: { kind: "EA_PERCENT", value: 11.0 } },
        { position: 3, offer_id: "offer-3", metric: { kind: "EA_PERCENT", value: 12.0 } },
      ]);
    });
  });
});
