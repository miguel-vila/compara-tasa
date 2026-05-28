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
  SavingsAccountType,
  SavingsScenarioKey,
  SavingsBalanceTier,
  SavingsBankType,
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
export const SavingsAccountTypeSchema = z.nativeEnum(SavingsAccountType);

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

// Single offer reference inside a ranked group.
export const RankedEntrySchema = z.object({
  offer_id: z.string(),
});

// A position in the ranking. Multiple entries indicate a tie.
export const RankedGroupSchema = z.object({
  position: z.number().int().min(1).max(3),
  metric: RankingMetricSchema,
  entries: z.array(RankedEntrySchema).min(1),
});

// Scenario ranking schema - array of position groups (top 3 distinct rates)
export const ScenarioRankingSchema = z.array(RankedGroupSchema).max(3);

// Mortgage rankings schema
export const MortgageRankingsSchema = z.object({
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

// ============================================
// Savings Account Schemas
// ============================================

// Savings rate schema (with sanity check: 0-30% range)
export const SavingsRateSchema = z.object({
  ea_percent: z.number().positive().max(30, "Rate seems too high - possible typo"),
});

// ============================================
// Savings Source Schemas (discriminated union)
// ============================================

// For automated scraping (HTML/PDF)
export const ScrappedSavingsSourceSchema = z.object({
  kind: z.literal("scrapped"),
  retrieved_at: z.string().datetime(),
  url: z.string().url(),
  source_type: z.enum(["HTML", "PDF"]),
  document_label: z.string().optional(),
  valid_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  extracted_text_fingerprint: z.string().optional(),
  extraction: ExtractionInfoSchema,
});

// For manual/self-reported entries
export const ManualSavingsSourceSchema = z.object({
  kind: z.literal("manual"),
  retrieved_at: z.string().datetime(),
  observed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reporter_note: z.string().optional(),
  reference_url: z.string().url().optional(),
});

export const SavingsSourceSchema = z.discriminatedUnion("kind", [
  ScrappedSavingsSourceSchema,
  ManualSavingsSourceSchema,
]);

// Savings offer schema
export const SavingsOfferSchema = z.object({
  id: z.string(),
  bank_id: BankIdSchema,
  bank_name: z.string(),
  account_type: SavingsAccountTypeSchema,
  account_name: z.string(),
  rate: SavingsRateSchema,
  min_amount_cop: z.number().nonnegative().optional(),
  max_amount_cop: z.number().positive().optional(),
  source: SavingsSourceSchema,
});

// Savings dataset schema
export const SavingsOffersDatasetSchema = z.object({
  generated_at: z.string().datetime(),
  offers: z.array(SavingsOfferSchema),
});

// Bank savings parse result schema
export const BankSavingsParseResultSchema = z.object({
  bank_id: BankIdSchema,
  offers: z.array(SavingsOfferSchema),
  warnings: z.array(z.string()),
  raw_text_hash: z.string(),
});

// ============================================
// Savings Rankings Schemas
// ============================================

// New enum schemas for savings segmentation
export const SavingsScenarioKeySchema = z.nativeEnum(SavingsScenarioKey);
export const SavingsBalanceTierSchema = z.nativeEnum(SavingsBalanceTier);
export const SavingsBankTypeSchema = z.nativeEnum(SavingsBankType);

// Savings ranking metric schema (always E.A. percent - higher is better)
export const SavingsRankingMetricSchema = z.object({
  kind: z.literal("EA_PERCENT"),
  value: z.number(),
});

// Savings ranked entry schema (single offer reference inside a group)
export const SavingsRankedEntrySchema = z.object({
  offer_id: z.string(),
});

// Savings position group — multiple entries indicate a tie.
export const SavingsRankedGroupSchema = z.object({
  position: z.number().int().min(1).max(3),
  metric: SavingsRankingMetricSchema,
  entries: z.array(SavingsRankedEntrySchema).min(1),
});

// Savings scenario ranking schema
export const SavingsScenarioRankingSchema = z.array(SavingsRankedGroupSchema).max(3);

// Savings rankings schema
export const SavingsRankingsSchema = z.object({
  generated_at: z.string().datetime(),
  scenarios: z.record(SavingsScenarioKeySchema, SavingsScenarioRankingSchema.optional()),
});

// ============================================
// Rate History Schemas
// ============================================

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

// Mortgage history change-point schema
export const MortgageHistoryPointSchema = z.object({
  date: IsoDateSchema,
  bank_id: BankIdSchema,
  bank_name: z.string(),
  product_type: MortgageTypeSchema,
  currency_index: CurrencyIndexSchema,
  segment: SegmentSchema,
  channel: ChannelSchema,
  rate: RateSchema,
});

// Mortgage history file schema
export const MortgageRateHistorySchema = z.object({
  generated_at: z.string().datetime(),
  points: z.array(MortgageHistoryPointSchema),
});

// Savings history change-point schema
export const SavingsHistoryPointSchema = z.object({
  date: IsoDateSchema,
  bank_id: BankIdSchema,
  bank_name: z.string(),
  account_type: SavingsAccountTypeSchema,
  account_name: z.string(),
  min_amount_cop: z.number().nonnegative().optional(),
  max_amount_cop: z.number().positive().optional(),
  rate: SavingsRateSchema,
});

// Savings history file schema
export const SavingsRateHistorySchema = z.object({
  generated_at: z.string().datetime(),
  points: z.array(SavingsHistoryPointSchema),
});
