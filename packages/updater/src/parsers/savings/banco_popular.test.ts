import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { BancoPopularParser } from "./banco_popular.js";
import { BankId, SavingsAccountType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../../fixtures/banco_popular/savings-page.html");

describe("BancoPopularParser", () => {
  let result: Awaited<ReturnType<BancoPopularParser["parse"]>>;

  beforeAll(async () => {
    const parser = new BancoPopularParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return banco_popular as bank_id", () => {
    expect(result.bank_id).toBe(BankId.BANCO_POPULAR);
  });

  it("should extract at least 4 offers (tiered accounts)", () => {
    expect(result.offers.length).toBeGreaterThanOrEqual(4);
  });

  it("should have no warnings when parsing valid fixture", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Cuenta para Ahorrar offers (standard)", () => {
    it("should have 4 tiered offers for Cuenta para Ahorrar", () => {
      const standardOffers = result.offers.filter((o) => o.account_name === "Cuenta para Ahorrar");
      expect(standardOffers).toHaveLength(4);
    });

    it("should extract tier 1: $0-$10M at 1.50% E.A.", () => {
      const tier1 = result.offers.find(
        (o) => o.account_name === "Cuenta para Ahorrar" && o.min_amount_cop === 0
      );
      expect(tier1).toBeDefined();
      expect(tier1!.rate.ea_percent).toBe(1.5);
      expect(tier1!.max_amount_cop).toBe(10_000_000);
      expect(tier1!.account_type).toBe(SavingsAccountType.STANDARD);
    });

    it("should extract tier 2: $10M-$50M at 4.50% E.A.", () => {
      const tier2 = result.offers.find(
        (o) => o.account_name === "Cuenta para Ahorrar" && o.min_amount_cop === 10_000_001
      );
      expect(tier2).toBeDefined();
      expect(tier2!.rate.ea_percent).toBe(4.5);
      expect(tier2!.max_amount_cop).toBe(50_000_000);
    });

    it("should extract tier 3: $50M-$150M at 5.00% E.A.", () => {
      const tier3 = result.offers.find(
        (o) => o.account_name === "Cuenta para Ahorrar" && o.min_amount_cop === 50_000_001
      );
      expect(tier3).toBeDefined();
      expect(tier3!.rate.ea_percent).toBe(5.0);
      expect(tier3!.max_amount_cop).toBe(150_000_000);
    });

    it("should extract tier 4: $150M+ at 8.00% E.A.", () => {
      const tier4 = result.offers.find(
        (o) => o.account_name === "Cuenta para Ahorrar" && o.min_amount_cop === 150_000_001
      );
      expect(tier4).toBeDefined();
      expect(tier4!.rate.ea_percent).toBe(8.0);
      expect(tier4!.max_amount_cop).toBeUndefined();
    });
  });

  describe("Cuenta Ahorro Cuenta Plateada offers (high yield)", () => {
    it("should have 2 tiered offers for Cuenta Plateada", () => {
      const highYieldOffers = result.offers.filter(
        (o) => o.account_name === "Cuenta Ahorro Cuenta Plateada"
      );
      expect(highYieldOffers).toHaveLength(2);
    });

    it("should extract tier 1: $0-$10M at 9.00% E.A.", () => {
      const tier1 = result.offers.find(
        (o) => o.account_name === "Cuenta Ahorro Cuenta Plateada" && o.min_amount_cop === 0
      );
      expect(tier1).toBeDefined();
      expect(tier1!.rate.ea_percent).toBe(9.0);
      expect(tier1!.max_amount_cop).toBe(10_000_000);
      expect(tier1!.account_type).toBe(SavingsAccountType.HIGH_YIELD);
    });

    it("should extract tier 2: $10M+ at 9.00% E.A.", () => {
      const tier2 = result.offers.find(
        (o) => o.account_name === "Cuenta Ahorro Cuenta Plateada" && o.min_amount_cop === 10_000_001
      );
      expect(tier2).toBeDefined();
      expect(tier2!.rate.ea_percent).toBe(9.0);
      expect(tier2!.max_amount_cop).toBeUndefined();
    });
  });

  describe("common offer properties", () => {
    it("should set bank_name to Banco Popular", () => {
      expect(result.offers.every((o) => o.bank_name === "Banco Popular")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("HTML");
        expect(offer.source.url).toContain("bancopopular.com.co");
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
