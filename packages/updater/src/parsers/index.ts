export type { BankMortgageParser, ParserConfig } from "./types.js";
export { BancolombiaParser } from "./bancolombia.js";
export { BbvaParser } from "./bbva.js";
export { ScotiabankParser } from "./scotiabank.js";
export { CajaSocialParser } from "./caja-social.js";
export { AvvillasParser } from "./avvillas.js";
export { ItauParser } from "./itau.js";
export { FnaParser } from "./fna.js";
export { BancoPopularParser } from "./banco-popular.js";
export { BancoDeBogotaParser } from "./banco-de-bogota.js";
export { BancoDeOccidenteParser } from "./banco-de-occidente.js";
export { DaviviendaParser } from "./davivienda.js";
export { BancoAgrarioParser } from "./banco-agrario.js";
export { BancomevaParser } from "./bancoomeva.js";

import { BancolombiaParser } from "./bancolombia.js";
import { BbvaParser } from "./bbva.js";
import { ScotiabankParser } from "./scotiabank.js";
import { CajaSocialParser } from "./caja-social.js";
import { AvvillasParser } from "./avvillas.js";
import { ItauParser } from "./itau.js";
import { FnaParser } from "./fna.js";
import { BancoPopularParser } from "./banco-popular.js";
import { BancoDeBogotaParser } from "./banco-de-bogota.js";
import { BancoDeOccidenteParser } from "./banco-de-occidente.js";
import { DaviviendaParser } from "./davivienda.js";
import { BancoAgrarioParser } from "./banco-agrario.js";
import { BancomevaParser } from "./bancoomeva.js";
import type { BankMortgageParser, ParserConfig } from "./types.js";

/**
 * Creates all bank mortgage parsers with the given configuration
 */
export function createAllParsers(config: ParserConfig = {}): BankMortgageParser[] {
  return [
    new BancolombiaParser(config),
    new BbvaParser(config),
    new ScotiabankParser(config),
    new CajaSocialParser(config),
    new AvvillasParser(config),
    new ItauParser(config),
    new FnaParser(config),
    new BancoPopularParser(config),
    new BancoDeBogotaParser(config),
    new BancoDeOccidenteParser(config),
    new DaviviendaParser(config),
    new BancoAgrarioParser(config),
    new BancomevaParser(config),
  ];
}
