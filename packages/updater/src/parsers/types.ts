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
 * Parser configuration
 */
export type ParserConfig = {
  fixturesPath?: string; // Path to fixtures for testing
  useFixtures?: boolean; // Use fixtures instead of live fetch
};
