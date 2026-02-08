import type { BankId, BankSavingsParseResult } from "@compara-tasa/core";

/**
 * Interface for bank-specific savings account parsers
 */
export interface BankSavingsParser {
  bankId: BankId;
  sourceUrl: string;

  /**
   * Fetches and parses savings offers from the bank's rate disclosure
   */
  parse(): Promise<BankSavingsParseResult>;
}

/**
 * Parser configuration
 */
export type SavingsParserConfig = {
  fixturesPath?: string; // Path to fixtures for testing
  useFixtures?: boolean; // Use fixtures instead of live fetch
};
