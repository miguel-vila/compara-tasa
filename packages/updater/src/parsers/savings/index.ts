export type { BankSavingsParser, SavingsParserConfig } from "./types.js";
export { AvvillasParser } from "./avvillas.js";
export { Ban100Parser } from "./ban100.js";
export { BancamiaParser } from "./bancamia.js";
export { BancoPopularParser } from "./banco_popular.js";
export { BbvaSavingsParser } from "./bbva.js";
export { CajaSocialParser } from "./caja_social.js";
export { LuloParser } from "./lulo.js";
export { ManualParser, createManualParsers } from "./manual.js";
export { PibankParser } from "./pibank.js";
export { RappiPayParser } from "./rappipay.js";

import { AvvillasParser } from "./avvillas.js";
import { Ban100Parser } from "./ban100.js";
import { BancamiaParser } from "./bancamia.js";
import { BancoPopularParser } from "./banco_popular.js";
import { BbvaSavingsParser } from "./bbva.js";
import { CajaSocialParser } from "./caja_social.js";
import { LuloParser } from "./lulo.js";
import { PibankParser } from "./pibank.js";
import { RappiPayParser } from "./rappipay.js";
import type { BankSavingsParser, SavingsParserConfig } from "./types.js";

/**
 * Creates all bank savings parsers with the given configuration
 */
export function createAllSavingsParsers(config: SavingsParserConfig = {}): BankSavingsParser[] {
  return [
    new AvvillasParser(config),
    new Ban100Parser(config),
    new BancamiaParser(config),
    new BancoPopularParser(config),
    new BbvaSavingsParser(config),
    new CajaSocialParser(config),
    new LuloParser(config),
    new PibankParser(config),
    new RappiPayParser(config),
  ];
}
