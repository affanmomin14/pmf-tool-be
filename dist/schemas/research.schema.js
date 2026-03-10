"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patternExtractionSchema = exports.complaintExtractionSchema = exports.marketExtractionSchema = exports.competitorExtractionSchema = exports.researchOutputSchema = exports.researchQualitySchema = exports.patternSchema = exports.complaintSchema = exports.marketDataSchema = exports.competitorSchema = void 0;
const v4_1 = require("zod/v4");
// ============================================================================
// Per-dimension schemas
// ============================================================================
exports.competitorSchema = v4_1.z.object({
    name: v4_1.z.string(),
    g2Rating: v4_1.z.nullable(v4_1.z.number()),
    reviewCount: v4_1.z.nullable(v4_1.z.number().int()),
    funding: v4_1.z.nullable(v4_1.z.string()),
    pricingModel: v4_1.z.nullable(v4_1.z.string()),
    freeTier: v4_1.z.nullable(v4_1.z.boolean()),
    tagline: v4_1.z.nullable(v4_1.z.string()),
    sourceUrl: v4_1.z.nullable(v4_1.z.string()),
});
exports.marketDataSchema = v4_1.z.object({
    tam: v4_1.z.nullable(v4_1.z.string()),
    sam: v4_1.z.nullable(v4_1.z.string()),
    growthRate: v4_1.z.nullable(v4_1.z.string()),
    regions: v4_1.z.nullable(v4_1.z.array(v4_1.z.object({
        name: v4_1.z.string(),
        percentage: v4_1.z.nullable(v4_1.z.number()),
    }))),
});
exports.complaintSchema = v4_1.z.object({
    theme: v4_1.z.string(),
    percentage: v4_1.z.nullable(v4_1.z.number()),
    sourceUrl: v4_1.z.nullable(v4_1.z.string()),
});
exports.patternSchema = v4_1.z.object({
    topCompanies: v4_1.z.nullable(v4_1.z.array(v4_1.z.object({
        name: v4_1.z.string(),
        salesModel: v4_1.z.nullable(v4_1.z.string()),
        positioning: v4_1.z.nullable(v4_1.z.string()),
        sourceUrl: v4_1.z.nullable(v4_1.z.string()),
    }))),
    gaps: v4_1.z.nullable(v4_1.z.array(v4_1.z.string())),
});
// ============================================================================
// Full research output schema
// ============================================================================
exports.researchQualitySchema = v4_1.z.object({
    overall: v4_1.z.enum(['rich', 'sufficient', 'thin', 'minimal']),
    competitorCount: v4_1.z.number().int(),
    hasMarketData: v4_1.z.boolean(),
    complaintCount: v4_1.z.number().int(),
});
exports.researchOutputSchema = v4_1.z.object({
    competitors: v4_1.z.array(exports.competitorSchema),
    market: exports.marketDataSchema,
    complaints: v4_1.z.array(exports.complaintSchema),
    patterns: exports.patternSchema,
    researchQuality: exports.researchQualitySchema,
    metadata: v4_1.z.object({
        totalDurationMs: v4_1.z.number(),
        callCount: v4_1.z.number().int(),
        cachedHit: v4_1.z.boolean(),
        researchedAt: v4_1.z.string(),
    }),
});
// ============================================================================
// Per-dimension extraction schemas (used with zodTextFormat for parse step)
// ============================================================================
exports.competitorExtractionSchema = v4_1.z.object({
    competitors: v4_1.z.array(exports.competitorSchema),
});
exports.marketExtractionSchema = v4_1.z.object({
    market: exports.marketDataSchema,
});
exports.complaintExtractionSchema = v4_1.z.object({
    complaints: v4_1.z.array(exports.complaintSchema),
});
exports.patternExtractionSchema = v4_1.z.object({
    patterns: exports.patternSchema,
});
