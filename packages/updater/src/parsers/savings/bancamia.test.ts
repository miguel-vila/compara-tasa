import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { BancamiaParser } from "./bancamia.js";
import { BankId, SavingsAccountType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../../fixtures/bancamia/savings-page.pdf");

describe("BancamiaParser", () => {
  let result: Awaited<ReturnType<BancamiaParser["parse"]>>;

  beforeAll(async () => {
    const parser = new BancamiaParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return bancamia as bank_id", () => {
    expect(result.bank_id).toBe(BankId.BANCAMIA);
  });

  it("should extract exactly 6 RentaPlus tier offers", () => {
    expect(result.offers).toHaveLength(6);
  });

  it("should have no warnings when parsing valid fixture", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("RentaPlus tier rates", () => {
    it("should extract tier 1: up to $499,999 at 5.0% E.A.", () => {
      const offer = result.offers.find(
        (o) => o.min_amount_cop === 1 && o.max_amount_cop === 499_999
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBeCloseTo(5.0, 1);
    });

    it("should extract tier 2: $500,001 - $999,999 at 6.0% E.A.", () => {
      const offer = result.offers.find(
        (o) => o.min_amount_cop === 500_001 && o.max_amount_cop === 999_999
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBeCloseTo(6.0, 1);
    });

    it("should extract tier 3: $1,000,000 - $1,999,999 at 7.0% E.A.", () => {
      const offer = result.offers.find(
        (o) => o.min_amount_cop === 1_000_000 && o.max_amount_cop === 1_999_999
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBeCloseTo(7.0, 1);
    });

    it("should extract tier 4: $2,000,000 - $4,999,999 at 8.0% E.A.", () => {
      const offer = result.offers.find(
        (o) => o.min_amount_cop === 2_000_000 && o.max_amount_cop === 4_999_999
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBeCloseTo(8.0, 1);
    });

    it("should extract tier 5: $5,000,000 - $9,999,999 at 10.0% E.A.", () => {
      const offer = result.offers.find(
        (o) => o.min_amount_cop === 5_000_000 && o.max_amount_cop === 9_999_999
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBeCloseTo(10.0, 1);
    });

    it("should extract tier 6: $10,000,000+ at 10.5% E.A.", () => {
      const offer = result.offers.find(
        (o) => o.min_amount_cop === 10_000_000 && o.max_amount_cop === undefined
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBeCloseTo(10.5, 1);
    });
  });

  describe("common offer properties", () => {
    it("should classify all offers as HIGH_YIELD", () => {
      expect(result.offers.every((o) => o.account_type === SavingsAccountType.HIGH_YIELD)).toBe(
        true
      );
    });

    it("should set account_name to RentaPlus for all offers", () => {
      expect(result.offers.every((o) => o.account_name === "RentaPlus")).toBe(true);
    });

    it("should set bank_name to Bancamía", () => {
      expect(result.offers.every((o) => o.bank_name === "Bancamía")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("bancamia.com.co");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.extraction.method).toBe("REGEX");
        expect(offer.source.document_label).toBe("Tasas y Tarifas de Ahorro");
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
