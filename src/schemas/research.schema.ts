import { z } from 'zod/v4';

// ============================================================================
// Per-dimension schemas
// ============================================================================

export const competitorSchema = z.object({
  name: z.string(),
  g2Rating: z.nullable(z.number()),
  reviewCount: z.nullable(z.number().int()),
  funding: z.nullable(z.string()),
  pricingModel: z.nullable(z.string()),
  freeTier: z.nullable(z.boolean()),
  tagline: z.nullable(z.string()),
  sourceUrl: z.nullable(z.string()),
});

export const marketDataSchema = z.object({
  tam: z.nullable(z.string()),
  sam: z.nullable(z.string()),
  growthRate: z.nullable(z.string()),
  regions: z.nullable(
    z.array(
      z.object({
        name: z.string(),
        percentage: z.nullable(z.number()),
      }),
    ),
  ),
});

export const complaintSchema = z.object({
  theme: z.string(),
  percentage: z.nullable(z.number()),
  sourceUrl: z.nullable(z.string()),
});

export const patternSchema = z.object({
  topCompanies: z.nullable(
    z.array(
      z.object({
        name: z.string(),
        salesModel: z.nullable(z.string()),
        positioning: z.nullable(z.string()),
        sourceUrl: z.nullable(z.string()),
      }),
    ),
  ),
  gaps: z.nullable(z.array(z.string())),
});

// ============================================================================
// Full research output schema
// ============================================================================

export const researchQualitySchema = z.object({
  overall: z.enum(['rich', 'sufficient', 'thin', 'minimal']),
  competitorCount: z.number().int(),
  hasMarketData: z.boolean(),
  complaintCount: z.number().int(),
});

export type ResearchQuality = z.infer<typeof researchQualitySchema>;

export const researchOutputSchema = z.object({
  competitors: z.array(competitorSchema),
  market: marketDataSchema,
  complaints: z.array(complaintSchema),
  patterns: patternSchema,
  researchQuality: researchQualitySchema,
  metadata: z.object({
    totalDurationMs: z.number(),
    callCount: z.number().int(),
    cachedHit: z.boolean(),
    researchedAt: z.string(),
  }),
});

// ============================================================================
// TypeScript types
// ============================================================================

export type ResearchOutput = z.infer<typeof researchOutputSchema>;
export type Competitor = z.infer<typeof competitorSchema>;
export type MarketData = z.infer<typeof marketDataSchema>;
export type Complaint = z.infer<typeof complaintSchema>;
export type Pattern = z.infer<typeof patternSchema>;

// ============================================================================
// Per-dimension extraction schemas (used with zodTextFormat for parse step)
// ============================================================================

export const competitorExtractionSchema = z.object({
  competitors: z.array(competitorSchema),
});

export const marketExtractionSchema = z.object({
  market: marketDataSchema,
});

export const complaintExtractionSchema = z.object({
  complaints: z.array(complaintSchema),
});

export const patternExtractionSchema = z.object({
  patterns: patternSchema,
});
