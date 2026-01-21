import { z } from "zod";
import {
  BankId,
  MortgageType,
  CurrencyIndex,
  Segment,
  Channel,
  SourceType,
  ExtractionMethod,
  MortgageScenarioKey,
} from "./enums.js";

// Enum schemas - derived automatically from const objects using z.nativeEnum()
export const BankIdSchema = z.nativeEnum(BankId);
export const MortgageTypeSchema = z.nativeEnum(MortgageType);
export const CurrencyIndexSchema = z.nativeEnum(CurrencyIndex);
export const SegmentSchema = z.nativeEnum(Segment);
export const ChannelSchema = z.nativeEnum(Channel);
export const SourceTypeSchema = z.nativeEnum(SourceType);
export const ExtractionMethodSchema = z.nativeEnum(ExtractionMethod);
export const MortgageScenarioKeySchema = z.nativeEnum(MortgageScenarioKey);

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

// Main MortgageOffer schema
export const MortgageOfferSchema = z.object({
  id: z.string(),
  bank_id: BankIdSchema,
  bank_name: z.string(),
  product_type: MortgageTypeSchema,
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

// Ranked entry schema (position 1, 2, or 3)
export const RankedEntrySchema = z.object({
  position: z.number().int().min(1).max(3),
  offer_id: z.string(),
  metric: RankingMetricSchema,
});

// Scenario ranking schema - array of top ranked entries
export const ScenarioRankingSchema = z.array(RankedEntrySchema).max(3);

// Rankings schema
export const RankingsSchema = z.object({
  generated_at: z.string().datetime(),
  mortgageScenarios: z.record(MortgageScenarioKeySchema, ScenarioRankingSchema.optional()),
});

// Mortgage dataset schema
export const MortgageOffersDatasetSchema = z.object({
  generated_at: z.string().datetime(),
  offers: z.array(MortgageOfferSchema),
});

// Bank mortgage parse result schema
export const BankMortgageParseResultSchema = z.object({
  bank_id: BankIdSchema,
  offers: z.array(MortgageOfferSchema),
  warnings: z.array(z.string()),
  raw_text_hash: z.string(),
});
