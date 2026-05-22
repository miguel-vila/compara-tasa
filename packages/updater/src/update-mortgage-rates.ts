import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  MortgageOffersDatasetSchema,
  MortgageRankingsSchema,
  type MortgageOffer,
  type MortgageOffersDataset,
  type MortgageRankings,
} from "@compara-tasa/core";
import { createAllMortgageParsers } from "./parsers/index.js";
import { computeMortgageRankings } from "./rankings.js";

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

  const parsers = createAllMortgageParsers();
  const allOffers: MortgageOffer[] = [];
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

  // Build dataset even if some parsers failed
  const now = new Date().toISOString();
  const dataset: MortgageOffersDataset = {
    generated_at: now,
    offers: allOffers,
  };

  // Validate dataset
  const datasetResult = MortgageOffersDatasetSchema.safeParse(dataset);
  if (!datasetResult.success) {
    console.error("Dataset validation failed:", datasetResult.error);
    process.exit(1);
  }

  // Compute rankings
  const rankings: MortgageRankings = computeMortgageRankings(allOffers);

  // Validate rankings
  const rankingsResult = MortgageRankingsSchema.safeParse(rankings);
  if (!rankingsResult.success) {
    console.error("Rankings validation failed:", rankingsResult.error);
    process.exit(1);
  }

  // Write outputs
  await ensureDir(DATA_DIR);

  const offersLatestPath = join(DATA_DIR, "mortgage-offers-latest.json");
  const rankingsLatestPath = join(DATA_DIR, "mortgage-rankings-latest.json");

  await Promise.all([
    writeJson(offersLatestPath, dataset),
    writeJson(rankingsLatestPath, rankings),
  ]);

  console.log(`\nOutputs written to ${DATA_DIR}:`);
  console.log(`  - mortgage-offers-latest.json`);
  console.log(`  - mortgage-rankings-latest.json`);

  if (allErrors.length > 0) {
    console.error("\n--- Errors ---");
    for (const error of allErrors) {
      console.error(`  ${error}`);
    }
    console.error("\n⚠️  Partial data written due to errors above");
  }

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
  for (const [scenario, ranking] of Object.entries(rankings.mortgageScenarios)) {
    if (ranking && ranking.length > 0) {
      const top = ranking[0];
      const ids = top.entries.map((e) => e.offer_id).join(", ");
      const tieNote = top.entries.length > 1 ? ` (tied x${top.entries.length})` : "";
      console.log(
        `  ${scenario}: ${top.metric.value} [${ids}]${tieNote} [${ranking.length} positions]`
      );
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
