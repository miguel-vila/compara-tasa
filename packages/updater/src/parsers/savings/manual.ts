import { readFile, readdir } from "fs/promises";
import { join } from "path";
import {
  BankId,
  BankNames,
  SavingsAccountType,
  type SavingsOffer,
  type BankSavingsParseResult,
  type ManualSavingsSource,
} from "@compara-tasa/core";
import { sha256, generateSavingsOfferId } from "../../utils/index.js";
import type { BankSavingsParser } from "./types.js";

/**
 * Type for a single manual offer entry in the JSON file
 */
type ManualOfferEntry = {
  account_name: string;
  account_type: SavingsAccountType;
  ea_percent: number;
  min_amount_cop?: number;
  max_amount_cop?: number;
  observed_date: string;
  reporter_note?: string;
  reference_url?: string;
};

/**
 * Type for a manual bank rates file
 */
type ManualBankFile = {
  bank_id: string;
  offers: ManualOfferEntry[];
};

/**
 * Validates a manual bank file structure
 */
function validateManualBankFile(data: unknown, filePath: string): ManualBankFile {
  if (!data || typeof data !== "object") {
    throw new Error(`Invalid manual file: ${filePath} - expected object`);
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.bank_id !== "string") {
    throw new Error(`Invalid manual file: ${filePath} - bank_id must be a string`);
  }

  if (!Array.isArray(obj.offers) || obj.offers.length === 0) {
    throw new Error(`Invalid manual file: ${filePath} - offers must be a non-empty array`);
  }

  for (let i = 0; i < obj.offers.length; i++) {
    const offer = obj.offers[i] as Record<string, unknown>;

    if (typeof offer.account_name !== "string") {
      throw new Error(
        `Invalid manual file: ${filePath} - offers[${i}].account_name must be a string`
      );
    }

    if (!["standard", "high_yield", "digital"].includes(offer.account_type as string)) {
      throw new Error(
        `Invalid manual file: ${filePath} - offers[${i}].account_type must be standard, high_yield, or digital`
      );
    }

    if (typeof offer.ea_percent !== "number" || offer.ea_percent <= 0 || offer.ea_percent > 30) {
      throw new Error(
        `Invalid manual file: ${filePath} - offers[${i}].ea_percent must be a number between 0 and 30`
      );
    }

    if (
      typeof offer.observed_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(offer.observed_date)
    ) {
      throw new Error(
        `Invalid manual file: ${filePath} - offers[${i}].observed_date must be YYYY-MM-DD format`
      );
    }
  }

  return data as ManualBankFile;
}

/**
 * Parser for manually reported savings account rates.
 *
 * This parser reads JSON files from the `manual/` directory. Each file should be named
 * `{bank_id}.json` and contain self-reported rate data.
 *
 * Example file structure (manual/nu.json):
 * ```json
 * {
 *   "bank_id": "nu",
 *   "offers": [{
 *     "account_name": "Cajitas",
 *     "account_type": "high_yield",
 *     "ea_percent": 11.5,
 *     "observed_date": "2026-02-08",
 *     "reporter_note": "Checked in Nu app"
 *   }]
 * }
 * ```
 */
export class ManualParser implements BankSavingsParser {
  bankId: BankId;
  sourceUrl = "manual://self-reported";

  constructor(
    bankId: BankId,
    private filePath: string
  ) {
    this.bankId = bankId;
  }

  async parse(): Promise<BankSavingsParseResult> {
    const warnings: string[] = [];
    const offers: SavingsOffer[] = [];
    const retrievedAt = new Date().toISOString();

    // Read and parse the JSON file
    const fileContent = await readFile(this.filePath, "utf-8");
    const rawTextHash = sha256(fileContent);

    const parsed = JSON.parse(fileContent);
    const data = validateManualBankFile(parsed, this.filePath);

    // Validate bank_id matches
    if (data.bank_id !== this.bankId) {
      throw new Error(
        `Bank ID mismatch: file claims "${data.bank_id}" but expected "${this.bankId}"`
      );
    }

    // Create offers from the manual entries
    for (const entry of data.offers) {
      const source: ManualSavingsSource = {
        kind: "manual",
        retrieved_at: retrievedAt,
        observed_date: entry.observed_date,
        reporter_note: entry.reporter_note,
        reference_url: entry.reference_url,
      };

      const offer: SavingsOffer = {
        id: generateSavingsOfferId({
          bank_id: this.bankId,
          account_type: entry.account_type,
          account_name: entry.account_name,
          ea_percent: entry.ea_percent,
          min_amount_cop: entry.min_amount_cop ?? 1,
        }),
        bank_id: this.bankId,
        bank_name: BankNames[this.bankId] ?? this.bankId,
        account_type: entry.account_type,
        account_name: entry.account_name,
        rate: { ea_percent: entry.ea_percent },
        min_amount_cop: entry.min_amount_cop ?? 1,
        max_amount_cop: entry.max_amount_cop,
        source,
      };

      offers.push(offer);
    }

    return {
      bank_id: this.bankId,
      offers,
      warnings,
      raw_text_hash: rawTextHash,
    };
  }
}

/**
 * Discovers all manual JSON files in the given directory and creates parsers for them.
 * Each file should be named `{bank_id}.json`.
 */
export async function createManualParsers(manualDir: string): Promise<ManualParser[]> {
  const parsers: ManualParser[] = [];

  try {
    const files = await readdir(manualDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const bankId = file.replace(".json", "") as BankId;
      const filePath = join(manualDir, file);

      parsers.push(new ManualParser(bankId, filePath));
    }
  } catch (error) {
    // Directory doesn't exist or can't be read - that's fine, just return empty
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return parsers;
}
