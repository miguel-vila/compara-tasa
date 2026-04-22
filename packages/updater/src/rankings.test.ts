import { describe, it, expect } from "vitest";
import { computeMortgageRankings } from "./rankings.js";
import {
  BankId,
  CurrencyIndex,
  Segment,
  Channel,
  MortgageType,
  MortgageScenarioKey,
  type MortgageOffer,
} from "@compara-tasa/core";

function createMockOffer(overrides: Partial<MortgageOffer> & { id: string }): MortgageOffer {
  const { id, ...rest } = overrides;
  return {
    id,
    bank_id: BankId.BANCOLOMBIA,
    bank_name: "Bancolombia",
    product_type: MortgageType.HIPOTECARIO,
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

describe("computeMortgageRankings", () => {
  describe("BEST_COP_VIS_HIPOTECARIO", () => {
    it("should return top 3 groups sorted by lowest COP rate for VIS segment", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({
          id: "offer-1",
          rate: { kind: "COP_FIXED", ea_percent_from: 12.0 },
        }),
        createMockOffer({
          id: "offer-2",
          rate: { kind: "COP_FIXED", ea_percent_from: 11.5 },
        }),
        createMockOffer({
          id: "offer-3",
          rate: { kind: "COP_FIXED", ea_percent_from: 13.0 },
        }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_COP_VIS_HIPOTECARIO]).toEqual([
        {
          position: 1,
          metric: { kind: "EA_PERCENT", value: 11.5 },
          entries: [{ offer_id: "offer-2" }],
        },
        {
          position: 2,
          metric: { kind: "EA_PERCENT", value: 12.0 },
          entries: [{ offer_id: "offer-1" }],
        },
        {
          position: 3,
          metric: { kind: "EA_PERCENT", value: 13.0 },
          entries: [{ offer_id: "offer-3" }],
        },
      ]);
    });

    it("should not include NO_VIS offers in VIS ranking", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({
          id: "vis-offer",
          segment: Segment.VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 14.0 },
        }),
        createMockOffer({
          id: "no-vis-offer",
          segment: Segment.NO_VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 10.0 },
        }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(
        rankings.mortgageScenarios[MortgageScenarioKey.BEST_COP_VIS_HIPOTECARIO]?.[0]?.entries[0]
          ?.offer_id
      ).toBe("vis-offer");
    });
  });

  describe("BEST_COP_NO_VIS_HIPOTECARIO", () => {
    it("should return top groups sorted by lowest COP rate for NO_VIS segment", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({
          id: "no-vis-1",
          segment: Segment.NO_VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
        createMockOffer({
          id: "no-vis-2",
          segment: Segment.NO_VIS,
          rate: { kind: "COP_FIXED", ea_percent_from: 10.5 },
        }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_COP_NO_VIS_HIPOTECARIO]).toEqual([
        {
          position: 1,
          metric: { kind: "EA_PERCENT", value: 10.5 },
          entries: [{ offer_id: "no-vis-2" }],
        },
        {
          position: 2,
          metric: { kind: "EA_PERCENT", value: 11.0 },
          entries: [{ offer_id: "no-vis-1" }],
        },
      ]);
    });
  });

  describe("BEST_UVR_VIS_HIPOTECARIO", () => {
    it("should return top groups sorted by lowest UVR spread for VIS segment", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({
          id: "uvr-vis-1",
          currency_index: CurrencyIndex.UVR,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 7.0 },
        }),
        createMockOffer({
          id: "uvr-vis-2",
          currency_index: CurrencyIndex.UVR,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 6.5 },
        }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_UVR_VIS_HIPOTECARIO]).toEqual([
        {
          position: 1,
          metric: { kind: "UVR_SPREAD_EA", value: 6.5 },
          entries: [{ offer_id: "uvr-vis-2" }],
        },
        {
          position: 2,
          metric: { kind: "UVR_SPREAD_EA", value: 7.0 },
          entries: [{ offer_id: "uvr-vis-1" }],
        },
      ]);
    });

    it("should not include COP offers in UVR ranking", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({
          id: "uvr-offer",
          currency_index: CurrencyIndex.UVR,
          rate: { kind: "UVR_SPREAD", spread_ea_from: 8.0 },
        }),
        createMockOffer({
          id: "cop-offer",
          currency_index: CurrencyIndex.COP,
          rate: { kind: "COP_FIXED", ea_percent_from: 5.0 },
        }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(
        rankings.mortgageScenarios[MortgageScenarioKey.BEST_UVR_VIS_HIPOTECARIO]?.[0]?.entries[0]
          ?.offer_id
      ).toBe("uvr-offer");
    });
  });

  describe("BEST_UVR_NO_VIS_HIPOTECARIO", () => {
    it("should return top groups sorted by lowest UVR spread for NO_VIS segment", () => {
      const offers: MortgageOffer[] = [
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

      const rankings = computeMortgageRankings(offers);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_UVR_NO_VIS_HIPOTECARIO]).toEqual([
        {
          position: 1,
          metric: { kind: "UVR_SPREAD_EA", value: 7.5 },
          entries: [{ offer_id: "uvr-no-vis-2" }],
        },
        {
          position: 2,
          metric: { kind: "UVR_SPREAD_EA", value: 8.5 },
          entries: [{ offer_id: "uvr-no-vis-1" }],
        },
      ]);
    });
  });

  describe("Payroll scenarios", () => {
    it("should separate payroll and non-payroll offers in COP VIS scenarios", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({
          id: "no-payroll",
          rate: { kind: "COP_FIXED", ea_percent_from: 10.0 },
          conditions: {},
        }),
        createMockOffer({
          id: "with-payroll-high",
          rate: { kind: "COP_FIXED", ea_percent_from: 12.0 },
          conditions: {
            payroll_discount: { type: "PERCENT_OFF", value: 1.0, applies_to: "RATE" },
          },
        }),
        createMockOffer({
          id: "with-payroll-low",
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
          conditions: {
            payroll_discount: { type: "PERCENT_OFF", value: 1.0, applies_to: "RATE" },
          },
        }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_COP_VIS_PAYROLL]).toEqual([
        {
          position: 1,
          metric: { kind: "EA_PERCENT", value: 11.0 },
          entries: [{ offer_id: "with-payroll-low" }],
        },
        {
          position: 2,
          metric: { kind: "EA_PERCENT", value: 12.0 },
          entries: [{ offer_id: "with-payroll-high" }],
        },
      ]);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_COP_VIS_HIPOTECARIO]).toEqual([
        {
          position: 1,
          metric: { kind: "EA_PERCENT", value: 10.0 },
          entries: [{ offer_id: "no-payroll" }],
        },
      ]);
    });

    it("should return undefined when no offers have payroll discount", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({ id: "no-payroll-1", conditions: {} }),
        createMockOffer({ id: "no-payroll-2", conditions: {} }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_COP_VIS_PAYROLL]).toBeUndefined();
    });
  });

  describe("BEST_DIGITAL_HIPOTECARIO", () => {
    it("should return top groups sorted by lowest rate among digital channel offers", () => {
      const offers: MortgageOffer[] = [
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

      const rankings = computeMortgageRankings(offers);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_DIGITAL_HIPOTECARIO]).toEqual([
        {
          position: 1,
          metric: { kind: "EA_PERCENT", value: 11.0 },
          entries: [{ offer_id: "digital-low" }],
        },
        {
          position: 2,
          metric: { kind: "EA_PERCENT", value: 12.0 },
          entries: [{ offer_id: "digital-high" }],
        },
      ]);
    });

    it("should only include HIPOTECARIO product type", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({
          id: "leasing-digital",
          product_type: MortgageType.LEASING,
          channel: Channel.DIGITAL,
          rate: { kind: "COP_FIXED", ea_percent_from: 9.0 },
        }),
        createMockOffer({
          id: "hipotecario-digital",
          product_type: MortgageType.HIPOTECARIO,
          channel: Channel.DIGITAL,
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(
        rankings.mortgageScenarios[MortgageScenarioKey.BEST_DIGITAL_HIPOTECARIO]?.[0]?.entries[0]
          ?.offer_id
      ).toBe("hipotecario-digital");
    });
  });

  describe("ties", () => {
    it("should group two offers tied at the best rate into one position-1 group", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({
          id: "offer-a",
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
        createMockOffer({
          id: "offer-b",
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_COP_VIS_HIPOTECARIO]).toEqual([
        {
          position: 1,
          metric: { kind: "EA_PERCENT", value: 11.0 },
          entries: [{ offer_id: "offer-a" }, { offer_id: "offer-b" }],
        },
      ]);
    });

    it("should produce 1, 2 with the second position holding tied entries", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({
          id: "best",
          rate: { kind: "COP_FIXED", ea_percent_from: 10.0 },
        }),
        createMockOffer({
          id: "tied-a",
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
        createMockOffer({
          id: "tied-b",
          rate: { kind: "COP_FIXED", ea_percent_from: 11.0 },
        }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_COP_VIS_HIPOTECARIO]).toEqual([
        {
          position: 1,
          metric: { kind: "EA_PERCENT", value: 10.0 },
          entries: [{ offer_id: "best" }],
        },
        {
          position: 2,
          metric: { kind: "EA_PERCENT", value: 11.0 },
          entries: [{ offer_id: "tied-a" }, { offer_id: "tied-b" }],
        },
      ]);
    });

    it("should include all entries tied at position 3 even when more than 3 offers exist", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({ id: "p1", rate: { kind: "COP_FIXED", ea_percent_from: 9.0 } }),
        createMockOffer({ id: "p2", rate: { kind: "COP_FIXED", ea_percent_from: 10.0 } }),
        createMockOffer({ id: "p3-a", rate: { kind: "COP_FIXED", ea_percent_from: 11.0 } }),
        createMockOffer({ id: "p3-b", rate: { kind: "COP_FIXED", ea_percent_from: 11.0 } }),
        createMockOffer({ id: "p4", rate: { kind: "COP_FIXED", ea_percent_from: 12.0 } }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_COP_VIS_HIPOTECARIO]).toEqual([
        {
          position: 1,
          metric: { kind: "EA_PERCENT", value: 9.0 },
          entries: [{ offer_id: "p1" }],
        },
        {
          position: 2,
          metric: { kind: "EA_PERCENT", value: 10.0 },
          entries: [{ offer_id: "p2" }],
        },
        {
          position: 3,
          metric: { kind: "EA_PERCENT", value: 11.0 },
          entries: [{ offer_id: "p3-a" }, { offer_id: "p3-b" }],
        },
      ]);
    });
  });

  describe("edge cases", () => {
    it("should return empty scenarios when no offers provided", () => {
      const rankings = computeMortgageRankings([]);
      expect(rankings.mortgageScenarios).toEqual({});
    });

    it("should include generated_at timestamp", () => {
      const rankings = computeMortgageRankings([]);
      expect(rankings.generated_at).toBeDefined();
      expect(new Date(rankings.generated_at).getTime()).not.toBeNaN();
    });

    it("should cap at 3 distinct rates even when more match", () => {
      const offers: MortgageOffer[] = [
        createMockOffer({ id: "offer-1", rate: { kind: "COP_FIXED", ea_percent_from: 10.0 } }),
        createMockOffer({ id: "offer-2", rate: { kind: "COP_FIXED", ea_percent_from: 11.0 } }),
        createMockOffer({ id: "offer-3", rate: { kind: "COP_FIXED", ea_percent_from: 12.0 } }),
        createMockOffer({ id: "offer-4", rate: { kind: "COP_FIXED", ea_percent_from: 13.0 } }),
        createMockOffer({ id: "offer-5", rate: { kind: "COP_FIXED", ea_percent_from: 14.0 } }),
      ];

      const rankings = computeMortgageRankings(offers);

      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_COP_VIS_HIPOTECARIO]?.length).toBe(
        3
      );
      expect(rankings.mortgageScenarios[MortgageScenarioKey.BEST_COP_VIS_HIPOTECARIO]).toEqual([
        {
          position: 1,
          metric: { kind: "EA_PERCENT", value: 10.0 },
          entries: [{ offer_id: "offer-1" }],
        },
        {
          position: 2,
          metric: { kind: "EA_PERCENT", value: 11.0 },
          entries: [{ offer_id: "offer-2" }],
        },
        {
          position: 3,
          metric: { kind: "EA_PERCENT", value: 12.0 },
          entries: [{ offer_id: "offer-3" }],
        },
      ]);
    });
  });
});
