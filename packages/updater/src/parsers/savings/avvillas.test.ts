import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { AvvillasParser } from "./avvillas.js";
import { BankId, SavingsAccountType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../../fixtures/avvillas/savings-page.pdf");

describe("AvvillasParser", () => {
  let result: Awaited<ReturnType<AvvillasParser["parse"]>>;

  beforeAll(async () => {
    const parser = new AvvillasParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return avvillas as bank_id", () => {
    expect(result.bank_id).toBe(BankId.AVVILLAS);
  });

  it("should extract multiple offers", () => {
    expect(result.offers.length).toBeGreaterThanOrEqual(10);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Bolsillos con Rentabilidad (highest yield)", () => {
    it("should extract multiple tiered offers", () => {
      const bolsillosOffers = result.offers.filter((o) =>
        o.account_name.includes("Bolsillos con Rentabilidad")
      );
      expect(bolsillosOffers.length).toBeGreaterThanOrEqual(5);
    });

    it("should extract highest tier at 10.50% E.A.", () => {
      const topTier = result.offers.find(
        (o) =>
          o.account_name.includes("Bolsillos con Rentabilidad") && o.max_amount_cop === undefined
      );
      expect(topTier).toBeDefined();
      expect(topTier!.rate.ea_percent).toBe(10.5);
    });

    it("should mark as HIGH_YIELD account type", () => {
      const bolsillosOffers = result.offers.filter((o) =>
        o.account_name.includes("Bolsillos con Rentabilidad")
      );
      expect(bolsillosOffers.every((o) => o.account_type === SavingsAccountType.HIGH_YIELD)).toBe(
        true
      );
    });
  });

  describe("Cuenta Premium (high yield)", () => {
    it("should extract 7 tiered offers", () => {
      const premiumOffers = result.offers.filter((o) => o.account_name === "Cuenta Premium");
      expect(premiumOffers).toHaveLength(7);
    });

    it("should extract tier 1: $0-$5M at 0.50% E.A.", () => {
      const tier1 = result.offers.find(
        (o) => o.account_name === "Cuenta Premium" && o.min_amount_cop === 0
      );
      expect(tier1).toBeDefined();
      expect(tier1!.rate.ea_percent).toBe(0.5);
      expect(tier1!.max_amount_cop).toBe(5_000_000);
    });

    it("should extract tier 2: $5M-$20M at 3.00% E.A.", () => {
      const tier2 = result.offers.find(
        (o) => o.account_name === "Cuenta Premium" && o.min_amount_cop === 5_000_001
      );
      expect(tier2).toBeDefined();
      expect(tier2!.rate.ea_percent).toBe(3.0);
      expect(tier2!.max_amount_cop).toBe(20_000_000);
    });

    it("should extract highest tier: $500M+ at 9.00% E.A.", () => {
      const topTier = result.offers.find(
        (o) => o.account_name === "Cuenta Premium" && o.max_amount_cop === undefined
      );
      expect(topTier).toBeDefined();
      expect(topTier!.rate.ea_percent).toBe(9.0);
    });

    it("should mark as HIGH_YIELD account type", () => {
      const premiumOffers = result.offers.filter((o) => o.account_name === "Cuenta Premium");
      expect(premiumOffers.every((o) => o.account_type === SavingsAccountType.HIGH_YIELD)).toBe(
        true
      );
    });
  });

  describe("RentaVillas (standard savings)", () => {
    it("should extract multiple tiers", () => {
      const rentavillasOffers = result.offers.filter((o) => o.account_name === "RentaVillas");
      expect(rentavillasOffers.length).toBeGreaterThanOrEqual(5);
    });

    it("should extract tier 1: $0-$5M at 0.50% E.A.", () => {
      const tier1 = result.offers.find(
        (o) => o.account_name === "RentaVillas" && o.min_amount_cop === 0
      );
      expect(tier1).toBeDefined();
      expect(tier1!.rate.ea_percent).toBe(0.5);
      expect(tier1!.max_amount_cop).toBe(5_000_000);
    });

    it("should extract highest tier: $100M+ at 1.50% E.A.", () => {
      const topTier = result.offers.find(
        (o) => o.account_name === "RentaVillas" && o.max_amount_cop === undefined
      );
      expect(topTier).toBeDefined();
      expect(topTier!.rate.ea_percent).toBe(1.5);
    });

    it("should mark as STANDARD account type", () => {
      const rentavillasOffers = result.offers.filter((o) => o.account_name === "RentaVillas");
      expect(rentavillasOffers.every((o) => o.account_type === SavingsAccountType.STANDARD)).toBe(
        true
      );
    });
  });

  // AFC rates are not separately disclosed in the PDF - they reference the same structure as CERTIVILLAS
  // The PDF mentions AFC but doesn't show a dedicated rate table

  describe("common offer properties", () => {
    it("should set bank_name to Banco AV Villas", () => {
      expect(result.offers.every((o) => o.bank_name === "Banco AV Villas")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("avvillas.com.co");
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
