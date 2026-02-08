export type { BankSavingsParser, SavingsParserConfig } from "./types.js";
export { Ban100Parser } from "./ban100.js";
export { BbvaSavingsParser } from "./bbva.js";
export { LuloParser } from "./lulo.js";
export { RappiPayParser } from "./rappipay.js";

import { Ban100Parser } from "./ban100.js";
import { BbvaSavingsParser } from "./bbva.js";
import { LuloParser } from "./lulo.js";
import { RappiPayParser } from "./rappipay.js";
import type { BankSavingsParser, SavingsParserConfig } from "./types.js";

/**
 * Creates all bank savings parsers with the given configuration
 */
export function createAllSavingsParsers(config: SavingsParserConfig = {}): BankSavingsParser[] {
  return [
    new Ban100Parser(config),
    new BbvaSavingsParser(config),
    new LuloParser(config),
    new RappiPayParser(config),
  ];
}
