import { z } from 'zod/v4';

// ============================================================================
// Shared interfaces consumed by report service
// ============================================================================

export interface ScoringInput {
  dimensions: Array<{ dimension: string; score: number; label: string; weight: number }>;
  pmfScore: number;
  pmfStage: 'pre_pmf' | 'approaching' | 'early_pmf' | 'strong';
  primaryBreak: string;
  secondaryBreak?: string;
  benchmark: number;
  dimensionBenchmarks: Record<string, number>;
  founderMismatch?: boolean;
  founderIdentifiedDimension?: string | null;
}

export interface FounderAnswers {
  q1_product: string;
  q2_icp: string;
  q3_distribution: string;
  q4_stuck: string;
  q5_traction: string;
}

// Labels used when formatting answers for LLM prompts
export const FOUNDER_ANSWER_LABELS: Record<keyof FounderAnswers, string> = {
  q1_product: 'Product',
  q2_icp: 'Target Customer',
  q3_distribution: 'Distribution',
  q4_stuck: 'Biggest Challenge',
  q5_traction: 'Current Traction',
};

// ============================================================================
// PRD-aligned report output schema
// All fields use .nullable() instead of .optional() for OpenAI strict mode
// ============================================================================

const headerSchema = z.object({
  product_name: z.string(),
  category: z.string(),
  pmf_score: z.number().int().min(0).max(100),
  benchmark_score: z.number().int().min(0).max(100),
  pmf_stage: z.enum(['pre_pmf', 'approaching', 'early_pmf', 'strong']),
  primary_break: z.string(),
  category_risk: z.enum(['low', 'medium', 'high']),
  verdict: z.string(),
});

const realityCheckComparisonSchema = z.object({
  you_said: z.string(),
  research_shows: z.string(),
  severity: z.enum(['critical', 'warning', 'aligned']),
  question_ref: z.enum(['q1', 'q2', 'q3', 'q4', 'q5']),
});

const realityCheckSchema = z.object({
  comparisons: z.array(realityCheckComparisonSchema).min(3).max(5),
  root_cause: z.string(),
});

const scorecardDimensionSchema = z.object({
  name: z.string(),
  score: z.number().int().min(1).max(10),
  benchmark: z.number().int().min(1).max(10),
  status: z.enum(['critical', 'at_risk', 'on_track', 'strong']),
  evidence: z.string(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

const scorecardSchema = z.object({
  dimensions: z.array(scorecardDimensionSchema).length(7),
});

const marketSizeSchema = z.object({
  value: z.string(),
  description: z.string(),
});

const marketRegionSchema = z.object({
  name: z.string(),
  percentage: z.number(),
  value: z.string(),
  note: z.string(),
});

const marketSchema = z.object({
  tam: marketSizeSchema,
  sam: marketSizeSchema,
  growth_rate: marketSizeSchema,
  regions: z.array(marketRegionSchema).min(1).max(6),
  real_number_analysis: z.string(),
});

const salesModelComparisonSchema = z.object({
  you_said: z.string(),
  research_shows: z.string(),
  severity: z.string(),
});

const salesModelTableRowSchema = z.object({
  model: z.string(),
  who_uses: z.string(),
  acv_range: z.string(),
  conversion: z.string(),
  your_fit: z.string(),
});

const salesModelOptionSchema = z.object({
  title: z.string(),
  icon: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  timeline: z.string(),
  best_if: z.string(),
});

const salesModelSchema = z.object({
  comparison: salesModelComparisonSchema,
  models_table: z.array(salesModelTableRowSchema).min(2).max(5),
  diagnosis: z.string(),
  options: z.array(salesModelOptionSchema).min(2).max(4),
});

const competitorItemSchema = z.object({
  name: z.string(),
  rating: z.number(),
  funding: z.string(),
  tier: z.enum(['direct', 'incumbent', 'adjacent', 'invisible']),
});

const competitorTierSchema = z.object({
  tier_name: z.string(),
  companies: z.string(),
  why: z.string(),
});

const competitorComplaintSchema = z.object({
  complaint: z.string(),
  percentage: z.string(),
  opportunity: z.string(),
});

const competitorsSchema = z.object({
  competitor_list: z.array(competitorItemSchema).min(3).max(8),
  tiers: z.array(competitorTierSchema).min(2).max(4),
  complaints: z.array(competitorComplaintSchema).min(2).max(5),
});

const positioningSchema = z.object({
  current: z.object({
    text: z.string(),
    critique: z.array(z.string()).min(1).max(4),
  }),
  recommended: z.object({
    text: z.string(),
    improvements: z.array(z.string()).min(1).max(4),
  }),
});

const scoreProgressionSchema = z.object({
  label: z.string(),
  score: z.string(),
  detail: z.string(),
});

const bottomLineSchema = z.object({
  verdict: z.string(),
  verdict_detail: z.string(),
  working: z.array(z.string()).min(1).max(5),
  not_working: z.array(z.string()).min(1).max(5),
  score_progression: z.array(scoreProgressionSchema).min(2).max(4),
  one_thing: z.object({
    title: z.string(),
    explanation: z.string(),
  }),
  research_stats: z.array(z.object({
    number: z.string(),
    label: z.string(),
  })).min(2).max(6),
});

const recommendationSchema = z.object({
  rank: z.number().int().min(1).max(5),
  title: z.string(),
  action: z.string(),
  evidence: z.string(),
  timeline: z.string(),
  effort: z.enum(['low', 'medium', 'high']),
});

const sourceSchema = z.object({
  name: z.string(),
  year: z.string(),
  used_for: z.string(),
  source_url: z.nullable(z.string()),
});

// ============================================================================
// Full report output schema -- PRD-aligned
// ============================================================================

export const reportOutputSchema = z.object({
  header: headerSchema,
  reality_check: realityCheckSchema,
  scorecard: scorecardSchema,
  market: marketSchema,
  sales_model: salesModelSchema,
  competitors: competitorsSchema,
  positioning: positioningSchema,
  bottom_line: bottomLineSchema,
  recommendations: z.array(recommendationSchema).length(5),
  sources: z.array(sourceSchema).min(1).max(15),
});

export type ReportOutput = z.infer<typeof reportOutputSchema>;

// ============================================================================
// OpenAI response_format -- uses z.toJSONSchema() (Zod v4 native)
// ============================================================================

const jsonSchema = z.toJSONSchema(reportOutputSchema, {
  target: 'draft-2020-12',
});

export const reportResponseFormat = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'report_output',
    strict: true,
    schema: jsonSchema,
  },
};
