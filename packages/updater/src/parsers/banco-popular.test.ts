import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { BancoPopularParser } from "./banco-popular.js";
import { BankId, CurrencyIndex, Segment, Channel, MortgageType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/banco_popular/tasas.html");

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

  it("should extract exactly 2 offers (Hipotecario + Leasing)", () => {
    expect(result.offers).toHaveLength(2);
  });

  it("should have no warnings when parsing valid fixture", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Hipotecario offer", () => {
    it("should extract Crédito Hipotecario rate as 17.05%", () => {
      const offer = result.offers.find((o) => o.product_type === MortgageType.HIPOTECARIO);
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(17.05);
        expect(offer!.rate.ea_percent_to).toBe(17.55);
      }
    });

    it("should have COP currency index", () => {
      const offer = result.offers.find((o) => o.product_type === MortgageType.HIPOTECARIO);
      expect(offer!.currency_index).toBe(CurrencyIndex.COP);
    });
  });

  describe("Leasing offer", () => {
    it("should extract Leasing Habitacional rate as 16.55%", () => {
      const offer = result.offers.find((o) => o.product_type === MortgageType.LEASING);
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(16.55);
        expect(offer!.rate.ea_percent_to).toBe(17.05);
      }
    });

    it("should have COP currency index", () => {
      const offer = result.offers.find((o) => o.product_type === MortgageType.LEASING);
      expect(offer!.currency_index).toBe(CurrencyIndex.COP);
    });
  });

  describe("common offer properties", () => {
    it("should set segment to UNKNOWN (no VIS/NO_VIS differentiation)", () => {
      expect(result.offers.every((o) => o.segment === Segment.UNKNOWN)).toBe(true);
    });

    it("should set channel to UNSPECIFIED", () => {
      expect(result.offers.every((o) => o.channel === Channel.UNSPECIFIED)).toBe(true);
    });

    it("should set bank_name to Banco Popular", () => {
      expect(result.offers.every((o) => o.bank_name === "Banco Popular")).toBe(true);
    });

    it("should not have payroll discount (not advertised)", () => {
      for (const offer of result.offers) {
        expect(offer.conditions.payroll_discount).toBeUndefined();
      }
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("HTML");
        expect(offer.source.url).toContain("bancopopular.com.co");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.document_label).toBe("Tasas y Tarifas - Casayá");
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
