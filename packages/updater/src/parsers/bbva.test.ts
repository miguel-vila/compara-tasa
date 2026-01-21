import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { BbvaParser } from "./bbva.js";
import { BankId, CurrencyIndex, Segment, Channel, MortgageType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/bbva/rates.pdf");

describe("BbvaParser", () => {
  let result: Awaited<ReturnType<BbvaParser["parse"]>>;

  beforeAll(async () => {
    const parser = new BbvaParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return bbva as bank_id", () => {
    expect(result.bank_id).toBe(BankId.BBVA);
  });

  it("should extract 6 offers (4 hipotecario + 2 leasing)", () => {
    expect(result.offers).toHaveLength(6);
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

  describe("Hipotecario VIS offers", () => {
    it("should extract VIS COP rate as 9.77%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(9.77);
        expect(offer!.rate.mv_percent_from).toBe(0.78);
      }
    });

    it("should have VIS COP payroll discount of 200bps", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS
      );
      expect(offer!.conditions.payroll_discount).toBeDefined();
      expect(offer!.conditions.payroll_discount!.type).toBe("BPS_OFF");
      expect(offer!.conditions.payroll_discount!.value).toBe(200);
    });

    it("should extract VIS UVR rate as 5.52%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(5.52);
        expect(offer!.rate.spread_mv_from).toBe(0.45);
      }
    });

    it("should have VIS UVR payroll discount of 200bps", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS
      );
      expect(offer!.conditions.payroll_discount).toBeDefined();
      expect(offer!.conditions.payroll_discount!.type).toBe("BPS_OFF");
      expect(offer!.conditions.payroll_discount!.value).toBe(200);
    });
  });

  describe("Hipotecario NO_VIS offers", () => {
    it("should extract NO_VIS COP rate as 11.98%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(11.98);
        expect(offer!.rate.mv_percent_from).toBe(0.95);
      }
    });

    it("should have NO_VIS COP payroll discount of 250bps", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS
      );
      expect(offer!.conditions.payroll_discount).toBeDefined();
      expect(offer!.conditions.payroll_discount!.type).toBe("BPS_OFF");
      expect(offer!.conditions.payroll_discount!.value).toBe(250);
    });

    it("should extract NO_VIS UVR rate as 7.40%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(7.4);
        expect(offer!.rate.spread_mv_from).toBe(0.6);
      }
    });

    it("should have NO_VIS UVR payroll discount of 150bps", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === MortgageType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS
      );
      expect(offer!.conditions.payroll_discount).toBeDefined();
      expect(offer!.conditions.payroll_discount!.type).toBe("BPS_OFF");
      expect(offer!.conditions.payroll_discount!.value).toBe(150);
    });
  });

  describe("Leasing offers", () => {
    it("should extract Leasing NO_VIS COP rate as 10.19%", () => {
      const offer = result.offers.find(
        (o) => o.product_type === MortgageType.LEASING && o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.currency_index).toBe(CurrencyIndex.COP);
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(10.19);
        expect(offer!.rate.mv_percent_from).toBe(0.81);
      }
    });

    it("should extract Leasing VIS COP rate as 10.79%", () => {
      const offer = result.offers.find(
        (o) => o.product_type === MortgageType.LEASING && o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.currency_index).toBe(CurrencyIndex.COP);
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(10.79);
        expect(offer!.rate.mv_percent_from).toBe(0.86);
      }
    });
  });

  describe("common offer properties", () => {
    it("should set channel to UNSPECIFIED", () => {
      expect(result.offers.every((o) => o.channel === Channel.UNSPECIFIED)).toBe(true);
    });

    it("should set bank_name to BBVA Colombia", () => {
      expect(result.offers.every((o) => o.bank_name === "BBVA Colombia")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("bbva.com.co");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.document_label).toBe("Tasas de interés líneas de vivienda");
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
