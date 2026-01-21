import { readFile } from "fs/promises";
import { join } from "path";
import {
  MortgageOffersDatasetSchema,
  RankingsSchema,
  type MortgageOffersDataset,
  type Rankings,
} from "@compara-tasa/core";

// Read from public/data for server components
const DATA_DIR = join(process.cwd(), "public/data");

export async function fetchOffers(): Promise<MortgageOffersDataset> {
  try {
    const filePath = join(DATA_DIR, "offers-latest.json");
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    return MortgageOffersDatasetSchema.parse(data);
  } catch (error) {
    console.error("Error fetching offers:", error);
    return {
      generated_at: new Date().toISOString(),
      offers: [],
    };
  }
}

export async function fetchRankings(): Promise<Rankings> {
  try {
    const filePath = join(DATA_DIR, "rankings-latest.json");
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    return RankingsSchema.parse(data);
  } catch (error) {
    console.error("Error fetching rankings:", error);
    return {
      generated_at: new Date().toISOString(),
      mortgageScenarios: {},
    };
  }
}
