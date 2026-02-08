import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { PibankParser } from "./pibank.js";
import { BankId, SavingsAccountType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../../fixtures/pibank/savings-page.pdf");

describe("PibankParser", () => {
  let result: Awaited<ReturnType<PibankParser["parse"]>>;

  beforeAll(async () => {
    const parser = new PibankParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return pibank as bank_id", () => {
    expect(result.bank_id).toBe(BankId.PIBANK);
  });

  it("should extract exactly 1 offer (Cuenta Pibank)", () => {
    expect(result.offers).toHaveLength(1);
  });

  it("should have no warnings when parsing valid fixture", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Cuenta Pibank offer", () => {
    it("should extract Cuenta Pibank at 11% E.A.", () => {
      const offer = result.offers.find((o) => o.account_name === "Cuenta Pibank");
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBe(11);
    });

    it("should be classified as HIGH_YIELD", () => {
      const offer = result.offers[0];
      expect(offer.account_type).toBe(SavingsAccountType.HIGH_YIELD);
    });

    it("should have min_amount_cop of 1", () => {
      const offer = result.offers[0];
      expect(offer.min_amount_cop).toBe(1);
    });

    it("should not have max_amount_cop (unlimited)", () => {
      const offer = result.offers[0];
      expect(offer.max_amount_cop).toBeUndefined();
    });
  });

  describe("common offer properties", () => {
    it("should set bank_name to Pibank", () => {
      expect(result.offers.every((o) => o.bank_name === "Pibank")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("pibank.co");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.extraction.method).toBe("REGEX");
        expect(offer.source.document_label).toBe("Tasas y Tarifario");
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
