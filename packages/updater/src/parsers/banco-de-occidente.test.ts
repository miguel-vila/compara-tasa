import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { BancoDeOccidenteParser } from "./banco-de-occidente.js";
import { BankId, CurrencyIndex, Segment, Channel, ProductType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/banco_de_occidente/rates.pdf");

describe("BancoDeOccidenteParser", () => {
  let result: Awaited<ReturnType<BancoDeOccidenteParser["parse"]>>;

  beforeAll(async () => {
    const parser = new BancoDeOccidenteParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return banco_de_occidente as bank_id", () => {
    expect(result.bank_id).toBe(BankId.BANCO_DE_OCCIDENTE);
  });

  it("should extract exactly 2 offers (Hipotecario + Leasing)", () => {
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
    it("should extract Crédito Hipotecario rate range (11.62% - 16.51%)", () => {
      const offer = result.offers.find((o) => o.product_type === ProductType.HIPOTECARIO);
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBeCloseTo(11.62, 1);
        expect(offer!.rate.ea_percent_to).toBeCloseTo(16.51, 1);
      }
    });

    it("should have COP currency index", () => {
      const offer = result.offers.find((o) => o.product_type === ProductType.HIPOTECARIO);
      expect(offer!.currency_index).toBe(CurrencyIndex.COP);
    });
  });

  describe("Leasing offer", () => {
    it("should extract Leasing Habitacional rate range (11.25% - 16.00%)", () => {
      const offer = result.offers.find((o) => o.product_type === ProductType.LEASING);
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBeCloseTo(11.25, 1);
        expect(offer!.rate.ea_percent_to).toBeCloseTo(16.0, 1);
      }
    });

    it("should have COP currency index", () => {
      const offer = result.offers.find((o) => o.product_type === ProductType.LEASING);
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

    it("should set bank_name to Banco de Occidente", () => {
      expect(result.offers.every((o) => o.bank_name === "Banco de Occidente")).toBe(true);
    });

    it("should not have payroll discount (not advertised)", () => {
      for (const offer of result.offers) {
        expect(offer.conditions.payroll_discount).toBeUndefined();
      }
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("bancodeoccidente.com.co");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.document_label).toBe("Tasas y Tarifas - Personas");
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
