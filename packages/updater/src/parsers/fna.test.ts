import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { FnaParser } from "./fna.js";
import { BankId, CurrencyIndex, Segment, Channel, ProductType } from "@mejor-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/fna/rates-page.html");

describe("FnaParser", () => {
  let result: Awaited<ReturnType<FnaParser["parse"]>>;

  beforeAll(async () => {
    const parser = new FnaParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return fna as bank_id", () => {
    expect(result.bank_id).toBe(BankId.FNA);
  });

  it("should extract at least 6 offers (Hipotecario + Leasing, VIS/NO_VIS, UVR/COP)", () => {
    expect(result.offers.length).toBeGreaterThanOrEqual(6);
  });

  it("should have no critical warnings when parsing valid fixture", () => {
    // Filter out expected warnings about offer count if any
    const criticalWarnings = result.warnings.filter(
      (w) => !w.includes("Only extracted") && !w.includes("expected")
    );
    expect(criticalWarnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Hipotecario UVR offers", () => {
    it("should extract VIS UVR rate as 4.50% (Cesantías, best rate)", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(4.5);
      }
    });

    it("should extract NO_VIS UVR rate as 7.50% (Cesantías, 4+ SMLV)", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(7.5);
      }
    });
  });

  describe("Hipotecario COP offers", () => {
    it("should extract VIS COP rate as 9.50% (Cesantías, 0-2 SMLV)", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(9.5);
      }
    });

    it("should extract NO_VIS COP rate as 12.00% (Cesantías, 4+ SMLV)", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(12.0);
      }
    });
  });

  describe("Leasing COP offers", () => {
    it("should extract Leasing VIS COP rate as 9.00% (Cesantías, 0-2 SMLV)", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.LEASING &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(9.0);
      }
    });

    it("should extract Leasing NO_VIS COP rate as 11.50% (Cesantías, 4+ SMLV)", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.LEASING &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(11.5);
      }
    });
  });

  describe("common offer properties", () => {
    it("should set channel to UNSPECIFIED", () => {
      expect(result.offers.every((o) => o.channel === Channel.UNSPECIFIED)).toBe(true);
    });

    it("should set bank_name to Fondo Nacional del Ahorro", () => {
      expect(result.offers.every((o) => o.bank_name === "Fondo Nacional del Ahorro")).toBe(true);
    });

    it("should include Generación FNA discount of 50 bps", () => {
      for (const offer of result.offers) {
        expect(offer.conditions.payroll_discount).toBeDefined();
        expect(offer.conditions.payroll_discount!.type).toBe("BPS_OFF");
        expect(offer.conditions.payroll_discount!.value).toBe(50);
        expect(offer.conditions.payroll_discount!.note).toContain("Generación FNA");
      }
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("HTML");
        expect(offer.source.url).toContain("fna.gov.co");
        expect(offer.source.retrieved_at).toBeTruthy();
      }
    });

    it("should generate unique stable IDs", () => {
      const ids = result.offers.map((o) => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      expect(ids.every((id) => id.length === 16)).toBe(true);
    });
  });

  describe("deduplication", () => {
    it("should keep Cesantías rates (lower) over AVC rates (higher)", () => {
      // Hipotecario UVR VIS should be 4.50 (Cesantías) not 7.00 (AVC)
      const uvrVis = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS
      );
      expect(uvrVis).toBeDefined();
      if (uvrVis?.rate.kind === "UVR_SPREAD") {
        expect(uvrVis.rate.spread_ea_from).toBe(4.5); // Cesantías rate, not 7.0 (AVC)
      }
    });
  });
});
