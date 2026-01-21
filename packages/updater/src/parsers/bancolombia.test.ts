import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { BancolombiaParser } from "./bancolombia.js";
import { BankId, CurrencyIndex, Segment, Channel, MortgageType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/bancolombia/rates-page.html");

describe("BancolombiaParser", () => {
  let result: Awaited<ReturnType<BancolombiaParser["parse"]>>;

  beforeAll(async () => {
    const parser = new BancolombiaParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return bancolombia as bank_id", () => {
    expect(result.bank_id).toBe(BankId.BANCOLOMBIA);
  });

  it("should extract exactly 4 offers (VIS/NO_VIS × UVR/COP)", () => {
    expect(result.offers).toHaveLength(4);
  });

  it("should have no warnings when parsing valid fixture", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("UVR offers", () => {
    it("should extract VIS UVR rate as 6.50%", () => {
      const offer = result.offers.find(
        (o) => o.currency_index === CurrencyIndex.UVR && o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(6.5);
      }
    });

    it("should extract NO_VIS UVR rate as 8.00%", () => {
      const offer = result.offers.find(
        (o) => o.currency_index === CurrencyIndex.UVR && o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(8.0);
      }
    });
  });

  describe("COP offers", () => {
    it("should extract VIS COP rate as 12.00%", () => {
      const offer = result.offers.find(
        (o) => o.currency_index === CurrencyIndex.COP && o.segment === Segment.VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(12.0);
      }
    });

    it("should extract NO_VIS COP rate as 12.00%", () => {
      const offer = result.offers.find(
        (o) => o.currency_index === CurrencyIndex.COP && o.segment === Segment.NO_VIS
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(12.0);
      }
    });
  });

  describe("common offer properties", () => {
    it("should set product_type to hipotecario", () => {
      expect(result.offers.every((o) => o.product_type === MortgageType.HIPOTECARIO)).toBe(true);
    });

    it("should set channel to UNSPECIFIED", () => {
      expect(result.offers.every((o) => o.channel === Channel.UNSPECIFIED)).toBe(true);
    });

    it("should set bank_name to Bancolombia", () => {
      expect(result.offers.every((o) => o.bank_name === "Bancolombia")).toBe(true);
    });

    it("should include payroll discount of 1%", () => {
      for (const offer of result.offers) {
        expect(offer.conditions.payroll_discount).toBeDefined();
        expect(offer.conditions.payroll_discount!.type).toBe("PERCENT_OFF");
        expect(offer.conditions.payroll_discount!.value).toBe(1.0);
      }
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("HTML");
        expect(offer.source.url).toContain("bancolombia.com");
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
});
