"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classificationResponseFormat = exports.classificationOutputSchema = void 0;
const v4_1 = require("zod/v4");
// Classification output schema -- validated against GPT-4o structured output
// All fields use .nullable() instead of .optional() for OpenAI strict mode compatibility
exports.classificationOutputSchema = v4_1.z.object({
    // Core classification
    category: v4_1.z.string(),
    sub_category: v4_1.z.string(),
    category_confidence: v4_1.z.enum(['high', 'medium', 'low']),
    // Search queries for research pipeline (Phase 5)
    search_queries: v4_1.z.array(v4_1.z.string()).min(3).max(5),
    // Competitor intelligence
    likely_competitors: v4_1.z.array(v4_1.z.string()).min(1).max(8),
    // Problem type mapping (maps to ProblemType enum for scoring)
    problem_type: v4_1.z.enum(['acquisition', 'retention', 'activation', 'monetization', 'positioning', 'unclear']),
    // ICP (Ideal Customer Profile) extraction
    icp_specificity: v4_1.z.number().int().min(1).max(5),
    icp_extracted: v4_1.z.object({
        industry: v4_1.z.nullable(v4_1.z.string()),
        company_size: v4_1.z.nullable(v4_1.z.string()),
        stage: v4_1.z.nullable(v4_1.z.string()),
        role: v4_1.z.nullable(v4_1.z.string()),
        geography: v4_1.z.nullable(v4_1.z.string()),
    }),
    // Product signals for downstream scoring (Phase 6)
    product_signals: v4_1.z.object({
        pricing_model: v4_1.z.nullable(v4_1.z.string()),
        traction_level: v4_1.z.enum(['none', 'early', 'growing', 'established']),
        maturity_stage: v4_1.z.enum(['idea', 'mvp', 'beta', 'launched', 'scaling']),
    }),
    // Business model classification
    business_model: v4_1.z.enum(['b2b_saas', 'marketplace', 'agency', 'consumer', 'hardware', 'other']),
    // Traction metrics parsed from Q5 (all nullable -- only extract if explicitly stated)
    traction_metrics: v4_1.z.object({
        mrr: v4_1.z.nullable(v4_1.z.number()), // Monthly recurring revenue in dollars
        arr: v4_1.z.nullable(v4_1.z.number()), // Annual recurring revenue in dollars
        user_count: v4_1.z.nullable(v4_1.z.number()), // Active users/customers/teams
        growth_rate: v4_1.z.nullable(v4_1.z.number()), // Monthly growth percentage
        months_active: v4_1.z.nullable(v4_1.z.number()), // How long the product has been live
    }),
    // Chain-of-thought reasoning (for debugging, not stored in schema)
    reasoning: v4_1.z.string(),
});
// Generate JSON schema for OpenAI API response_format
// Uses Zod v4 native z.toJSONSchema() -- NOT the broken zodResponseFormat helper
const jsonSchema = v4_1.z.toJSONSchema(exports.classificationOutputSchema, {
    target: 'draft-2020-12',
});
// Build the response_format object for the OpenAI API call
exports.classificationResponseFormat = {
    type: 'json_schema',
    json_schema: {
        name: 'classification_output',
        strict: true,
        schema: jsonSchema,
    },
};
