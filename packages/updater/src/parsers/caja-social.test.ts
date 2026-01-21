import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { CajaSocialParser } from "./caja-social.js";
import { BankId, CurrencyIndex, Segment, Channel, MortgageType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/banco_caja_social/rates.pdf");

describe("CajaSocialParser", () => {
  let result: Awaited<ReturnType<CajaSocialParser["parse"]>>;

  beforeAll(async () => {
    const parser = new CajaSocialParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return banco_caja_social as bank_id", () => {
    expect(result.bank_id).toBe(BankId.BANCO_CAJA_SOCIAL);
  });

  it("should extract 4 offers (VIS/NO_VIS x COP/UVR)", () => {
    expect(result.offers).toHaveLength(4);
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

  describe("VIS offers", () => {
    it("should extract VIS COP rate from 10.00% to 14.85%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(10);
        expect(offer!.rate.ea_percent_to).toBe(14.85);
        expect(offer!.rate.mv_percent_from).toBe(0.8);
        expect(offer!.rate.mv_percent_to).toBe(1.16);
      }
    });

    it("should extract VIS UVR rate from 5.15% to 8.10%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(5.15);
        expect(offer!.rate.spread_ea_to).toBe(8.1);
        expect(offer!.rate.spread_mv_from).toBe(0.42);
        expect(offer!.rate.spread_mv_to).toBe(0.65);
      }
    });
  });

  describe("NO_VIS offers", () => {
    it("should extract NO_VIS COP rate from 10.00% to 16.10%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(10);
        expect(offer!.rate.ea_percent_to).toBe(16.1);
        expect(offer!.rate.mv_percent_from).toBe(0.8);
        expect(offer!.rate.mv_percent_to).toBe(1.25);
      }
    });

    it("should extract NO_VIS UVR rate from 6.45% to 9.20%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(6.45);
        expect(offer!.rate.spread_ea_to).toBe(9.2);
        expect(offer!.rate.spread_mv_from).toBe(0.52);
        expect(offer!.rate.spread_mv_to).toBe(0.74);
      }
    });
  });

  describe("common offer properties", () => {
    it("should set channel to UNSPECIFIED", () => {
      expect(result.offers.every((o) => o.channel === Channel.UNSPECIFIED)).toBe(true);
    });

    it("should set bank_name to Banco Caja Social", () => {
      expect(result.offers.every((o) => o.bank_name === "Banco Caja Social")).toBe(true);
    });

    it("should set product_type to hipotecario", () => {
      expect(result.offers.every((o) => o.product_type === MortgageType.HIPOTECARIO)).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("bancocajasocial.com");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.document_label).toBe("Tasas Crédito de Vivienda");
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
