import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { BancomevaParser } from "./bancoomeva.js";
import { BankId, CurrencyIndex, Segment, Channel, ProductType } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../fixtures/bancoomeva/rates.pdf");

describe("BancomevaParser", () => {
  let result: Awaited<ReturnType<BancomevaParser["parse"]>>;

  beforeAll(async () => {
    const parser = new BancomevaParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return bancoomeva as bank_id", () => {
    expect(result.bank_id).toBe(BankId.BANCOOMEVA);
  });

  it("should extract 8 offers (4 client rates + 4 associate rates)", () => {
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

  describe("Client rates (Clientes Bancoomeva)", () => {
    it("should extract NO_VIS COP rate as 14.3%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS &&
          o.channel === Channel.UNSPECIFIED
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(14.3);
      }
    });

    it("should extract NO_VIS UVR rate as 8.3%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS &&
          o.channel === Channel.UNSPECIFIED
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(8.3);
      }
    });

    it("should extract VIS COP rate as 13.89%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS &&
          o.channel === Channel.UNSPECIFIED
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(13.89);
      }
    });

    it("should extract VIS UVR rate as 8.55%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS &&
          o.channel === Channel.UNSPECIFIED
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(8.55);
      }
    });
  });

  describe("Associate rates (Asociados a Coomeva)", () => {
    it("should extract NO_VIS COP rate as 13.22%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.NO_VIS &&
          o.channel === Channel.BRANCH
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(13.22);
      }
    });

    it("should extract NO_VIS UVR rate as 7.3%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.NO_VIS &&
          o.channel === Channel.BRANCH
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(7.3);
      }
    });

    it("should extract VIS COP rate as 12.82%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.COP &&
          o.segment === Segment.VIS &&
          o.channel === Channel.BRANCH
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("COP_FIXED");
      if (offer!.rate.kind === "COP_FIXED") {
        expect(offer!.rate.ea_percent_from).toBe(12.82);
      }
    });

    it("should extract VIS UVR rate as 7.55%", () => {
      const offer = result.offers.find(
        (o) =>
          o.product_type === ProductType.HIPOTECARIO &&
          o.currency_index === CurrencyIndex.UVR &&
          o.segment === Segment.VIS &&
          o.channel === Channel.BRANCH
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.kind).toBe("UVR_SPREAD");
      if (offer!.rate.kind === "UVR_SPREAD") {
        expect(offer!.rate.spread_ea_from).toBe(7.55);
      }
    });

    it("should include note for cooperative members", () => {
      const associateOffers = result.offers.filter((o) => o.channel === Channel.BRANCH);
      expect(associateOffers.length).toBeGreaterThan(0);
      for (const offer of associateOffers) {
        expect(offer.conditions.notes).toBeDefined();
        expect(offer.conditions.notes).toContain("Rate for Coomeva cooperative members");
      }
    });
  });

  describe("common offer properties", () => {
    it("should set bank_name to Bancoomeva", () => {
      expect(result.offers.every((o) => o.bank_name === "Bancoomeva")).toBe(true);
    });

    it("should set product_type to hipotecario", () => {
      expect(result.offers.every((o) => o.product_type === ProductType.HIPOTECARIO)).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("bancoomeva");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.document_label).toBe("Tasas de Crédito");
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
