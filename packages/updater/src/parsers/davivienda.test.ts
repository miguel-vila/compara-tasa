import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { DaviviendaParser } from "./davivienda.js";
import { BankId, CurrencyIndex, Segment, Channel, MortgageType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/davivienda/rates.pdf");

describe("DaviviendaParser", () => {
  let result: Awaited<ReturnType<DaviviendaParser["parse"]>>;

  beforeAll(async () => {
    const parser = new DaviviendaParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return correct bank_id", () => {
    expect(result.bank_id).toBe(BankId.DAVIVIENDA);
  });

  it("should extract expected number of offers", () => {
    // Expect 8 offers: VIS/NO_VIS × UVR/COP × HIPOTECARIO/LEASING
    expect(result.offers.length).toBeGreaterThanOrEqual(8);
  });

  it("should have no critical warnings", () => {
    const criticalWarnings = result.warnings.filter(
      (w) => !w.includes("expected") && !w.includes("Only extracted")
    );
    expect(criticalWarnings).toHaveLength(0);
  });

  it("should return a valid raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Hipotecario UVR offers", () => {
    it("should extract VIS UVR rate", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        // Expected: 6.95% based on fixture analysis
        expect(offer!.rate.spread_ea_from).toBeCloseTo(6.95, 1);
      }
    });

    it("should extract NO_VIS UVR rate", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        // Expected: 7.95% based on fixture analysis
        expect(offer!.rate.spread_ea_from).toBeCloseTo(7.95, 1);
      }
    });
  });

  describe("Hipotecario COP offers", () => {
    it("should extract VIS COP rate", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        // Expected: 12.60% based on fixture analysis
        expect(offer!.rate.ea_percent_from).toBeCloseTo(12.6, 1);
      }
    });

    it("should extract NO_VIS COP rate", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        // Expected: 12.50% based on fixture analysis
        expect(offer!.rate.ea_percent_from).toBeCloseTo(12.5, 1);
      }
    });
  });

  describe("Leasing UVR offers", () => {
    it("should extract VIS UVR leasing rate", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.LEASING &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        // Expected: 6.95% based on fixture analysis
        expect(offer!.rate.spread_ea_from).toBeCloseTo(6.95, 1);
      }
    });

    it("should extract NO_VIS UVR leasing rate", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.LEASING &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        // Expected: 7.50% based on fixture analysis
        expect(offer!.rate.spread_ea_from).toBeCloseTo(7.5, 1);
      }
    });
  });

  describe("Leasing COP offers", () => {
    it("should extract VIS COP leasing rate", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.LEASING &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        // Expected: 12.10% based on fixture analysis
        expect(offer!.rate.ea_percent_from).toBeCloseTo(12.1, 1);
      }
    });

    it("should extract NO_VIS COP leasing rate", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.LEASING &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        // Expected: 11.00% based on fixture analysis
        expect(offer!.rate.ea_percent_from).toBeCloseTo(11.0, 1);
      }
    });
  });

  describe("common properties", () => {
    it("should set channel to UNSPECIFIED", () => {
      expect(result.offers.every((o) => o.channel === Channel.UNSPECIFIED)).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.url).toBeTruthy();
        expect(offer.source.retrieved_at).toBeTruthy();
      }
    });

    it("should generate unique stable IDs", () => {
      const ids = result.offers.map((o) => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      expect(ids.every((id) => id.length === 16)).toBe(true);
    });

    it("should set bank_name to Davivienda", () => {
      expect(result.offers.every((o) => o.bank_name === "Davivienda")).toBe(true);
    });
  });
});
