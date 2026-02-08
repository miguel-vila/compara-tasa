import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  SavingsOffersDatasetSchema,
  type SavingsOffer,
  type SavingsOffersDataset,
} from "@compara-tasa/core";
import { createAllSavingsParsers } from "./parsers/savings/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../../apps/web/public/data");

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

async function main(): Promise<void> {
  console.log("Starting savings rate update...\n");

  const parsers = createAllSavingsParsers();
  const allOffers: SavingsOffer[] = [];
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

  console.log(`\nTotal savings offers: ${allOffers.length}`);
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
  const dataset: SavingsOffersDataset = {
    generated_at: now,
    offers: allOffers,
  };

  // Validate dataset
  const datasetResult = SavingsOffersDatasetSchema.safeParse(dataset);
  if (!datasetResult.success) {
    console.error("Dataset validation failed:", datasetResult.error);
    process.exit(1);
  }

  // Write outputs
  await ensureDir(DATA_DIR);

  const offersLatestPath = join(DATA_DIR, "savings-offers-latest.json");

  await writeJson(offersLatestPath, dataset);

  console.log(`\nOutputs written to ${DATA_DIR}:`);
  console.log(`  - savings-offers-latest.json`);

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Savings offers by bank:`);
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

  console.log("\nBest rates:");
  const sorted = [...allOffers].sort((a, b) => b.rate.ea_percent - a.rate.ea_percent);
  for (const offer of sorted.slice(0, 5)) {
    console.log(
      `  ${offer.rate.ea_percent.toFixed(2)}% E.A. - ${offer.bank_name} (${offer.account_name})`
    );
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
