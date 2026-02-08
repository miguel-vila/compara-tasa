import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { UalaParser } from "./uala.js";
import { BankId, SavingsAccountType, type ScrappedSavingsSource } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../../fixtures/uala/savings-page.html");

describe("UalaParser", () => {
  let result: Awaited<ReturnType<UalaParser["parse"]>>;

  beforeAll(async () => {
    const parser = new UalaParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return uala as bank_id", () => {
    expect(result.bank_id).toBe(BankId.UALA);
  });

  it("should extract exactly 1 offer (Depósito Remunerado)", () => {
    expect(result.offers).toHaveLength(1);
  });

  it("should have no warnings when parsing valid fixture", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Depósito Remunerado offer", () => {
    it("should extract rate at 13% E.A.", () => {
      const offer = result.offers[0];
      expect(offer.rate.ea_percent).toBe(13);
    });

    it("should have correct account type and name", () => {
      const offer = result.offers[0];
      expect(offer.account_type).toBe(SavingsAccountType.HIGH_YIELD);
      expect(offer.account_name).toBe("Depósito Remunerado");
    });

    it("should have bank_name set to Ualá", () => {
      const offer = result.offers[0];
      expect(offer.bank_name).toBe("Ualá");
    });
  });

  describe("common offer properties", () => {
    it("should have valid source metadata", () => {
      const offer = result.offers[0];
      expect(offer.source.kind).toBe("scrapped");
      const source = offer.source as ScrappedSavingsSource;
      expect(source.source_type).toBe("HTML");
      expect(source.url).toContain("uala.com.co");
      expect(source.retrieved_at).toBeTruthy();
      expect(source.extraction.method).toBe("REGEX");
    });

    it("should generate a valid stable ID", () => {
      const offer = result.offers[0];
      expect(offer.id).toBeTruthy();
      expect(offer.id.length).toBe(16);
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
});
