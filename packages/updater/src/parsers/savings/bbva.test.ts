import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { BbvaSavingsParser } from "./bbva.js";
import { BankId, SavingsAccountType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../../fixtures/bbva/savings-page.pdf");

describe("BbvaSavingsParser", () => {
  let result: Awaited<ReturnType<BbvaSavingsParser["parse"]>>;

  beforeAll(async () => {
    const parser = new BbvaSavingsParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return bbva as bank_id", () => {
    expect(result.bank_id).toBe(BankId.BBVA);
  });

  it("should extract multiple offers", () => {
    expect(result.offers.length).toBeGreaterThanOrEqual(10);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Cuenta Especial Premium (high yield)", () => {
    it("should extract 7 tiered offers", () => {
      const premiumOffers = result.offers.filter(
        (o) => o.account_name === "Cuenta Especial Premium"
      );
      expect(premiumOffers).toHaveLength(7);
    });

    it("should extract tier 1: $1-$4,999,999 at 0.01% E.A.", () => {
      const tier1 = result.offers.find(
        (o) => o.account_name === "Cuenta Especial Premium" && o.min_amount_cop === 1
      );
      expect(tier1).toBeDefined();
      expect(tier1!.rate.ea_percent).toBe(0.01);
      expect(tier1!.max_amount_cop).toBe(4_999_999);
    });

    it("should extract tier 2: $5M-$50M at 3.00% E.A.", () => {
      const tier2 = result.offers.find(
        (o) => o.account_name === "Cuenta Especial Premium" && o.min_amount_cop === 5_000_000
      );
      expect(tier2).toBeDefined();
      expect(tier2!.rate.ea_percent).toBe(3.0);
      expect(tier2!.max_amount_cop).toBe(49_999_999);
    });

    it("should extract tier 3: $50M-$200M at 7.25% E.A.", () => {
      const tier3 = result.offers.find(
        (o) => o.account_name === "Cuenta Especial Premium" && o.min_amount_cop === 50_000_000
      );
      expect(tier3).toBeDefined();
      expect(tier3!.rate.ea_percent).toBe(7.25);
      expect(tier3!.max_amount_cop).toBe(199_999_999);
    });

    it("should extract highest tier: $1B+ at 9.25% E.A.", () => {
      const topTier = result.offers.find(
        (o) => o.account_name === "Cuenta Especial Premium" && o.min_amount_cop === 1_000_000_000
      );
      expect(topTier).toBeDefined();
      expect(topTier!.rate.ea_percent).toBe(9.25);
      expect(topTier!.max_amount_cop).toBeUndefined();
    });

    it("should mark as HIGH_YIELD account type", () => {
      const premiumOffers = result.offers.filter(
        (o) => o.account_name === "Cuenta Especial Premium"
      );
      expect(premiumOffers.every((o) => o.account_type === SavingsAccountType.HIGH_YIELD)).toBe(
        true
      );
    });
  });

  describe("Cuenta Blue (digital)", () => {
    it("should extract Cuenta Blue at 0.01% E.A.", () => {
      const blueOffer = result.offers.find((o) => o.account_name === "Cuenta Blue");
      expect(blueOffer).toBeDefined();
      expect(blueOffer!.rate.ea_percent).toBe(0.01);
      expect(blueOffer!.account_type).toBe(SavingsAccountType.DIGITAL);
    });
  });

  describe("Cuenta Blue Kids", () => {
    it("should extract Cuenta Blue Kids at 0.80% E.A.", () => {
      const kidsOffer = result.offers.find((o) => o.account_name === "Cuenta Blue Kids");
      expect(kidsOffer).toBeDefined();
      expect(kidsOffer!.rate.ea_percent).toBe(0.8);
      expect(kidsOffer!.account_type).toBe(SavingsAccountType.STANDARD);
    });
  });

  describe("Cuenta Hogar (tiered)", () => {
    it("should extract multiple tiers", () => {
      const hogarOffers = result.offers.filter((o) => o.account_name === "Cuenta Hogar");
      expect(hogarOffers.length).toBeGreaterThanOrEqual(4);
    });

    it("should extract tier 1: $1-$500K at 0.12% E.A.", () => {
      const tier1 = result.offers.find(
        (o) => o.account_name === "Cuenta Hogar" && o.min_amount_cop === 1
      );
      expect(tier1).toBeDefined();
      expect(tier1!.rate.ea_percent).toBe(0.12);
      expect(tier1!.max_amount_cop).toBe(500_000);
    });

    it("should extract highest tier: $50M+ at 1.60% E.A.", () => {
      const topTier = result.offers.find(
        (o) => o.account_name === "Cuenta Hogar" && !o.max_amount_cop
      );
      expect(topTier).toBeDefined();
      expect(topTier!.rate.ea_percent).toBe(1.6);
    });
  });

  describe("AFC (tax-advantaged housing savings)", () => {
    it("should extract multiple tiers", () => {
      const afcOffers = result.offers.filter((o) => o.account_name.includes("AFC"));
      expect(afcOffers.length).toBeGreaterThanOrEqual(5);
    });

    it("should extract highest tier at 3.00% E.A.", () => {
      const topTier = result.offers.find(
        (o) => o.account_name.includes("AFC") && !o.max_amount_cop
      );
      expect(topTier).toBeDefined();
      expect(topTier!.rate.ea_percent).toBe(3.0);
    });
  });

  describe("Ahorro Fijo (fixed savings)", () => {
    it("should extract Ahorro Fijo at 10.00% E.A.", () => {
      const ahorroFijo = result.offers.find((o) => o.account_name === "Ahorro Fijo");
      expect(ahorroFijo).toBeDefined();
      expect(ahorroFijo!.rate.ea_percent).toBe(10.0);
      expect(ahorroFijo!.account_type).toBe(SavingsAccountType.HIGH_YIELD);
      expect(ahorroFijo!.min_amount_cop).toBe(5_000_000);
    });
  });

  describe("common offer properties", () => {
    it("should set bank_name to BBVA Colombia", () => {
      expect(result.offers.every((o) => o.bank_name === "BBVA Colombia")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("bbva.com.co");
        expect(offer.source.retrieved_at).toBeTruthy();
      }
    });

    it("should generate unique stable IDs", () => {
      const ids = result.offers.map((o) => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      expect(ids.every((id) => id.length === 16)).toBe(true);
    });
  });
});
