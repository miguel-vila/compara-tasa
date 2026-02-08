import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { CajaSocialParser } from "./caja_social.js";
import { BankId, SavingsAccountType } from "@compara-tasa/core";

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

  it("should extract 4 offers (2 accounts x 2 tiers each)", () => {
    expect(result.offers).toHaveLength(4);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  it("should have no warnings", () => {
    expect(result.warnings).toHaveLength(0);
  });

  describe("Cuenta Alcancía Digital (standard)", () => {
    it("should extract tier 1: $1-$40M at 0.05% E.A.", () => {
      const tier1 = result.offers.find(
        (o) => o.account_name === "Cuenta Alcancía Digital" && o.min_amount_cop === 1
      );
      expect(tier1).toBeDefined();
      expect(tier1!.rate.ea_percent).toBe(0.05);
      expect(tier1!.max_amount_cop).toBe(40_000_000);
      expect(tier1!.account_type).toBe(SavingsAccountType.DIGITAL);
    });

    it("should extract tier 2: $40M+ at 0.05% E.A.", () => {
      const tier2 = result.offers.find(
        (o) => o.account_name === "Cuenta Alcancía Digital" && o.min_amount_cop === 40_000_001
      );
      expect(tier2).toBeDefined();
      expect(tier2!.rate.ea_percent).toBe(0.05);
      expect(tier2!.max_amount_cop).toBeUndefined();
    });
  });

  describe("Cuenta Alcancía Digital Tasa Premio (high yield)", () => {
    it("should extract tier 1: $1-$40M at 8.00% E.A.", () => {
      const tier1 = result.offers.find(
        (o) => o.account_name.includes("Tasa Premio") && o.min_amount_cop === 1
      );
      expect(tier1).toBeDefined();
      expect(tier1!.rate.ea_percent).toBe(8.0);
      expect(tier1!.max_amount_cop).toBe(40_000_000);
      expect(tier1!.account_type).toBe(SavingsAccountType.HIGH_YIELD);
    });

    it("should extract tier 2: $40M+ at 0.05% E.A.", () => {
      const tier2 = result.offers.find(
        (o) => o.account_name.includes("Tasa Premio") && o.min_amount_cop === 40_000_001
      );
      expect(tier2).toBeDefined();
      expect(tier2!.rate.ea_percent).toBe(0.05);
      expect(tier2!.max_amount_cop).toBeUndefined();
    });
  });

  describe("common offer properties", () => {
    it("should set bank_name to Banco Caja Social", () => {
      expect(result.offers.every((o) => o.bank_name === "Banco Caja Social")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.source_type).toBe("PDF");
        expect(offer.source.url).toContain("bancocajasocial.com");
        expect(offer.source.retrieved_at).toBeTruthy();
        expect(offer.source.document_label).toBe("Tasas Cuenta Alcancía");
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
