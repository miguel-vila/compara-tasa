import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { AvvillasParser } from "./avvillas.js";
import { BankId, CurrencyIndex, Segment, Channel, MortgageType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/avvillas/rates.pdf");

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

  it("should extract 8 offers (standard + leasing + digital)", () => {
    // 3 standard hipotecario (VIS UVR, NO VIS UVR, NO VIS COP)
    // 1 leasing (UNKNOWN segment UVR)
    // 4 digital (VIS COP, NO VIS COP, VIS UVR, NO VIS UVR)
    expect(result.offers).toHaveLength(8);
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

  describe("Standard Hipotecario offers (UNSPECIFIED channel)", () => {
    it("should extract VIS UVR rate from 8.90% to 10.05%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS &&
          o.channel === Channel.UNSPECIFIED
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBeCloseTo(8.9, 1);
        expect(offer!.rate.spread_ea_to).toBeCloseTo(10.05, 2);
      }
    });

    it("should extract NO_VIS UVR rate from 9.05% to 9.85%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS &&
          o.channel === Channel.UNSPECIFIED
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBeCloseTo(9.05, 2);
        expect(offer!.rate.spread_ea_to).toBeCloseTo(9.85, 2);
      }
    });

    it("should extract NO_VIS COP rate from 15.00% to 15.75%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS &&
          o.channel === Channel.UNSPECIFIED
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(15);
        expect(offer!.rate.ea_percent_to).toBe(15.75);
      }
    });
  });

  describe("Leasing Habitacional offers", () => {
    it("should extract leasing UVR rate of 9.30%", () => {
      const offer = result.offers.find(
        (o) => o.product_type === MortgageType.LEASING && o.currency_index === CurrencyIndex.UVR
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      expect(offer!.segment).toBe(Segment.UNKNOWN);
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBeCloseTo(9.3, 1);
        expect(offer!.rate.spread_ea_to).toBeUndefined();
      }
    });
  });

  describe("Digital channel offers", () => {
    it("should extract Digital VIS COP rate of 12.20%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS &&
          o.channel === Channel.DIGITAL
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBeCloseTo(12.2, 1);
        expect(offer!.rate.ea_percent_to).toBeUndefined();
      }
    });

    it("should extract Digital NO_VIS COP rate of 12.40%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS &&
          o.channel === Channel.DIGITAL
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBeCloseTo(12.4, 1);
        expect(offer!.rate.ea_percent_to).toBeUndefined();
      }
    });

    it("should extract Digital VIS UVR rate from 7.50% to 8.50%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS &&
          o.channel === Channel.DIGITAL
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBeCloseTo(7.5, 1);
        expect(offer!.rate.spread_ea_to).toBeCloseTo(8.5, 1);
      }
    });

    it("should extract Digital NO_VIS UVR rate from 7.50% to 8.50%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS &&
          o.channel === Channel.DIGITAL
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBeCloseTo(7.5, 1);
        expect(offer!.rate.spread_ea_to).toBeCloseTo(8.5, 1);
      }
    });
  });

  describe("common offer properties", () => {
    it("should set bank_name to Banco AV Villas", () => {
      expect(result.offers.every((o) => o.bank_name === "Banco AV Villas")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.document_label).toBe(
          "Tasas de Colocación - Crédito Según Línea y Plazo"
        );
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
