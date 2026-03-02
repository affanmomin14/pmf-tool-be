import { z } from 'zod/v4';

// Classification output schema -- validated against GPT-4o structured output
// All fields use .nullable() instead of .optional() for OpenAI strict mode compatibility
export const classificationOutputSchema = z.object({
  // Core classification
  category: z.string(),
  sub_category: z.string(),
  category_confidence: z.enum(['high', 'medium', 'low']),

  // Search queries for research pipeline (Phase 5)
  search_queries: z.array(z.string()).min(3).max(5),

  // Competitor intelligence
  likely_competitors: z.array(z.string()).min(1).max(8),

  // Problem type mapping (maps to ProblemType enum for scoring)
  problem_type: z.enum(['acquisition', 'retention', 'activation', 'monetization', 'positioning', 'unclear']),

  // ICP (Ideal Customer Profile) extraction
  icp_specificity: z.number().int().min(1).max(5),
  icp_extracted: z.object({
    industry: z.nullable(z.string()),
    company_size: z.nullable(z.string()),
    stage: z.nullable(z.string()),
    role: z.nullable(z.string()),
    geography: z.nullable(z.string()),
  }),

  // Product signals for downstream scoring (Phase 6)
  product_signals: z.object({
    pricing_model: z.nullable(z.string()),
    traction_level: z.enum(['none', 'early', 'growing', 'established']),
    maturity_stage: z.enum(['idea', 'mvp', 'beta', 'launched', 'scaling']),
  }),

  // Chain-of-thought reasoning (for debugging, not stored in schema)
  reasoning: z.string(),
});

export type ClassificationOutput = z.infer<typeof classificationOutputSchema>;

// Generate JSON schema for OpenAI API response_format
// Uses Zod v4 native z.toJSONSchema() -- NOT the broken zodResponseFormat helper
const jsonSchema = z.toJSONSchema(classificationOutputSchema, {
  target: 'draft-2020-12',
});

// Build the response_format object for the OpenAI API call
export const classificationResponseFormat = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'classification_output',
    strict: true,
    schema: jsonSchema,
  },
};
