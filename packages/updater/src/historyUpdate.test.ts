import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { SavingsOffer } from "@compara-tasa/core";
import { SavingsAccountType, BankId, SavingsRateHistorySchema } from "@compara-tasa/core";
import { appendSavingsHistory } from "./historyUpdate.js";

function offer(rate: number, name = "Cajitas", min?: number): SavingsOffer {
  return {
    id: `${name}-${rate}`,
    bank_id: BankId.NU,
    bank_name: "Nu Colombia",
    account_type: SavingsAccountType.HIGH_YIELD,
    account_name: name,
    rate: { ea_percent: rate },
    min_amount_cop: min,
    source: {
      kind: "scrapped",
      url: "https://test.com",
      source_type: "HTML",
      retrieved_at: new Date().toISOString(),
      extraction: { method: "REGEX", locator: "test" },
    },
  };
}

async function readPoints(path: string) {
  const parsed = SavingsRateHistorySchema.parse(JSON.parse(await readFile(path, "utf-8")));
  return parsed.points;
}

describe("appendSavingsHistory", () => {
  let dir: string;
  let path: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "history-"));
    path = join(dir, "savings-history.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("seeds a point for a brand-new series", async () => {
    const res = await appendSavingsHistory(path, [offer(8.75)], "2026-05-01T09:00:00.000Z");
    expect(res).toEqual({ added: 1, updated: 0, unchanged: 0 });
    const points = await readPoints(path);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ date: "2026-05-01", rate: { ea_percent: 8.75 } });
  });

  it("is idempotent: re-running a different day with the same rate adds nothing", async () => {
    await appendSavingsHistory(path, [offer(8.75)], "2026-05-01T09:00:00.000Z");
    const res = await appendSavingsHistory(path, [offer(8.75)], "2026-05-08T09:00:00.000Z");
    expect(res).toEqual({ added: 0, updated: 0, unchanged: 1 });
    expect(await readPoints(path)).toHaveLength(1);
  });

  it("appends a new change-point only when the rate changes", async () => {
    await appendSavingsHistory(path, [offer(8.75)], "2026-05-01T09:00:00.000Z");
    const res = await appendSavingsHistory(path, [offer(9.25)], "2026-05-08T09:00:00.000Z");
    expect(res).toEqual({ added: 1, updated: 0, unchanged: 0 });
    const points = await readPoints(path);
    expect(points.map((p) => p.rate.ea_percent)).toEqual([8.75, 9.25]);
  });

  it("updates in place on a same-day re-run with a corrected rate", async () => {
    await appendSavingsHistory(path, [offer(8.75)], "2026-05-01T09:00:00.000Z");
    const res = await appendSavingsHistory(path, [offer(9.0)], "2026-05-01T18:00:00.000Z");
    expect(res).toEqual({ added: 0, updated: 1, unchanged: 0 });
    const points = await readPoints(path);
    expect(points).toHaveLength(1);
    expect(points[0].rate.ea_percent).toBe(9.0);
  });

  it("tracks distinct tiers of the same account as separate series", async () => {
    const res = await appendSavingsHistory(
      path,
      [offer(8.0, "Cajitas", 1), offer(9.0, "Cajitas", 10_000_000)],
      "2026-05-01T09:00:00.000Z"
    );
    expect(res.added).toBe(2);
    expect(await readPoints(path)).toHaveLength(2);
  });
});
