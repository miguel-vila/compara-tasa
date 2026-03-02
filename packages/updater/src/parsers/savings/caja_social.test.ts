import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { CajaSocialParser } from "./caja_social.js";
import { BankId, SavingsAccountType, type ScrappedSavingsSource } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(
  __dirname,
  "../../../../../fixtures/banco_caja_social/savings-page.pdf"
);

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

  it("should extract 3 offers (1 basic + 2 premium tiers)", () => {
    // New PDF format has:
    // - 1 offer for Tasa Básica (no min/max)
    // - 2 offers for Tasa Premio (tiered: $1-40M and $40M+)
    expect(result.offers).toHaveLength(3);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Cuenta Alcancía Digital (Tasa Básica)", () => {
    it("should extract basic rate account", () => {
      const basicOffer = result.offers.find(
        (o) =>
          o.account_name === "Cuenta Alcancía Digital" &&
          o.account_type === SavingsAccountType.DIGITAL
      );
      expect(basicOffer).toBeDefined();
      expect(basicOffer!.rate.ea_percent).toBe(0.05);
      expect(basicOffer!.min_amount_cop).toBe(1);
    });
  });

  describe("Cuenta Alcancía Digital Tasa Premio (high yield)", () => {
    it("should extract premium tier 1: $1-$40M at ~8.75% E.A.", () => {
      const tier1 = result.offers.find(
        (o) =>
          o.account_name.includes("Tasa Premio") &&
          o.account_type === SavingsAccountType.HIGH_YIELD &&
          o.max_amount_cop !== undefined
      );
      expect(tier1).toBeDefined();
      expect(tier1!.rate.ea_percent).toBeGreaterThanOrEqual(8.0);
      expect(tier1!.min_amount_cop).toBe(1);
      expect(tier1!.max_amount_cop).toBe(40_000_000);
    });

    it("should extract premium tier 2: $40M+ at 0.05% E.A.", () => {
      const tier2 = result.offers.find(
        (o) =>
          o.account_name.includes("Tasa Premio") &&
          o.account_type === SavingsAccountType.HIGH_YIELD &&
          o.max_amount_cop === undefined
      );
      expect(tier2).toBeDefined();
      expect(tier2!.rate.ea_percent).toBe(0.05);
      expect(tier2!.min_amount_cop).toBe(40_000_001);
      expect(tier2!.max_amount_cop).toBeUndefined();
    });
  });

  describe("common offer properties", () => {
    it("should set bank_name to Banco Caja Social", () => {
      expect(result.offers.every((o) => o.bank_name === "Banco Caja Social")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.kind).toBe("scrapped");
        const source = offer.source as ScrappedSavingsSource;
        expect(source.source_type).toBe("PDF");
        expect(source.url).toContain("bancocajasocial.com");
        expect(source.retrieved_at).toBeTruthy();
        expect(source.document_label).toBe("Tasas Cuenta Alcancía");
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
