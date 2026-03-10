"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreDataSchema = exports.scoringInputSchema = exports.dimensionResultSchema = exports.subScoreSchema = void 0;
const v4_1 = require("zod/v4");
// ============================================================================
// Sub-component types
// ============================================================================
exports.subScoreSchema = v4_1.z.object({
    name: v4_1.z.string(),
    value: v4_1.z.number().int().min(1).max(10),
    signal: v4_1.z.string(), // human-readable explanation of what drove this sub-score
});
exports.dimensionResultSchema = v4_1.z.object({
    score: v4_1.z.number().int().min(1).max(10),
    subScores: v4_1.z.array(exports.subScoreSchema),
    confidence: v4_1.z.enum(['high', 'medium', 'low']),
});
// ============================================================================
// Scoring input type (assembled from DB data, passed to all scorers)
// ============================================================================
exports.scoringInputSchema = v4_1.z.object({
    classification: v4_1.z.object({
        category: v4_1.z.string(),
        sub_category: v4_1.z.string(),
        category_confidence: v4_1.z.enum(['high', 'medium', 'low']),
        problem_type: v4_1.z.enum(['acquisition', 'retention', 'activation', 'monetization', 'positioning', 'unclear']),
        icp_specificity: v4_1.z.number().int().min(1).max(5),
        icp_extracted: v4_1.z.object({
            industry: v4_1.z.nullable(v4_1.z.string()),
            company_size: v4_1.z.nullable(v4_1.z.string()),
            stage: v4_1.z.nullable(v4_1.z.string()),
            role: v4_1.z.nullable(v4_1.z.string()),
            geography: v4_1.z.nullable(v4_1.z.string()),
        }),
        product_signals: v4_1.z.object({
            pricing_model: v4_1.z.nullable(v4_1.z.string()),
            traction_level: v4_1.z.enum(['none', 'early', 'growing', 'established']),
            maturity_stage: v4_1.z.enum(['idea', 'mvp', 'beta', 'launched', 'scaling']),
        }),
        business_model: v4_1.z.enum(['b2b_saas', 'marketplace', 'agency', 'consumer', 'hardware', 'other']),
        traction_metrics: v4_1.z.object({
            mrr: v4_1.z.nullable(v4_1.z.number()),
            arr: v4_1.z.nullable(v4_1.z.number()),
            user_count: v4_1.z.nullable(v4_1.z.number()),
            growth_rate: v4_1.z.nullable(v4_1.z.number()),
            months_active: v4_1.z.nullable(v4_1.z.number()),
        }),
        likely_competitors: v4_1.z.array(v4_1.z.string()),
    }),
    research: v4_1.z.object({
        competitors: v4_1.z.array(v4_1.z.object({
            name: v4_1.z.string(),
            g2Rating: v4_1.z.nullable(v4_1.z.number()),
            reviewCount: v4_1.z.nullable(v4_1.z.number().int()),
            funding: v4_1.z.nullable(v4_1.z.string()),
            pricingModel: v4_1.z.nullable(v4_1.z.string()),
            freeTier: v4_1.z.nullable(v4_1.z.boolean()),
            tagline: v4_1.z.nullable(v4_1.z.string()),
        })),
        market: v4_1.z.object({
            tam: v4_1.z.nullable(v4_1.z.string()),
            sam: v4_1.z.nullable(v4_1.z.string()),
            growthRate: v4_1.z.nullable(v4_1.z.string()),
        }),
        complaints: v4_1.z.array(v4_1.z.object({
            theme: v4_1.z.string(),
            percentage: v4_1.z.nullable(v4_1.z.number()),
        })),
        patterns: v4_1.z.object({
            topCompanies: v4_1.z.nullable(v4_1.z.array(v4_1.z.object({
                name: v4_1.z.string(),
                salesModel: v4_1.z.nullable(v4_1.z.string()),
                positioning: v4_1.z.nullable(v4_1.z.string()),
            }))),
            gaps: v4_1.z.nullable(v4_1.z.array(v4_1.z.string())),
        }),
        researchQuality: v4_1.z.union([
            v4_1.z.enum(['sufficient', 'limited']),
            v4_1.z.object({
                overall: v4_1.z.enum(['rich', 'sufficient', 'thin', 'minimal']),
                competitorCount: v4_1.z.number().int(),
                hasMarketData: v4_1.z.boolean(),
                complaintCount: v4_1.z.number().int(),
            }),
        ]),
    }),
    founderAnswers: v4_1.z.object({
        q1_product: v4_1.z.string(),
        q2_icp: v4_1.z.string(),
        q3_distribution: v4_1.z.string(),
        q4_stuck: v4_1.z.string(),
        q5_traction: v4_1.z.string(),
    }),
});
// ============================================================================
// Full ScoreData output shape (stored in Assessment.scoreData)
// ============================================================================
const dimensionScoresSchema = v4_1.z.object({
    demand: exports.dimensionResultSchema,
    icpFocus: exports.dimensionResultSchema,
    differentiation: exports.dimensionResultSchema,
    distributionFit: exports.dimensionResultSchema,
    problemSeverity: exports.dimensionResultSchema,
    competitivePosition: exports.dimensionResultSchema,
    trustAndProof: exports.dimensionResultSchema,
});
exports.scoreDataSchema = v4_1.z.object({
    dimensions: dimensionScoresSchema,
    weights: v4_1.z.record(v4_1.z.string(), v4_1.z.number()),
    rawWeightedSum: v4_1.z.number(),
    finalScore: v4_1.z.number().int().min(0).max(100),
    pmfStage: v4_1.z.enum(['pre_pmf', 'approaching', 'early_pmf', 'strong']),
    primaryBreak: v4_1.z.string(),
    secondaryBreak: v4_1.z.string(),
    founderMismatch: v4_1.z.boolean(),
    founderIdentifiedDimension: v4_1.z.nullable(v4_1.z.string()),
    benchmarks: v4_1.z.record(v4_1.z.string(), v4_1.z.number()),
    benchmarkMeta: v4_1.z.object({
        source: v4_1.z.enum(['category_subcategory', 'category_only', 'default']),
        sampleSize: v4_1.z.number().int(),
    }),
    scoredAt: v4_1.z.string(),
});
