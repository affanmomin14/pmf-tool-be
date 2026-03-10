"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportResponseFormat = exports.reportOutputSchema = exports.FOUNDER_ANSWER_LABELS = void 0;
const v4_1 = require("zod/v4");
// Labels used when formatting answers for LLM prompts
exports.FOUNDER_ANSWER_LABELS = {
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
const headerSchema = v4_1.z.object({
    product_name: v4_1.z.string(),
    category: v4_1.z.string(),
    pmf_score: v4_1.z.number().int().min(0).max(100),
    benchmark_score: v4_1.z.number().int().min(0).max(100),
    pmf_stage: v4_1.z.enum(['pre_pmf', 'approaching', 'early_pmf', 'strong']),
    primary_break: v4_1.z.string(),
    category_risk: v4_1.z.enum(['low', 'medium', 'high']),
    verdict: v4_1.z.string(),
});
const realityCheckComparisonSchema = v4_1.z.object({
    you_said: v4_1.z.string(),
    research_shows: v4_1.z.string(),
    severity: v4_1.z.enum(['critical', 'warning', 'aligned']),
    question_ref: v4_1.z.enum(['q1', 'q2', 'q3', 'q4', 'q5']),
});
const realityCheckSchema = v4_1.z.object({
    comparisons: v4_1.z.array(realityCheckComparisonSchema).min(3).max(5),
    root_cause: v4_1.z.string(),
});
const scorecardDimensionSchema = v4_1.z.object({
    name: v4_1.z.string(),
    score: v4_1.z.number().int().min(1).max(10),
    benchmark: v4_1.z.number().int().min(1).max(10),
    status: v4_1.z.enum(['critical', 'at_risk', 'on_track', 'strong']),
    evidence: v4_1.z.string(),
    confidence: v4_1.z.enum(['low', 'medium', 'high']),
});
const scorecardSchema = v4_1.z.object({
    dimensions: v4_1.z.array(scorecardDimensionSchema).length(7),
});
const marketSizeSchema = v4_1.z.object({
    value: v4_1.z.string(),
    description: v4_1.z.string(),
});
const marketRegionSchema = v4_1.z.object({
    name: v4_1.z.string(),
    percentage: v4_1.z.number(),
    value: v4_1.z.string(),
    note: v4_1.z.string(),
});
const marketSchema = v4_1.z.object({
    tam: marketSizeSchema,
    sam: marketSizeSchema,
    growth_rate: marketSizeSchema,
    regions: v4_1.z.array(marketRegionSchema).min(1).max(6),
    real_number_analysis: v4_1.z.string(),
});
const salesModelComparisonSchema = v4_1.z.object({
    you_said: v4_1.z.string(),
    research_shows: v4_1.z.string(),
    severity: v4_1.z.string(),
});
const salesModelTableRowSchema = v4_1.z.object({
    model: v4_1.z.string(),
    who_uses: v4_1.z.string(),
    acv_range: v4_1.z.string(),
    conversion: v4_1.z.string(),
    your_fit: v4_1.z.string(),
});
const salesModelOptionSchema = v4_1.z.object({
    title: v4_1.z.string(),
    icon: v4_1.z.string(),
    pros: v4_1.z.array(v4_1.z.string()),
    cons: v4_1.z.array(v4_1.z.string()),
    timeline: v4_1.z.string(),
    best_if: v4_1.z.string(),
});
const salesModelSchema = v4_1.z.object({
    comparison: salesModelComparisonSchema,
    models_table: v4_1.z.array(salesModelTableRowSchema).min(2).max(5),
    diagnosis: v4_1.z.string(),
    options: v4_1.z.array(salesModelOptionSchema).min(2).max(4),
});
const competitorItemSchema = v4_1.z.object({
    name: v4_1.z.string(),
    rating: v4_1.z.number(),
    funding: v4_1.z.string(),
    tier: v4_1.z.enum(['direct', 'incumbent', 'adjacent', 'invisible']),
});
const competitorTierSchema = v4_1.z.object({
    tier_name: v4_1.z.string(),
    companies: v4_1.z.string(),
    why: v4_1.z.string(),
});
const competitorComplaintSchema = v4_1.z.object({
    complaint: v4_1.z.string(),
    percentage: v4_1.z.string(),
    opportunity: v4_1.z.string(),
});
const competitorsSchema = v4_1.z.object({
    competitor_list: v4_1.z.array(competitorItemSchema).min(3).max(8),
    tiers: v4_1.z.array(competitorTierSchema).min(2).max(4),
    complaints: v4_1.z.array(competitorComplaintSchema).min(2).max(5),
});
const positioningSchema = v4_1.z.object({
    current: v4_1.z.object({
        text: v4_1.z.string(),
        critique: v4_1.z.array(v4_1.z.string()).min(1).max(4),
    }),
    recommended: v4_1.z.object({
        text: v4_1.z.string(),
        improvements: v4_1.z.array(v4_1.z.string()).min(1).max(4),
    }),
});
const scoreProgressionSchema = v4_1.z.object({
    label: v4_1.z.string(),
    score: v4_1.z.string(),
    detail: v4_1.z.string(),
});
const bottomLineSchema = v4_1.z.object({
    verdict: v4_1.z.string(),
    verdict_detail: v4_1.z.string(),
    working: v4_1.z.array(v4_1.z.string()).min(1).max(5),
    not_working: v4_1.z.array(v4_1.z.string()).min(1).max(5),
    score_progression: v4_1.z.array(scoreProgressionSchema).min(2).max(4),
    one_thing: v4_1.z.object({
        title: v4_1.z.string(),
        explanation: v4_1.z.string(),
    }),
    research_stats: v4_1.z.array(v4_1.z.object({
        number: v4_1.z.string(),
        label: v4_1.z.string(),
    })).min(2).max(6),
});
const recommendationSchema = v4_1.z.object({
    rank: v4_1.z.number().int().min(1).max(5),
    title: v4_1.z.string(),
    action: v4_1.z.string(),
    evidence: v4_1.z.string(),
    timeline: v4_1.z.string(),
    effort: v4_1.z.enum(['low', 'medium', 'high']),
});
const sourceSchema = v4_1.z.object({
    name: v4_1.z.string(),
    year: v4_1.z.string(),
    used_for: v4_1.z.string(),
    source_url: v4_1.z.nullable(v4_1.z.string()),
});
// ============================================================================
// Full report output schema -- PRD-aligned
// ============================================================================
exports.reportOutputSchema = v4_1.z.object({
    header: headerSchema,
    reality_check: realityCheckSchema,
    scorecard: scorecardSchema,
    market: marketSchema,
    sales_model: salesModelSchema,
    competitors: competitorsSchema,
    positioning: positioningSchema,
    bottom_line: bottomLineSchema,
    recommendations: v4_1.z.array(recommendationSchema).length(5),
    sources: v4_1.z.array(sourceSchema).min(1).max(15),
});
// ============================================================================
// OpenAI response_format -- uses z.toJSONSchema() (Zod v4 native)
// ============================================================================
const jsonSchema = v4_1.z.toJSONSchema(exports.reportOutputSchema, {
    target: 'draft-2020-12',
});
exports.reportResponseFormat = {
    type: 'json_schema',
    json_schema: {
        name: 'report_output',
        strict: true,
        schema: jsonSchema,
    },
};
