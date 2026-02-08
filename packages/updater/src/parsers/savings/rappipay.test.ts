import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "path";
import { RappiPayParser } from "./rappipay.js";
import { BankId, SavingsAccountType, type ScrappedSavingsSource } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../../fixtures/rappipay/savings-page.html");

describe("RappiPayParser", () => {
  let result: Awaited<ReturnType<RappiPayParser["parse"]>>;

  beforeAll(async () => {
    const parser = new RappiPayParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return rappipay as bank_id", () => {
    expect(result.bank_id).toBe(BankId.RAPPIPAY);
  });

  it("should extract at least 4 offers (2 for Depósito + 2 for Cuenta)", () => {
    expect(result.offers.length).toBeGreaterThanOrEqual(4);
  });

  it("should have no warnings when parsing valid fixture", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Bolsillos offers (High Yield)", () => {
    it("should extract Bolsillos (Depósito de Bajo Monto) at 9% E.A.", () => {
      const offer = result.offers.find(
        (o) => o.account_name === "Bolsillos (Depósito de Bajo Monto)"
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBe(9);
      expect(offer!.account_type).toBe(SavingsAccountType.HIGH_YIELD);
    });

    it("should extract Bolsillos (Cuenta de Ahorros) at 9% E.A.", () => {
      const offer = result.offers.find((o) => o.account_name === "Bolsillos (Cuenta de Ahorros)");
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBe(9);
      expect(offer!.account_type).toBe(SavingsAccountType.HIGH_YIELD);
    });
  });

  describe("Saldo Principal offers (Standard)", () => {
    it("should extract Saldo Principal (Depósito de Bajo Monto) at 0.1% E.A.", () => {
      const offer = result.offers.find(
        (o) => o.account_name === "Saldo Principal (Depósito de Bajo Monto)"
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBe(0.1);
      expect(offer!.account_type).toBe(SavingsAccountType.STANDARD);
    });

    it("should extract Saldo Principal (Cuenta de Ahorros) at 0.1% E.A.", () => {
      const offer = result.offers.find(
        (o) => o.account_name === "Saldo Principal (Cuenta de Ahorros)"
      );
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBe(0.1);
      expect(offer!.account_type).toBe(SavingsAccountType.STANDARD);
    });
  });

  describe("common offer properties", () => {
    it("should set bank_name to RappiPay", () => {
      expect(result.offers.every((o) => o.bank_name === "RappiPay")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.kind).toBe("scrapped");
        const source = offer.source as ScrappedSavingsSource;
        expect(source.source_type).toBe("HTML");
        expect(source.url).toContain("rappipay.co");
        expect(source.retrieved_at).toBeTruthy();
        expect(source.extraction.method).toBe("CSS_SELECTOR");
      }
    });

    it("should generate unique stable IDs", () => {
      const ids = result.offers.map((o) => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      expect(ids.every((id) => id.length === 16)).toBe(true);
    });

    it("should have min_amount_cop of 1 for all offers", () => {
      expect(result.offers.every((o) => o.min_amount_cop === 1)).toBe(true);
    });
  });
});
