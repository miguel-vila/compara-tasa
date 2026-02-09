import { readFile } from "fs/promises";
import { join } from "path";
import {
  MortgageOffersDatasetSchema,
  MortgageRankingsSchema,
  SavingsOffersDatasetSchema,
  SavingsRankingsSchema,
  type MortgageOffersDataset,
  type MortgageRankings,
  type SavingsOffersDataset,
  type SavingsRankings,
} from "@compara-tasa/core";

// Read from public/data for server components
const DATA_DIR = join(process.cwd(), "public/data");

export async function fetchMortgageOffers(): Promise<MortgageOffersDataset> {
  try {
    const filePath = join(DATA_DIR, "mortgage-offers-latest.json");
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    return MortgageOffersDatasetSchema.parse(data);
  } catch (error) {
    console.error("Error fetching mortgage offers:", error);
    return {
      generated_at: new Date().toISOString(),
      offers: [],
    };
  }
}

export async function fetchMortgageRankings(): Promise<MortgageRankings> {
  try {
    const filePath = join(DATA_DIR, "mortgage-rankings-latest.json");
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    return MortgageRankingsSchema.parse(data);
  } catch (error) {
    console.error("Error fetching mortgage rankings:", error);
    return {
      generated_at: new Date().toISOString(),
      mortgageScenarios: {},
    };
  }
}

export async function fetchSavingsOffers(): Promise<SavingsOffersDataset> {
  try {
    const filePath = join(DATA_DIR, "savings-offers-latest.json");
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    return SavingsOffersDatasetSchema.parse(data);
  } catch (error) {
    console.error("Error fetching savings offers:", error);
    return {
      generated_at: new Date().toISOString(),
      offers: [],
    };
  }
}

export async function fetchSavingsRankings(): Promise<SavingsRankings> {
  try {
    const filePath = join(DATA_DIR, "savings-rankings-latest.json");
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    return SavingsRankingsSchema.parse(data);
  } catch (error) {
    console.error("Error fetching savings rankings:", error);
    return {
      generated_at: new Date().toISOString(),
      scenarios: {},
    };
  }
}
