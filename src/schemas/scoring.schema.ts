import { z } from 'zod/v4';

// ============================================================================
// Sub-component types
// ============================================================================

export const subScoreSchema = z.object({
  name: z.string(),
  value: z.number().int().min(1).max(10),
  signal: z.string(), // human-readable explanation of what drove this sub-score
});

export type SubScore = z.infer<typeof subScoreSchema>;

export const dimensionResultSchema = z.object({
  score: z.number().int().min(1).max(10),
  subScores: z.array(subScoreSchema),
  confidence: z.enum(['high', 'medium', 'low']),
});

export type DimensionResult = z.infer<typeof dimensionResultSchema>;

// ============================================================================
// Scoring input type (assembled from DB data, passed to all scorers)
// ============================================================================

export const scoringInputSchema = z.object({
  classification: z.object({
    category: z.string(),
    sub_category: z.string(),
    category_confidence: z.enum(['high', 'medium', 'low']),
    problem_type: z.enum(['acquisition', 'retention', 'activation', 'monetization', 'positioning', 'unclear']),
    icp_specificity: z.number().int().min(1).max(5),
    icp_extracted: z.object({
      industry: z.nullable(z.string()),
      company_size: z.nullable(z.string()),
      stage: z.nullable(z.string()),
      role: z.nullable(z.string()),
      geography: z.nullable(z.string()),
    }),
    product_signals: z.object({
      pricing_model: z.nullable(z.string()),
      traction_level: z.enum(['none', 'early', 'growing', 'established']),
      maturity_stage: z.enum(['idea', 'mvp', 'beta', 'launched', 'scaling']),
    }),
    likely_competitors: z.array(z.string()),
  }),
  research: z.object({
    competitors: z.array(z.object({
      name: z.string(),
      g2Rating: z.nullable(z.number()),
      reviewCount: z.nullable(z.number().int()),
      funding: z.nullable(z.string()),
      pricingModel: z.nullable(z.string()),
      freeTier: z.nullable(z.boolean()),
      tagline: z.nullable(z.string()),
    })),
    market: z.object({
      tam: z.nullable(z.string()),
      sam: z.nullable(z.string()),
      growthRate: z.nullable(z.string()),
    }),
    complaints: z.array(z.object({
      theme: z.string(),
      percentage: z.nullable(z.number()),
    })),
    patterns: z.object({
      topCompanies: z.nullable(z.array(z.object({
        name: z.string(),
        salesModel: z.nullable(z.string()),
        positioning: z.nullable(z.string()),
      }))),
      gaps: z.nullable(z.array(z.string())),
    }),
    researchQuality: z.enum(['sufficient', 'limited']),
  }),
  founderAnswers: z.object({
    q1_product: z.string(),
    q2_valueSignal: z.string(),
    q3_distribution: z.string(),
    q4_substitute: z.string(),
    q5_biggestRisk: z.string(),
  }),
});

export type ScoringInput = z.infer<typeof scoringInputSchema>;

// ============================================================================
// Full ScoreData output shape (stored in Assessment.scoreData)
// ============================================================================

const dimensionScoresSchema = z.object({
  demand: dimensionResultSchema,
  icpFocus: dimensionResultSchema,
  differentiation: dimensionResultSchema,
  distributionFit: dimensionResultSchema,
  problemSeverity: dimensionResultSchema,
  competitivePosition: dimensionResultSchema,
  trustAndProof: dimensionResultSchema,
});

export const scoreDataSchema = z.object({
  dimensions: dimensionScoresSchema,
  weights: z.record(z.string(), z.number()),
  rawWeightedSum: z.number(),
  finalScore: z.number().int().min(0).max(100),
  pmfStage: z.enum(['pre_pmf', 'approaching', 'early_pmf', 'strong']),
  primaryBreak: z.string(),
  secondaryBreak: z.string(),
  founderMismatch: z.boolean(),
  founderIdentifiedDimension: z.nullable(z.string()),
  benchmarks: z.record(z.string(), z.number()),
  benchmarkMeta: z.object({
    source: z.enum(['category_subcategory', 'category_only', 'default']),
    sampleSize: z.number().int(),
  }),
  scoredAt: z.string(),
});

export type ScoreData = z.infer<typeof scoreDataSchema>;
export type DimensionScores = z.infer<typeof dimensionScoresSchema>;
