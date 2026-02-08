export type { BankSavingsParser, SavingsParserConfig } from "./types.js";
export { Ban100Parser } from "./ban100.js";

import { Ban100Parser } from "./ban100.js";
import type { BankSavingsParser, SavingsParserConfig } from "./types.js";

/**
 * Creates all bank savings parsers with the given configuration
 */
export function createAllSavingsParsers(config: SavingsParserConfig = {}): BankSavingsParser[] {
  return [new Ban100Parser(config)];
}
