import { z } from 'zod/v4';

// ============================================================================
// Shared interfaces consumed by report service
// ============================================================================

export interface ScoringInput {
  dimensions: Array<{ dimension: string; score: number; label: string; weight: number }>;
  pmfScore: number;
  pmfStage: 'pre_pmf' | 'approaching' | 'early_pmf' | 'strong';
  primaryBreak: string;
  benchmark: number;
}

export interface FounderAnswers {
  q1_product: string;
  q2_icp: string;
  q3_distribution: string;
  q4_stuck: string;
  q5_traction: string;
}

// ============================================================================
// 9-section report output schema
// All fields use .nullable() instead of .optional() for OpenAI strict mode compatibility
// ============================================================================

const headerSchema = z.object({
  companyName: z.string(),
  category: z.string(),
  subCategory: z.string(),
  assessmentDate: z.string(),
  pmfScore: z.number().int().min(0).max(100),
  pmfStage: z.enum(['pre_pmf', 'approaching', 'early_pmf', 'strong']),
  verdict: z.string(),
});

const realityCheckSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()).min(1).max(3),
  concerns: z.array(z.string()).min(1).max(3),
});

const scorecardItemSchema = z.object({
  dimension: z.string(),
  score: z.number().int().min(1).max(10),
  label: z.enum(['critical', 'weak', 'moderate', 'solid', 'strong']),
  insight: z.string(),
});

const marketSchema = z.object({
  tam: z.nullable(z.string()),
  sam: z.nullable(z.string()),
  growthRate: z.nullable(z.string()),
  positioning: z.string(),
  opportunity: z.string(),
});

const salesModelSchema = z.object({
  current: z.string(),
  recommended: z.string(),
  reasoning: z.string(),
});

const competitorItemSchema = z.object({
  name: z.string(),
  comparison: z.string(),
  threatLevel: z.enum(['low', 'medium', 'high']),
});

const positioningSchema = z.object({
  current: z.string(),
  recommended: z.string(),
  gap: z.string(),
});

const bottomLineSchema = z.object({
  summary: z.string(),
  primaryBreak: z.string(),
  nextSteps: z.array(z.string()).min(1).max(3),
});

const recommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  timeframe: z.string(),
});

// ============================================================================
// Full report output schema -- 9 sections + sources
// ============================================================================

export const reportOutputSchema = z.object({
  header: headerSchema,
  reality_check: realityCheckSchema,
  scorecard: z.array(scorecardItemSchema).length(7),
  market: marketSchema,
  sales_model: salesModelSchema,
  competitors: z.array(competitorItemSchema),
  positioning: positioningSchema,
  bottom_line: bottomLineSchema,
  recommendations: z.array(recommendationSchema).length(5),
  sources: z.array(z.string()),
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
