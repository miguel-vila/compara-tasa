import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { BancoDeBogotaParser } from "./banco-de-bogota.js";
import { BankId, CurrencyIndex, Segment, Channel, ProductType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/banco_de_bogota/rates.pdf");

describe("BancoDeBogotaParser", () => {
  let result: Awaited<ReturnType<BancoDeBogotaParser["parse"]>>;

  beforeAll(async () => {
    const parser = new BancoDeBogotaParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return banco_de_bogota as bank_id", () => {
    expect(result.bank_id).toBe(BankId.BANCO_DE_BOGOTA);
  });

  it("should extract 5 offers (4 hipotecario + 1 leasing)", () => {
    expect(result.offers).toHaveLength(5);
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

  describe("Hipotecario UVR offers", () => {
    it("should extract VIS UVR rate as 10.60%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(10.6);
      }
    });

    it("should extract NO_VIS UVR rate as 12.30%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(12.3);
      }
    });
  });

  describe("Hipotecario COP offers", () => {
    it("should extract VIS COP rate as 15.71%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(15.71);
      }
    });

    it("should extract NO_VIS COP rate as 17.41%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(17.41);
      }
    });
  });

  describe("Leasing offer", () => {
    it("should extract leasing COP rate as 17.41%", () => {
      const offer = result.offers.find((o) => o.product_type === ProductType.LEASING);
      expect(offer).toBeDefined();
      expect(offer!.currency_index).toBe(CurrencyIndex.COP);
      expect(offer!.segment).toBe(Segment.UNKNOWN);
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(17.41);
      }
    });
  });

  describe("common offer properties", () => {
    it("should set channel to UNSPECIFIED", () => {
      expect(result.offers.every((o) => o.channel === Channel.UNSPECIFIED)).toBe(true);
    });

    it("should set bank_name to Banco de Bogotá", () => {
      expect(result.offers.every((o) => o.bank_name === "Banco de Bogotá")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("bancodebogota");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.document_label).toBe("Tasas Banco de Bogotá - Vivienda");
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
