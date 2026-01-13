import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  OffersDatasetSchema,
  RankingsSchema,
  type Offer,
  type OffersDataset,
  type Rankings,
} from "@compara-tasa/core";
import { createAllParsers } from "./parsers/index.js";
import { computeRankings } from "./rankings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../../apps/web/public/data");

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

async function main(): Promise<void> {
  console.log("Starting rate update...\n");

  const parsers = createAllParsers();
  const allOffers: Offer[] = [];
  const allErrors: string[] = [];

  for (const parser of parsers) {
    console.log(`Parsing ${parser.bankId}...`);
    try {
      const result = await parser.parse();
      allOffers.push(...result.offers);

      for (const warning of result.warnings) {
        console.warn(`  ⚠️  ${warning}`);
      }

      console.log(`  ✓ Found ${result.offers.length} offers`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Failed: ${message}`);
      allErrors.push(`[${parser.bankId}] Parse failed: ${message}`);
    }
  }

  console.log(`\nTotal offers: ${allOffers.length}`);
  console.log(`Total errors: ${allErrors.length}`);

  if (allErrors.length > 0) {
    console.error("\n--- Errors ---");
    for (const error of allErrors) {
      console.error(`  ${error}`);
    }
    process.exit(1);
  }

  // Build dataset
  const now = new Date().toISOString();
  const dataset: OffersDataset = {
    generated_at: now,
    offers: allOffers,
  };

  // Validate dataset
  const datasetResult = OffersDatasetSchema.safeParse(dataset);
  if (!datasetResult.success) {
    console.error("Dataset validation failed:", datasetResult.error);
    process.exit(1);
  }

  // Compute rankings
  const rankings: Rankings = computeRankings(allOffers);

  // Validate rankings
  const rankingsResult = RankingsSchema.safeParse(rankings);
  if (!rankingsResult.success) {
    console.error("Rankings validation failed:", rankingsResult.error);
    process.exit(1);
  }

  // Write outputs
  await ensureDir(DATA_DIR);

  const offersLatestPath = join(DATA_DIR, "offers-latest.json");
  const rankingsLatestPath = join(DATA_DIR, "rankings-latest.json");

  await Promise.all([
    writeJson(offersLatestPath, dataset),
    writeJson(rankingsLatestPath, rankings),
  ]);

  console.log(`\nOutputs written to ${DATA_DIR}:`);
  console.log(`  - offers-latest.json`);
  console.log(`  - rankings-latest.json`);

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Offers by bank:`);
  const byBank = allOffers.reduce(
    (acc, o) => {
      acc[o.bank_id] = (acc[o.bank_id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  for (const [bank, count] of Object.entries(byBank)) {
    console.log(`  ${bank}: ${count}`);
  }

  console.log(`\nRankings computed:`);
  for (const [scenario, ranking] of Object.entries(rankings.scenarios)) {
    if (ranking) {
      console.log(`  ${scenario}: ${ranking.metric.value} (${ranking.offer_id})`);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
