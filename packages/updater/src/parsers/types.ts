import type { BankId, BankMortgageParseResult } from "@compara-tasa/core";

/**
 * Interface for bank-specific mortgage parsers
 */
export interface BankMortgageParser {
  bankId: BankId;
  sourceUrl: string;

  /**
   * Fetches and parses mortgage offers from the bank's rate disclosure
   */
  parse(): Promise<BankMortgageParseResult>;
}

/**
 * Mortgage parser configuration
 */
export type MortgageParserConfig = {
  fixturesPath?: string; // Path to fixtures for testing
  useFixtures?: boolean; // Use fixtures instead of live fetch
};
