import type { BankId, BankParseResult } from "@compara-tasa/core";

/**
 * Interface for bank-specific parsers
 */
export interface BankParser {
  bankId: BankId;
  sourceUrl: string;

  /**
   * Fetches and parses offers from the bank's rate disclosure
   */
  parse(): Promise<BankParseResult>;
}

/**
 * Parser configuration
 */
export type ParserConfig = {
  fixturesPath?: string; // Path to fixtures for testing
  useFixtures?: boolean; // Use fixtures instead of live fetch
};
