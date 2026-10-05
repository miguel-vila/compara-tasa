import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { PibankParser, resolvePibankPdfUrl } from "./pibank.js";
import { BankId, SavingsAccountType, type ScrappedSavingsSource } from "@compara-tasa/core";

const FIXTURE_PATH = resolve(__dirname, "../../../../../fixtures/pibank/savings-page.pdf");
const OCTOBER_PDF_PATH = resolve(__dirname, "../../../../../fixtures/pibank/Octubre_-2026.pdf");
const HOME_PATH = resolve(__dirname, "../../../../../fixtures/pibank/home-2026-10-05.html");
const HOME_URL = "https://www.pibank.co/";
const OCTOBER_PDF_URL = "https://www.pibank.co/uploads/2026/10/Octubre_-2026.pdf";

describe("resolvePibankPdfUrl", () => {
  it("resolves the rates PDF linked from the home page", async () => {
    const html = await readFile(HOME_PATH, "utf-8");
    expect(resolvePibankPdfUrl(html, HOME_URL)).toBe(OCTOBER_PDF_URL);
  });

  it("rejects a page without a rates PDF link", () => {
    expect(() => resolvePibankPdfUrl('<a href="/other.pdf">Other</a>', HOME_URL)).toThrow(
      "Expected one Pibank rates PDF URL, found 0"
    );
  });

  it("rejects conflicting rates PDF links", () => {
    const html =
      '<a href="/first.pdf">Tasas y tarifas</a><a href="/second.pdf">Tasas y tarifas</a>';
    expect(() => resolvePibankPdfUrl(html, HOME_URL)).toThrow(
      "Expected one Pibank rates PDF URL, found 2"
    );
  });
});

describe("Pibank October 2026 rates PDF", () => {
  it("extracts the Cuenta Pibank offer", async () => {
    const result = await new PibankParser({
      useFixtures: true,
      fixturesPath: OCTOBER_PDF_PATH,
    }).parse();
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toMatchObject({
      bank_id: BankId.PIBANK,
      account_name: "Cuenta Pibank",
      account_type: SavingsAccountType.HIGH_YIELD,
      rate: { ea_percent: 11 },
      min_amount_cop: 1,
    });
    expect(result.offers[0].max_amount_cop).toBeUndefined();
  });
});

describe("PibankParser", () => {
  let result: Awaited<ReturnType<PibankParser["parse"]>>;

  beforeAll(async () => {
    const parser = new PibankParser({
      useFixtures: true,
      fixturesPath: FIXTURE_PATH,
    });
    result = await parser.parse();
  });

  it("should return pibank as bank_id", () => {
    expect(result.bank_id).toBe(BankId.PIBANK);
  });

  it("should extract exactly 1 offer (Cuenta Pibank)", () => {
    expect(result.offers).toHaveLength(1);
  });

  it("should have no warnings when parsing valid fixture", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("should return a non-empty raw_text_hash", () => {
    expect(result.raw_text_hash).toBeTruthy();
    expect(result.raw_text_hash.length).toBe(64); // SHA-256 hex
  });

  describe("Cuenta Pibank offer", () => {
    it("should extract Cuenta Pibank at 11% E.A.", () => {
      const offer = result.offers.find((o) => o.account_name === "Cuenta Pibank");
      expect(offer).toBeDefined();
      expect(offer!.rate.ea_percent).toBe(11);
    });

    it("should be classified as HIGH_YIELD", () => {
      const offer = result.offers[0];
      expect(offer.account_type).toBe(SavingsAccountType.HIGH_YIELD);
    });

    it("should have min_amount_cop of 1", () => {
      const offer = result.offers[0];
      expect(offer.min_amount_cop).toBe(1);
    });

    it("should not have max_amount_cop (unlimited)", () => {
      const offer = result.offers[0];
      expect(offer.max_amount_cop).toBeUndefined();
    });
  });

  describe("common offer properties", () => {
    it("should set bank_name to Pibank", () => {
      expect(result.offers.every((o) => o.bank_name === "Pibank")).toBe(true);
    });

    it("should have valid source metadata", () => {
      for (const offer of result.offers) {
        expect(offer.source.kind).toBe("scrapped");
        const source = offer.source as ScrappedSavingsSource;
        expect(source.source_type).toBe("PDF");
        expect(source.url).toContain("pibank.co");
        expect(source.retrieved_at).toBeTruthy();
        expect(source.extraction.method).toBe("REGEX");
        expect(source.document_label).toBe("Tasas y Tarifario");
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
