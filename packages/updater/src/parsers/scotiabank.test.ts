import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { ScotiabankParser } from "./scotiabank.js";
import { BankId, CurrencyIndex, Segment, Channel, ProductType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/scotiabank_colpatria/rates.pdf");

describe("ScotiabankParser", () => {
  let result: Awaited<ReturnType<ScotiabankParser["parse"]>>;

  beforeAll(async () => {
    const parser = new ScotiabankParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return scotiabank_colpatria as bank_id", () => {
    expect(result.bank_id).toBe(BankId.SCOTIABANK_COLPATRIA);
  });

  it("should extract 5 offers (4 hipotecario + 1 leasing)", () => {
    expect(result.offers).toHaveLength(5);
  });

  it("should have no critical warnings when parsing valid fixture", () => {
    // Filter out informational warnings
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
    it("should extract VIS UVR rate as 6.60%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(6.6);
        expect(offer!.rate.spread_ea_to).toBe(6.8);
      }
    });

    it("should extract NO_VIS UVR rate as 7.60%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(7.6);
        expect(offer!.rate.spread_ea_to).toBe(7.8);
      }
    });
  });

  describe("Hipotecario COP offers", () => {
    it("should extract VIS COP rate as 12.15%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(12.15);
        expect(offer!.rate.ea_percent_to).toBe(12.35);
      }
    });

    it("should extract NO_VIS COP rate as 12.25%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(12.25);
        expect(offer!.rate.ea_percent_to).toBe(12.45);
      }
    });
  });

  describe("Leasing offer", () => {
    it("should extract leasing COP rate as 12.25%", () => {
      const offer = result.offers.find((o) => o.product_type === ProductType.LEASING);
      expect(offer).toBeDefined();
      expect(offer!.currency_index).toBe(CurrencyIndex.COP);
      expect(offer!.segment).toBe(Segment.UNKNOWN); // Leasing doesn't specify VIS/NO_VIS
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(12.25);
        expect(offer!.rate.ea_percent_to).toBe(12.45);
      }
    });
  });

  describe("common offer properties", () => {
    it("should set channel to UNSPECIFIED", () => {
      expect(result.offers.every((o) => o.channel === Channel.UNSPECIFIED)).toBe(true);
    });

    it("should set bank_name to Scotiabank Colpatria", () => {
      expect(result.offers.every((o) => o.bank_name === "Scotiabank Colpatria")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("scotiabank-colombia");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.document_label).toBe("Tasas y productos de crédito");
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
