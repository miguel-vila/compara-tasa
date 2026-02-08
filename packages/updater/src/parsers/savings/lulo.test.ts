import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { LuloParser } from "./lulo.js";
import { BankId, SavingsAccountType, type ScrappedSavingsSource } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../../fixtures/lulo/savings-page.html");

describe("LuloParser", () => {
  let result: Awaited<ReturnType<LuloParser["parse"]>>;

  beforeAll(async () => {
    const parser = new LuloParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return lulo as bank_id", () => {
    expect(result.bank_id).toBe(BankId.LULO);
  });

  it("should extract exactly 4 offers (Flex regular/pro + Programados regular/pro)", () => {
    expect(result.offers).toHaveLength(4);
  });

  it("should have no warnings when parsing valid fixture", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Bolsillos Flex offers", () => {
    it("should extract regular Bolsillos Flex at 7.5% E.A.", () => {
      const flexRegular = result.offers.find((o) => o.account_name === "Bolsillos Flex");
      expect(flexRegular).toBeDefined();
      expect(flexRegular!.rate.ea_percent).toBe(7.5);
      expect(flexRegular!.account_type).toBe(SavingsAccountType.HIGH_YIELD);
    });

    it("should extract Lulo Pro Bolsillos Flex at 9.25% E.A.", () => {
      const flexPro = result.offers.find((o) => o.account_name === "Bolsillos Flex (Lulo Pro)");
      expect(flexPro).toBeDefined();
      expect(flexPro!.rate.ea_percent).toBe(9.25);
      expect(flexPro!.account_type).toBe(SavingsAccountType.HIGH_YIELD);
    });
  });

  describe("Bolsillos Programados offers", () => {
    it("should extract regular Bolsillos Programados at 9% E.A.", () => {
      const programadosRegular = result.offers.find(
        (o) => o.account_name === "Bolsillos Programados"
      );
      expect(programadosRegular).toBeDefined();
      expect(programadosRegular!.rate.ea_percent).toBe(9);
      expect(programadosRegular!.account_type).toBe(SavingsAccountType.HIGH_YIELD);
    });

    it("should extract Lulo Pro Bolsillos Programados at 10% E.A.", () => {
      const programadosPro = result.offers.find(
        (o) => o.account_name === "Bolsillos Programados (Lulo Pro)"
      );
      expect(programadosPro).toBeDefined();
      expect(programadosPro!.rate.ea_percent).toBe(10);
      expect(programadosPro!.account_type).toBe(SavingsAccountType.HIGH_YIELD);
    });
  });

  describe("common offer properties", () => {
    it("should set bank_name to Lulo Bank", () => {
      expect(result.offers.every((o) => o.bank_name === "Lulo Bank")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.kind).toBe("scrapped");
        const source = offer.source as ScrappedSavingsSource;
        expect(source.source_type).toBe("HTML");
        expect(source.url).toContain("lulobank.com");
        expect(source.retrieved_at).toBeTruthy();
        expect(source.extraction.method).toBe("REGEX");
        expect(source.extraction.locator).toBe(".article-body");
      }
    });

    it("should generate unique stable IDs", () => {
      const ids = result.offers.map((o) => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      expect(ids.every((id) => id.length === 16)).toBe(true);
    });

    it("should have min_amount_cop of 1 for all offers", () => {
      expect(result.offers.every((o) => o.min_amount_cop === 1)).toBe(true);
    });
  });
});
