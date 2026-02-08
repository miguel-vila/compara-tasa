import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { Ban100Parser } from "./ban100.js";
import { BankId, SavingsAccountType, type ScrappedSavingsSource } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../../fixtures/ban100/savings-page.html");

describe("Ban100Parser", () => {
  let result: Awaited<ReturnType<Ban100Parser["parse"]>>;

  beforeAll(async () => {
    const parser = new Ban100Parser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return ban100 as bank_id", () => {
    expect(result.bank_id).toBe(BankId.BAN100);
  });

  it("should extract exactly 4 offers (3 tiered + 1 standard)", () => {
    expect(result.offers).toHaveLength(4);
  });

  it("should have no warnings when parsing valid fixture", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Cuenta de Ahorro 100pre offers (high yield)", () => {
    it("should have 3 tiered offers for the high yield account", () => {
      const highYieldOffers = result.offers.filter(
        (o) => o.account_type === SavingsAccountType.HIGH_YIELD
      );
      expect(highYieldOffers).toHaveLength(3);
    });

    it("should extract tier 1: $1-$10M at 6.50% E.A.", () => {
      const tier1 = result.offers.find(
        (o) => o.account_type === SavingsAccountType.HIGH_YIELD && o.min_amount_cop === 1
      );
      expect(tier1).toBeDefined();
      expect(tier1!.rate.ea_percent).toBe(6.5);
      expect(tier1!.max_amount_cop).toBe(10_000_000);
      expect(tier1!.account_name).toBe("Cuenta de Ahorro 100pre");
    });

    it("should extract tier 2: $10M-$30M at 9.50% E.A.", () => {
      const tier2 = result.offers.find(
        (o) => o.account_type === SavingsAccountType.HIGH_YIELD && o.min_amount_cop === 10_000_001
      );
      expect(tier2).toBeDefined();
      expect(tier2!.rate.ea_percent).toBe(9.5);
      expect(tier2!.max_amount_cop).toBe(30_000_000);
    });

    it("should extract tier 3: $30M+ at 10.00% E.A.", () => {
      const tier3 = result.offers.find(
        (o) => o.account_type === SavingsAccountType.HIGH_YIELD && o.min_amount_cop === 30_000_001
      );
      expect(tier3).toBeDefined();
      expect(tier3!.rate.ea_percent).toBe(10.0);
      expect(tier3!.max_amount_cop).toBeUndefined();
    });
  });

  describe("Cuenta de Ahorro Clásica offer (standard)", () => {
    it("should have 1 standard account offer", () => {
      const standardOffers = result.offers.filter(
        (o) => o.account_type === SavingsAccountType.STANDARD
      );
      expect(standardOffers).toHaveLength(1);
    });

    it("should extract the standard rate at 6.00% E.A.", () => {
      const standardOffer = result.offers.find(
        (o) => o.account_type === SavingsAccountType.STANDARD
      );
      expect(standardOffer).toBeDefined();
      expect(standardOffer!.rate.ea_percent).toBe(6.0);
      expect(standardOffer!.account_name).toBe("Cuenta de Ahorro Clásica");
      expect(standardOffer!.min_amount_cop).toBe(1);
    });
  });

  describe("common offer properties", () => {
    it("should set bank_name to Ban100", () => {
      expect(result.offers.every((o) => o.bank_name === "Ban100")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.kind).toBe("scrapped");
        const source = offer.source as ScrappedSavingsSource;
        expect(source.source_type).toBe("HTML");
        expect(source.url).toContain("ban100.com.co");
        expect(source.retrieved_at).toBeTruthy();
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
