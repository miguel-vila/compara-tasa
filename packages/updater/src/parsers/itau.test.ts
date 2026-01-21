import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { ItauParser } from "./itau.js";
import { BankId, CurrencyIndex, Segment, Channel, MortgageType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/itau/rates.pdf");

describe("ItauParser", () => {
  let result: Awaited<ReturnType<ItauParser["parse"]>>;

  beforeAll(async () => {
    const parser = new ItauParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return itau as bank_id", () => {
    expect(result.bank_id).toBe(BankId.ITAU);
  });

  it("should extract 2 offers (hipotecario and leasing)", () => {
    expect(result.offers).toHaveLength(2);
  });

  it("should have no critical warnings when parsing valid fixture", () => {
    const criticalWarnings = result.warnings.filter(
      (w) => !w.includes("expected") && !w.includes("Only extracted")
    );
    expect(criticalWarnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Hipotecario offer", () => {
    it("should extract COP rate from 13.14% to 13.46%", () => {
      const offer = result.offers.find(
        (o) => o.product_type === MortgageType.HIPOTECARIO && o.currency_index === CurrencyIndex.COP
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBeCloseTo(13.14, 2);
        expect(offer!.rate.ea_percent_to).toBeCloseTo(13.46, 2);
      }
    });

    it("should have UNKNOWN segment (Itaú doesn't specify VIS/NO_VIS)", () => {
      const offer = result.offers.find(
        (o) => o.product_type === MortgageType.HIPOTECARIO && o.currency_index === CurrencyIndex.COP
      );
      expect(offer).toBeDefined();
      expect(offer!.segment).toBe(Segment.UNKNOWN);
    });
  });

  describe("Leasing offer", () => {
    it("should extract COP rate from 13.14% to 13.46%", () => {
      const offer = result.offers.find(
        (o) => o.product_type === MortgageType.LEASING && o.currency_index === CurrencyIndex.COP
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBeCloseTo(13.14, 2);
        expect(offer!.rate.ea_percent_to).toBeCloseTo(13.46, 2);
      }
    });

    it("should have UNKNOWN segment", () => {
      const offer = result.offers.find(
        (o) => o.product_type === MortgageType.LEASING && o.currency_index === CurrencyIndex.COP
      );
      expect(offer).toBeDefined();
      expect(offer!.segment).toBe(Segment.UNKNOWN);
    });
  });

  describe("common offer properties", () => {
    it("should set channel to UNSPECIFIED", () => {
      expect(result.offers.every((o) => o.channel === Channel.UNSPECIFIED)).toBe(true);
    });

    it("should set bank_name to Banco Itaú Colombia", () => {
      expect(result.offers.every((o) => o.bank_name === "Banco Itaú Colombia")).toBe(true);
    });

    it("should only have COP rates (Itaú doesn't offer UVR)", () => {
      expect(result.offers.every((o) => o.currency_index === CurrencyIndex.COP)).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("itau.co");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.document_label).toBe("Tasas vigentes persona natural");
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
