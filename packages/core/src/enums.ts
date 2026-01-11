// Bank identifiers for scrapeable banks (MVP)
export const BankId = {
  BANCOLOMBIA: "bancolombia",
  BBVA: "bbva",
  SCOTIABANK_COLPATRIA: "scotiabank_colpatria",
  BANCO_CAJA_SOCIAL: "banco_caja_social",
  AVVILLAS: "avvillas",
  ITAU: "itau",
  FNA: "fna",
  BANCO_POPULAR: "banco_popular",
  BANCO_DE_BOGOTA: "banco_de_bogota",
} as const;

export type BankId = (typeof BankId)[keyof typeof BankId];

// Human-readable bank names
export const BankNames: Record<BankId, string> = {
  bancolombia: "Bancolombia",
  bbva: "BBVA Colombia",
  scotiabank_colpatria: "Scotiabank Colpatria",
  banco_caja_social: "Banco Caja Social",
  avvillas: "Banco AV Villas",
  itau: "Banco Itaú Colombia",
  fna: "Fondo Nacional del Ahorro",
  banco_popular: "Banco Popular",
  banco_de_bogota: "Banco de Bogotá",
};

// Product types
export const ProductType = {
  HIPOTECARIO: "hipotecario",
  LEASING: "leasing",
} as const;

export type ProductType = (typeof ProductType)[keyof typeof ProductType];

// Currency/index type
export const CurrencyIndex = {
  COP: "COP", // Colombian Pesos - fixed rate
  UVR: "UVR", // Unidad de Valor Real - inflation-indexed
} as const;

export type CurrencyIndex = (typeof CurrencyIndex)[keyof typeof CurrencyIndex];

// Housing segment
export const Segment = {
  VIS: "VIS", // Vivienda de Interés Social (up to 150 SMLV)
  NO_VIS: "NO_VIS", // Non-VIS (higher value properties)
  UNKNOWN: "UNKNOWN",
} as const;

export type Segment = (typeof Segment)[keyof typeof Segment];

// Distribution channel
export const Channel = {
  DIGITAL: "DIGITAL",
  BRANCH: "BRANCH",
  UNSPECIFIED: "UNSPECIFIED",
} as const;

export type Channel = (typeof Channel)[keyof typeof Channel];

// Source document type
export const SourceType = {
  HTML: "HTML",
  PDF: "PDF",
} as const;

export type SourceType = (typeof SourceType)[keyof typeof SourceType];

// Extraction method
export const ExtractionMethod = {
  CSS_SELECTOR: "CSS_SELECTOR",
  REGEX: "REGEX",
} as const;

export type ExtractionMethod = (typeof ExtractionMethod)[keyof typeof ExtractionMethod];

// Scenario keys for rankings
export const ScenarioKey = {
  BEST_UVR_VIS_HIPOTECARIO: "best_uvr_vis_hipotecario",
  BEST_UVR_NO_VIS_HIPOTECARIO: "best_uvr_no_vis_hipotecario",
  BEST_COP_VIS_HIPOTECARIO: "best_cop_vis_hipotecario",
  BEST_COP_NO_VIS_HIPOTECARIO: "best_cop_no_vis_hipotecario",
  BEST_PAYROLL_BENEFIT: "best_payroll_benefit",
  BEST_DIGITAL_HIPOTECARIO: "best_digital_hipotecario",
} as const;

export type ScenarioKey = (typeof ScenarioKey)[keyof typeof ScenarioKey];
