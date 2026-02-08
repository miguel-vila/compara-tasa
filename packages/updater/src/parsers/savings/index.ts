export type { BankSavingsParser, SavingsParserConfig } from "./types.js";
export { Ban100Parser } from "./ban100.js";
export { BancamiaParser } from "./bancamia.js";
export { BbvaSavingsParser } from "./bbva.js";
export { CajaSocialParser } from "./caja_social.js";
export { LuloParser } from "./lulo.js";
export { PibankParser } from "./pibank.js";
export { RappiPayParser } from "./rappipay.js";
export { UalaParser } from "./uala.js";

import { Ban100Parser } from "./ban100.js";
import { BancamiaParser } from "./bancamia.js";
import { BbvaSavingsParser } from "./bbva.js";
import { CajaSocialParser } from "./caja_social.js";
import { LuloParser } from "./lulo.js";
import { PibankParser } from "./pibank.js";
import { RappiPayParser } from "./rappipay.js";
import { UalaParser } from "./uala.js";
import type { BankSavingsParser, SavingsParserConfig } from "./types.js";

/**
 * Creates all bank savings parsers with the given configuration
 */
export function createAllSavingsParsers(config: SavingsParserConfig = {}): BankSavingsParser[] {
  return [
    new Ban100Parser(config),
    new BancamiaParser(config),
    new BbvaSavingsParser(config),
    new CajaSocialParser(config),
    new LuloParser(config),
    new PibankParser(config),
    new RappiPayParser(config),
    new UalaParser(config),
  ];
}
