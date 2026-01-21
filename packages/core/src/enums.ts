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
  BANCO_DE_OCCIDENTE: "banco_de_occidente",
  DAVIVIENDA: "davivienda",
  BANCO_AGRARIO: "banco_agrario",
  BANCOOMEVA: "bancoomeva",
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
  banco_de_occidente: "Banco de Occidente",
  davivienda: "Davivienda",
  banco_agrario: "Banco Agrario",
  bancoomeva: "Bancoomeva",
};

// Bank mortgage information URLs
export const BankUrls: Record<BankId, string> = {
  bancolombia:
    "https://www.bancolombia.com/personas/creditos/vivienda/credito-hipotecario-para-comprar-vivienda",
  bbva: "https://www.bbva.com.co/personas/productos/prestamos/vivienda/hipotecario.html",
  scotiabank_colpatria: "https://www.davibank.com/personas/hipotecario",
  banco_caja_social: "https://www.bancocajasocial.com/creditos-de-vivienda/credito-hipotecario/",
  avvillas: "https://www.avvillas.com.co/credito-hipotecario",
  itau: "https://banco.itau.co/web/personas/prestamos/creditos-de-vivienda",
  fna: "https://www.fna.gov.co/vivienda",
  banco_popular:
    "https://www.bancopopular.com.co/wps/portal/bancopopular/inicio/para-ti/financiacion-vivienda",
  banco_de_bogota: "https://www.bancodebogota.com/personas/creditos/vivienda",
  banco_de_occidente:
    "https://www.bancodeoccidente.com.co/wps/portal/banco-de-occidente/bancodeoccidente/para-personas/creditos/vivienda",
  davivienda:
    "https://www.davivienda.com/personas/credito-de-vivienda-inmuebles/credito-hipotecario",
  banco_agrario:
    "https://www.bancoagrario.gov.co/personas/asalariado-independiente-pensionado/credito-hipotecario",
  bancoomeva: "https://vivienda.coomeva.com.co/",
};

// Mortgage product types
export const MortgageType = {
  HIPOTECARIO: "hipotecario",
  LEASING: "leasing",
} as const;

export type MortgageType = (typeof MortgageType)[keyof typeof MortgageType];

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

// Mortgage scenario keys for rankings
export const MortgageScenarioKey = {
  // Base scenarios (without payroll - accessible to all)
  BEST_UVR_VIS_HIPOTECARIO: "best_uvr_vis_hipotecario",
  BEST_UVR_NO_VIS_HIPOTECARIO: "best_uvr_no_vis_hipotecario",
  BEST_COP_VIS_HIPOTECARIO: "best_cop_vis_hipotecario",
  BEST_COP_NO_VIS_HIPOTECARIO: "best_cop_no_vis_hipotecario",
  // Payroll scenarios (requires payroll enrollment)
  BEST_UVR_VIS_PAYROLL: "best_uvr_vis_payroll",
  BEST_UVR_NO_VIS_PAYROLL: "best_uvr_no_vis_payroll",
  BEST_COP_VIS_PAYROLL: "best_cop_vis_payroll",
  BEST_COP_NO_VIS_PAYROLL: "best_cop_no_vis_payroll",
  // Other scenarios
  BEST_DIGITAL_HIPOTECARIO: "best_digital_hipotecario",
} as const;

export type MortgageScenarioKey = (typeof MortgageScenarioKey)[keyof typeof MortgageScenarioKey];
