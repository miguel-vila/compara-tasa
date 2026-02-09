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
  // Savings-focused banks
  BAN100: "ban100",
  LULO: "lulo",
  RAPPIPAY: "rappipay",
  PIBANK: "pibank",
  UALA: "uala",
  BANCAMIA: "bancamia",
  NU: "nu",
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
  ban100: "Ban100",
  lulo: "Lulo Bank",
  rappipay: "RappiPay",
  pibank: "Pibank",
  uala: "Ualá",
  bancamia: "Bancamía",
  nu: "Nu Colombia",
};

// Bank mortgage information URLs (partial - only for banks with mortgage products)
export const BankMortgageUrls: Partial<Record<BankId, string>> = {
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

// Bank savings account information URLs (partial - only for banks with savings products)
export const BankSavingsUrls: Partial<Record<BankId, string>> = {
  avvillas:
    "https://www.avvillas.com.co/documents/2920580/43165594/TASAS+AHORROS+Y+BOLSILLOS+CON+RENTABILIDAD+INTRANET+(1).pdf/eef5b4a3-dc4b-1f27-ea9d-db3a989ea862",
  ban100: "https://www.ban100.com.co/productos/cuenta-de-ahorro",
  banco_caja_social:
    "https://www.bancocajasocial.com/content/dam/bcs/documentos/informacion-corporativa/tasas-precios-y-comisiones/cuentas-bancarias/Tasas-Cuenta-Alcancia.pdf",
  banco_popular:
    "https://www.bancopopular.com.co/wps/portal/bancopopular/inicio/informacion-interes/tasas",
  bbva: "https://www.bbva.com.co/content/dam/public-web/colombia/documents/personas/cuentas/ahorro/DO-01-Tasas-cuenta-ahorro.pdf",
  lulo: "https://ayuda.lulobank.com/hc/es/articles/28625884138772--Cu%C3%A1les-son-las-caracter%C3%ADsticas-de-los-bolsillos-y-su-rendimiento",
  rappipay: "https://www.rappipay.co/tasas-y-tarifas/",
  pibank: "https://www.pibank.co/uploads/2025/12/Tasas012026.pdf",
  uala: "https://www.uala.com.co/prensa",
  bancamia:
    "https://www.bancamia.com.co/wp-content/uploads/2025/01/TASAS-Y-TARIFAS-AHORRO-DEL-17-DE-ENERO-AL-2-DE-FEBRERO-2025.pdf",
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

// Savings account types
export const SavingsAccountType = {
  STANDARD: "standard", // Traditional savings account
  HIGH_YIELD: "high_yield", // High-interest digital savings
  DIGITAL: "digital", // Digital-only savings account
} as const;

export type SavingsAccountType = (typeof SavingsAccountType)[keyof typeof SavingsAccountType];

// Savings balance tiers for segmentation
export const SavingsBalanceTier = {
  UNDER_10M: "under_10m", // < 10M COP
  FROM_10M_TO_50M: "10m_to_50m", // 10M - 50M COP
  OVER_50M: "over_50m", // > 50M COP
} as const;

export type SavingsBalanceTier = (typeof SavingsBalanceTier)[keyof typeof SavingsBalanceTier];

// Balance tier thresholds in COP
export const SAVINGS_BALANCE_THRESHOLDS = {
  TIER_1_MAX: 10_000_000, // 10M COP
  TIER_2_MAX: 50_000_000, // 50M COP
} as const;

// Bank type classification for savings
export const SavingsBankType = {
  NEOBANK: "neobank", // Digital-only banks (Ban100, Lulo, Ualá, Pibank, RappiPay)
  TRADITIONAL: "traditional", // Traditional banks with digital offerings (BBVA, Caja Social, Bancamía)
} as const;

export type SavingsBankType = (typeof SavingsBankType)[keyof typeof SavingsBankType];

// Map bank IDs to their type
export const BankTypeClassification: Record<string, SavingsBankType> = {
  avvillas: SavingsBankType.TRADITIONAL,
  ban100: SavingsBankType.NEOBANK,
  banco_popular: SavingsBankType.TRADITIONAL,
  lulo: SavingsBankType.NEOBANK,
  rappipay: SavingsBankType.NEOBANK,
  pibank: SavingsBankType.NEOBANK,
  uala: SavingsBankType.NEOBANK,
  bbva: SavingsBankType.TRADITIONAL,
  banco_caja_social: SavingsBankType.TRADITIONAL,
  bancamia: SavingsBankType.TRADITIONAL,
  nu: SavingsBankType.NEOBANK,
};

// Savings scenario keys for rankings
export const SavingsScenarioKey = {
  // By balance tier (best rate accessible at each tier)
  BEST_RATE_UNDER_10M: "best_rate_under_10m",
  BEST_RATE_10M_TO_50M: "best_rate_10m_to_50m",
  BEST_RATE_OVER_50M: "best_rate_over_50m",
  // By bank type
  BEST_NEOBANK: "best_neobank",
  BEST_TRADITIONAL: "best_traditional",
} as const;

export type SavingsScenarioKey = (typeof SavingsScenarioKey)[keyof typeof SavingsScenarioKey];
