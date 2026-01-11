import { z } from "zod";
import {
  BankId,
  ProductType,
  CurrencyIndex,
  Segment,
  Channel,
  SourceType,
  ExtractionMethod,
  ScenarioKey,
} from "./enums.js";

// Enum schemas
export const BankIdSchema = z.enum([
  BankId.BANCOLOMBIA,
  BankId.BBVA,
  BankId.SCOTIABANK_COLPATRIA,
  BankId.BANCO_CAJA_SOCIAL,
  BankId.AVVILLAS,
  BankId.ITAU,
]);

export const ProductTypeSchema = z.enum([ProductType.HIPOTECARIO, ProductType.LEASING]);

export const CurrencyIndexSchema = z.enum([CurrencyIndex.COP, CurrencyIndex.UVR]);

export const SegmentSchema = z.enum([Segment.VIS, Segment.NO_VIS, Segment.UNKNOWN]);

export const ChannelSchema = z.enum([Channel.DIGITAL, Channel.BRANCH, Channel.UNSPECIFIED]);

export const SourceTypeSchema = z.enum([SourceType.HTML, SourceType.PDF]);

export const ExtractionMethodSchema = z.enum([
  ExtractionMethod.CSS_SELECTOR,
  ExtractionMethod.REGEX,
]);

export const ScenarioKeySchema = z.enum([
  ScenarioKey.BEST_UVR_VIS_HIPOTECARIO,
  ScenarioKey.BEST_UVR_NO_VIS_HIPOTECARIO,
  ScenarioKey.BEST_COP_VIS_HIPOTECARIO,
  ScenarioKey.BEST_COP_NO_VIS_HIPOTECARIO,
  ScenarioKey.BEST_PAYROLL_BENEFIT,
  ScenarioKey.BEST_DIGITAL_HIPOTECARIO,
]);

// Rate schemas
export const CopFixedRateSchema = z.object({
  kind: z.literal("COP_FIXED"),
  ea_percent_from: z.number().positive(),
  ea_percent_to: z.number().positive().optional(),
  mv_percent_from: z.number().positive().optional(),
  mv_percent_to: z.number().positive().optional(),
});

export const UvrSpreadRateSchema = z.object({
  kind: z.literal("UVR_SPREAD"),
  spread_ea_from: z.number().nonnegative(),
  spread_ea_to: z.number().nonnegative().optional(),
  spread_mv_from: z.number().nonnegative().optional(),
  spread_mv_to: z.number().nonnegative().optional(),
});

export const RateSchema = z.discriminatedUnion("kind", [CopFixedRateSchema, UvrSpreadRateSchema]);

// Payroll discount schema
export const PayrollDiscountSchema = z.object({
  type: z.enum(["BPS_OFF", "PERCENT_OFF"]),
  value: z.number().positive(),
  applies_to: z.literal("RATE"),
  note: z.string().optional(),
});

// Conditions schema
export const OfferConditionsSchema = z.object({
  payroll_discount: PayrollDiscountSchema.optional(),
  notes: z.array(z.string()).optional(),
});

// Extraction info schema
export const ExtractionInfoSchema = z.object({
  method: ExtractionMethodSchema,
  locator: z.string(),
  excerpt: z.string().optional(),
});

// Source schema
export const OfferSourceSchema = z.object({
  url: z.string().url(),
  source_type: SourceTypeSchema,
  document_label: z.string().optional(),
  valid_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  retrieved_at: z.string().datetime(),
  extracted_text_fingerprint: z.string().optional(),
  extraction: ExtractionInfoSchema,
});

// Main Offer schema
export const OfferSchema = z.object({
  id: z.string(),
  bank_id: BankIdSchema,
  bank_name: z.string(),
  product_type: ProductTypeSchema,
  currency_index: CurrencyIndexSchema,
  segment: SegmentSchema,
  channel: ChannelSchema,
  rate: RateSchema,
  term_months_min: z.number().int().positive().optional(),
  term_months_max: z.number().int().positive().optional(),
  amount_min_cop: z.number().positive().optional(),
  amount_max_cop: z.number().positive().optional(),
  conditions: OfferConditionsSchema,
  source: OfferSourceSchema,
});

// Ranking metric schema
export const RankingMetricSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("EA_PERCENT"), value: z.number() }),
  z.object({ kind: z.literal("UVR_SPREAD_EA"), value: z.number() }),
]);

// Scenario ranking schema
export const ScenarioRankingSchema = z.object({
  offer_id: z.string(),
  metric: RankingMetricSchema,
});

// Rankings schema
export const RankingsSchema = z.object({
  generated_at: z.string().datetime(),
  scenarios: z.record(ScenarioKeySchema, ScenarioRankingSchema.optional()),
});

// Dataset schema
export const OffersDatasetSchema = z.object({
  generated_at: z.string().datetime(),
  offers: z.array(OfferSchema),
});

// Bank parse result schema
export const BankParseResultSchema = z.object({
  bank_id: BankIdSchema,
  offers: z.array(OfferSchema),
  warnings: z.array(z.string()),
  raw_text_hash: z.string(),
});
