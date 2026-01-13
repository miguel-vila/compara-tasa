import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { BancoAgrarioParser } from "./banco-agrario.js";
import { BankId, CurrencyIndex, Segment, Channel, ProductType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/banco_agrario/rates.pdf");

describe("BancoAgrarioParser", () => {
  let result: Awaited<ReturnType<BancoAgrarioParser["parse"]>>;

  beforeAll(async () => {
    const parser = new BancoAgrarioParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return banco_agrario as bank_id", () => {
    expect(result.bank_id).toBe(BankId.BANCO_AGRARIO);
  });

  it("should extract at least 4 offers (VIS/NO_VIS × UVR/COP)", () => {
    expect(result.offers.length).toBeGreaterThanOrEqual(4);
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
    it("should extract VIS UVR rate as 5.10%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBeCloseTo(5.1, 1);
      }
    });

    it("should extract NO_VIS UVR rate as 6.10%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBeCloseTo(6.1, 1);
      }
    });
  });

  describe("Hipotecario COP offers", () => {
    it("should extract VIS COP rate as 10.70%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBeCloseTo(10.7, 1);
      }
    });

    it("should extract NO_VIS COP rate as 12.50%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBeCloseTo(12.5, 1);
      }
    });
  });

  describe("common offer properties", () => {
    it("should set channel to UNSPECIFIED", () => {
      expect(result.offers.every((o) => o.channel === Channel.UNSPECIFIED)).toBe(true);
    });

    it("should set bank_name to Banco Agrario", () => {
      expect(result.offers.every((o) => o.bank_name === "Banco Agrario")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("bancoagrario");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.document_label).toBe("Tasas de Colocación - Banco Agrario");
      }
    });

    it("should generate unique stable IDs", () => {
      const ids = result.offers.map((o) => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      expect(ids.every((id) => id.length === 16)).toBe(true);
    });

    it("should have extraction metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.extraction.method).toBe("REGEX");
        expect(offer.source.extraction.locator).toBe("housing_rates_section");
        expect(offer.source.extraction.excerpt).toBeTruthy();
      }
    });
  });
});
