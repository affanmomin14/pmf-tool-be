"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIMENSION_WEIGHTS = void 0;
exports.parseMarketSize = parseMarketSize;
exports.parsePercentage = parsePercentage;
exports.scoreDemand = scoreDemand;
exports.scoreIcpFocus = scoreIcpFocus;
exports.scoreDifferentiation = scoreDifferentiation;
exports.scoreDistributionFit = scoreDistributionFit;
exports.scoreProblemSeverity = scoreProblemSeverity;
exports.scoreCompetitivePosition = scoreCompetitivePosition;
exports.scoreTrustAndProof = scoreTrustAndProof;
exports.computeFinalScore = computeFinalScore;
exports.deriveStage = deriveStage;
exports.identifyBreaks = identifyBreaks;
exports.scoreAssessment = scoreAssessment;
const scoring_schema_1 = require("../schemas/scoring.schema");
const prisma_1 = require("../db/prisma");
const errors_1 = require("../errors");
// ============================================================================
// Section 1: Numeric Parsing Utilities
// ============================================================================
/**
 * Parse market size strings like "$2.5B", "$500M", "$50K", "~$2.5 billion",
 * "approximately $500M", "$2.5-3.0B" (takes first number) into numeric values.
 * Returns null for unparseable strings.
 */
function parseMarketSize(value) {
    if (!value)
        return null;
    // Strip prefixes: ~, approximately, about, around, over, nearly
    const cleaned = value.replace(/^[~≈]|approximately|about|around|over|nearly/gi, '').trim();
    // Match dollar amount with optional multiplier (supports bn, trillion, T)
    const match = cleaned.match(/\$?\s*([\d,.]+)\s*[-–]?\s*(?:[\d,.]+\s*)?(?:\s*(B|bn|billion|T|trillion|M|million|K|thousand))?/i);
    if (!match)
        return null;
    const num = parseFloat(match[1].replace(/,/g, ''));
    if (isNaN(num))
        return null;
    const multiplier = match[2]?.toUpperCase();
    if (multiplier === 'B' || multiplier === 'BN' || multiplier === 'BILLION')
        return num * 1_000_000_000;
    if (multiplier === 'T' || multiplier === 'TRILLION')
        return num * 1_000_000_000_000;
    if (multiplier === 'M' || multiplier === 'MILLION')
        return num * 1_000_000;
    if (multiplier === 'K' || multiplier === 'THOUSAND')
        return num * 1_000;
    return num;
}
/**
 * Parse percentage strings like "15% CAGR", "~20%", "8.5%", "approximately 12%",
 * "10-15% CAGR" (takes midpoint for ranges) into numeric values.
 * Returns null for unparseable strings.
 */
function parsePercentage(value) {
    if (!value)
        return null;
    // Strip prefixes: ~, approximately, about, around
    const cleaned = value.replace(/^[~≈]|approximately|about|around/gi, '').trim();
    // Try range first: "10-15%" or "10% - 15%"
    const rangeMatch = cleaned.match(/([\d.]+)\s*%?\s*[-–to]+\s*([\d.]+)\s*%/);
    if (rangeMatch) {
        const low = parseFloat(rangeMatch[1]);
        const high = parseFloat(rangeMatch[2]);
        if (!isNaN(low) && !isNaN(high))
            return (low + high) / 2;
    }
    // Single value: "15% CAGR", "8.5 percent", etc.
    const match = cleaned.match(/([\d.]+)\s*(?:%|percent|CAGR|growth|annually)/i);
    if (!match) {
        // Fallback: any number followed by %
        const fallback = cleaned.match(/([\d.]+)\s*%/);
        if (!fallback)
            return null;
        const num = parseFloat(fallback[1]);
        return isNaN(num) ? null : num;
    }
    const num = parseFloat(match[1]);
    return isNaN(num) ? null : num;
}
/**
 * Parse funding strings like "$50M Series C", "$2.5B" into numeric values.
 * Returns null for unparseable strings.
 */
function parseFunding(value) {
    return parseMarketSize(value); // Same format: "$XM", "$XB"
}
/**
 * Check if research quality indicates limited/thin/minimal data.
 * Handles both old string format ('limited') and new object format.
 */
function isResearchLimited(quality) {
    if (typeof quality === 'string')
        return quality === 'limited';
    return quality.overall === 'thin' || quality.overall === 'minimal';
}
// ============================================================================
// Section 2: Dimension Weight Constants
// ============================================================================
exports.DIMENSION_WEIGHTS = {
    demand: 0.18,
    icpFocus: 0.15,
    differentiation: 0.15,
    distributionFit: 0.16,
    problemSeverity: 0.14,
    competitivePosition: 0.14,
    trustAndProof: 0.08,
};
// Verify weights sum to 1.0 at module load (fail fast)
const weightSum = Object.values(exports.DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(weightSum - 1.0) > 0.001) {
    throw new Error(`Dimension weights must sum to 1.0, got ${weightSum}`);
}
// ============================================================================
// Section 3: Helper -- clamp score to 1-10
// ============================================================================
function clampScore(value) {
    return Math.max(1, Math.min(10, Math.round(value)));
}
// ============================================================================
// Section 4: Seven Dimension Scoring Functions
// ============================================================================
// 4a: scoreDemand -- Market demand validation (weight: 0.18)
function scoreDemand(input) {
    const subScores = [];
    // Sub-score 1: Market size (from TAM)
    const tamValue = parseMarketSize(input.research.market.tam);
    let marketSizeScore;
    if (tamValue === null) {
        marketSizeScore = 4;
    }
    else if (tamValue >= 10_000_000_000) {
        marketSizeScore = 9;
    }
    else if (tamValue >= 1_000_000_000) {
        marketSizeScore = 7;
    }
    else if (tamValue >= 100_000_000) {
        marketSizeScore = 5;
    }
    else {
        marketSizeScore = 3;
    }
    subScores.push({ name: 'marketSize', value: marketSizeScore, signal: tamValue === null ? 'Market data unparseable — score reflects uncertainty' : (input.research.market.tam || 'unknown') });
    // Sub-score 2: Growth rate
    const growthPct = parsePercentage(input.research.market.growthRate);
    let growthScore;
    if (growthPct === null) {
        growthScore = 4;
    }
    else if (growthPct >= 25) {
        growthScore = 9;
    }
    else if (growthPct >= 15) {
        growthScore = 7;
    }
    else if (growthPct >= 8) {
        growthScore = 5;
    }
    else {
        growthScore = 3;
    }
    subScores.push({ name: 'growthRate', value: growthScore, signal: growthPct === null ? 'Growth data unparseable — score reflects uncertainty' : (input.research.market.growthRate || 'unknown') });
    // Sub-score 3: Competitor density (more = validated market)
    const competitorCount = input.research.competitors.length;
    let densityScore;
    if (competitorCount >= 6) {
        densityScore = 8;
    }
    else if (competitorCount >= 3) {
        densityScore = 6;
    }
    else if (competitorCount >= 1) {
        densityScore = 4;
    }
    else {
        densityScore = 2;
    }
    subScores.push({ name: 'competitorDensity', value: densityScore, signal: `${competitorCount} competitors found` });
    const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
    const confidence = isResearchLimited(input.research.researchQuality) ? 'low' : 'high';
    // Apply confidence penalty if research is limited
    let finalScore = clampScore(avg);
    if (confidence === 'low') {
        finalScore = clampScore(finalScore - 1);
    }
    // Apply traction boost (hard traction trumps missing market data)
    const tm = input.classification.traction_metrics;
    if (tm.mrr && tm.mrr >= 10000) {
        finalScore = clampScore(finalScore + 1);
        subScores.push({ name: 'tractionValidation', value: 8, signal: `Strong demand validated by $${(tm.mrr / 1000).toFixed(1)}k MRR` });
    }
    else if (tm.user_count && tm.user_count >= 1000) {
        finalScore = clampScore(finalScore + 1);
        subScores.push({ name: 'tractionValidation', value: 7, signal: `Demand validated by ${tm.user_count} users` });
    }
    return { score: finalScore, subScores, confidence };
}
// 4b: scoreIcpFocus -- ICP specificity and targeting (weight: 0.15)
function scoreIcpFocus(input) {
    const subScores = [];
    // Sub-score 1: ICP specificity (1-5 scale mapped to 1-10)
    let specScore = input.classification.icp_specificity * 2;
    // Penalize generic "laundry list" ICPs that the LLM might have missed
    const q2Segments = input.founderAnswers.q2_icp.split(',').length;
    const hasQualifiers = /employees|mrr|arr|revenue|funding|series|scale|size/i.test(input.founderAnswers.q2_icp);
    if (q2Segments >= 3 && !hasQualifiers) {
        specScore = Math.min(specScore, 4); // Cap at 4/10 if it's just a comma-separated list of broad personas
    }
    subScores.push({ name: 'icpSpecificity', value: clampScore(specScore), signal: `ICP specificity: ${specScore / 2}/5` });
    // Sub-score 2: ICP completeness (count of non-null extracted fields)
    const icp = input.classification.icp_extracted;
    const filledFields = [icp.industry, icp.company_size, icp.stage, icp.role, icp.geography].filter(v => v !== null && v !== undefined).length;
    const completenessMap = { 5: 10, 4: 8, 3: 6, 2: 4, 1: 3, 0: 1 };
    const completenessScore = completenessMap[filledFields] ?? 1;
    subScores.push({ name: 'icpCompleteness', value: completenessScore, signal: `${filledFields}/5 ICP fields populated` });
    // Sub-score 3: Category confidence
    const confidenceMap = { high: 8, medium: 5, low: 3 };
    const confScore = confidenceMap[input.classification.category_confidence] ?? 5;
    subScores.push({ name: 'categoryConfidence', value: confScore, signal: `Category confidence: ${input.classification.category_confidence}` });
    const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
    return { score: clampScore(avg), subScores, confidence: 'high' };
}
// 4c: scoreDifferentiation -- Unique positioning and pricing power (weight: 0.15)
function scoreDifferentiation(input) {
    const subScores = [];
    // Sub-score 1: Pricing model clarity
    const hasPricing = input.classification.product_signals.pricing_model && input.classification.product_signals.pricing_model.length > 0;
    subScores.push({ name: 'pricingModelClarity', value: hasPricing ? 7 : 4, signal: input.classification.product_signals.pricing_model || 'no pricing model specified' });
    // Sub-score 2: Market gaps (opportunities to differentiate)
    const gapCount = input.research.patterns.gaps?.length ?? 0;
    let gapScore;
    if (gapCount >= 3) {
        gapScore = 8;
    }
    else if (gapCount >= 1) {
        gapScore = 6;
    }
    else {
        gapScore = 4;
    }
    subScores.push({ name: 'marketGaps', value: gapScore, signal: `${gapCount} market gaps identified` });
    // Sub-score 3: Competitor pricing diversity (more = room to differentiate)
    const distinctPricingModels = new Set(input.research.competitors.map(c => c.pricingModel).filter((p) => p !== null && p.length > 0)).size;
    let spreadScore;
    if (distinctPricingModels >= 3) {
        spreadScore = 7;
    }
    else if (distinctPricingModels >= 2) {
        spreadScore = 5;
    }
    else {
        spreadScore = 3;
    }
    subScores.push({ name: 'competitorSpread', value: spreadScore, signal: `${distinctPricingModels} distinct pricing models among competitors` });
    // Sub-score 4: Traction signal (proven differentiation)
    const tractionMap = { established: 9, growing: 7, early: 5, none: 3 };
    const tractionScore = tractionMap[input.classification.product_signals.traction_level] ?? 5;
    subScores.push({ name: 'tractionSignal', value: tractionScore, signal: `Traction: ${input.classification.product_signals.traction_level}` });
    const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
    const confidence = isResearchLimited(input.research.researchQuality) ? 'low' : 'medium';
    let finalScore = clampScore(avg);
    if (confidence === 'low') {
        finalScore = clampScore(finalScore - 1);
    }
    return { score: finalScore, subScores, confidence };
}
// 4d: scoreDistributionFit -- Scalable channel alignment (weight: 0.16)
function scoreDistributionFit(input) {
    const subScores = [];
    // Sub-score 1: Maturity stage
    const maturityMap = { scaling: 9, launched: 7, beta: 5, mvp: 4, idea: 2 };
    const maturityScore = maturityMap[input.classification.product_signals.maturity_stage] ?? 5;
    subScores.push({ name: 'maturityStage', value: maturityScore, signal: `Maturity: ${input.classification.product_signals.maturity_stage}` });
    // Sub-score 2: Sales model alignment
    // Q3 values from PRD: self_serve, sales_assisted, founder_led, partner_channel, undefined
    const q3Lower = input.founderAnswers.q3_distribution.toLowerCase();
    // Map PRD Q3 values to model keywords for matching against research
    const MODEL_KEYWORDS = {
        self_serve: ['self-serve', 'self serve', 'plg', 'product-led', 'product led', 'freemium', 'free trial'],
        sales_assisted: ['sales-led', 'sales led', 'demo', 'enterprise', 'sales-assisted'],
        founder_led: ['founder-led', 'founder led', 'outbound', 'direct sales'],
        partner_channel: ['partnership', 'partner', 'marketplace', 'integration', 'channel'],
        undefined: [],
    };
    const founderKeywords = MODEL_KEYWORDS[q3Lower] || [];
    const topCompanySalesModels = (input.research.patterns.topCompanies || [])
        .map(c => c.salesModel?.toLowerCase() || '')
        .filter(s => s.length > 0);
    const hasModelMatch = founderKeywords.length > 0 && topCompanySalesModels.some(sm => founderKeywords.some(kw => sm.includes(kw)));
    // Relax exact matching constraint for partner channel
    const hasPartnerMatch = q3Lower === 'partner_channel' && topCompanySalesModels.some(sm => /partner|integration|marketplace|channel/i.test(sm));
    const isMatch = hasModelMatch || hasPartnerMatch;
    const modelScore = q3Lower === 'undefined' ? 2 : (founderKeywords.length === 0 && topCompanySalesModels.length === 0) ? 5 : isMatch ? 7 : 4;
    subScores.push({ name: 'salesModelMatch', value: modelScore, signal: isMatch ? 'Distribution aligns with market leaders' : q3Lower === 'undefined' ? 'No distribution model defined' : 'Distribution model differs from market leaders or insufficient data' });
    // Sub-score 3: Free tier prevalence (PLG-friendly market signal)
    const competitorsWithFreeTierData = input.research.competitors.filter(c => c.freeTier !== null);
    let freeTierScore;
    if (competitorsWithFreeTierData.length === 0) {
        freeTierScore = 5;
    }
    else {
        const freeTierPct = competitorsWithFreeTierData.filter(c => c.freeTier === true).length / competitorsWithFreeTierData.length;
        if (freeTierPct >= 0.6) {
            freeTierScore = 8;
        }
        else if (freeTierPct >= 0.3) {
            freeTierScore = 6;
        }
        else {
            freeTierScore = 4;
        }
    }
    subScores.push({ name: 'freeTierPrevalence', value: freeTierScore, signal: `${competitorsWithFreeTierData.filter(c => c.freeTier).length}/${competitorsWithFreeTierData.length} competitors offer free tier` });
    const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
    const confidence = isResearchLimited(input.research.researchQuality) ? 'low' : 'medium';
    return { score: clampScore(avg), subScores, confidence };
}
// 4e: scoreProblemSeverity -- How painful is the problem being solved? (weight: 0.14)
function scoreProblemSeverity(input) {
    const subScores = [];
    // Sub-score 1: Complaint intensity (highest complaint percentage)
    const topComplaintPct = input.research.complaints
        .map(c => c.percentage)
        .filter((p) => p !== null)
        .sort((a, b) => b - a)[0] ?? null;
    let intensityScore;
    if (topComplaintPct === null) {
        intensityScore = 5;
    }
    else if (topComplaintPct >= 30) {
        intensityScore = 9;
    }
    else if (topComplaintPct >= 20) {
        intensityScore = 7;
    }
    else if (topComplaintPct >= 10) {
        intensityScore = 5;
    }
    else {
        intensityScore = 3;
    }
    subScores.push({ name: 'complaintIntensity', value: intensityScore, signal: topComplaintPct !== null ? `Top complaint: ${topComplaintPct}%` : 'No complaint data' });
    // Sub-score 2: Complaint breadth
    const complaintCount = input.research.complaints.length;
    let breadthScore;
    if (complaintCount >= 5) {
        breadthScore = 8;
    }
    else if (complaintCount >= 3) {
        breadthScore = 6;
    }
    else if (complaintCount >= 1) {
        breadthScore = 4;
    }
    else {
        breadthScore = 3;
    }
    subScores.push({ name: 'complaintBreadth', value: breadthScore, signal: `${complaintCount} complaint themes identified` });
    // Sub-score 3: Traction as severity proxy
    const tractionMap = { established: 9, growing: 7, early: 5, none: 3 };
    const tractionScore = tractionMap[input.classification.product_signals.traction_level] ?? 5;
    subScores.push({ name: 'tractionAsProxy', value: tractionScore, signal: `Traction: ${input.classification.product_signals.traction_level}` });
    const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
    const confidence = (isResearchLimited(input.research.researchQuality) || input.research.complaints.length < 2) ? 'low' : 'medium';
    let finalScore = clampScore(avg);
    if (confidence === 'low') {
        finalScore = clampScore(finalScore - 1);
    }
    return { score: finalScore, subScores, confidence };
}
// 4f: scoreCompetitivePosition -- Market dynamics and moat strength (weight: 0.14)
function scoreCompetitivePosition(input) {
    const subScores = [];
    // Sub-score 1: Competitor quality (G2 ratings -- higher ratings = tougher but validated)
    const ratings = input.research.competitors
        .map(c => c.g2Rating)
        .filter((r) => r !== null);
    let qualityScore;
    if (ratings.length === 0) {
        qualityScore = 5;
    }
    else {
        const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        if (avgRating >= 4.5) {
            qualityScore = 5;
        }
        else if (avgRating >= 4.0) {
            qualityScore = 6;
        }
        else if (avgRating >= 3.5) {
            qualityScore = 7;
        }
        else {
            qualityScore = 8;
        }
    }
    subScores.push({ name: 'competitorQuality', value: qualityScore, signal: ratings.length > 0 ? `Avg competitor G2: ${(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)}` : 'No G2 data' });
    // Sub-score 2: Competitor funding levels
    const fundingValues = input.research.competitors
        .map(c => parseFunding(c.funding))
        .filter((f) => f !== null);
    let fundingScore;
    if (fundingValues.length === 0) {
        fundingScore = 5;
    }
    else {
        const avgFunding = fundingValues.reduce((a, b) => a + b, 0) / fundingValues.length;
        if (avgFunding >= 100_000_000) {
            fundingScore = 3;
        }
        else if (avgFunding >= 10_000_000) {
            fundingScore = 5;
        }
        else {
            fundingScore = 7;
        }
    }
    subScores.push({ name: 'competitorFunding', value: fundingScore, signal: fundingValues.length > 0 ? `Avg competitor funding: $${(fundingValues.reduce((a, b) => a + b, 0) / fundingValues.length / 1_000_000).toFixed(1)}M` : 'No funding data' });
    // Sub-score 3: Market concentration
    const compCount = input.research.competitors.length;
    let concentrationScore;
    if (compCount === 0) {
        concentrationScore = 5;
    }
    else if (compCount <= 2) {
        concentrationScore = 4;
    }
    else if (compCount <= 5) {
        concentrationScore = 7;
    }
    else {
        concentrationScore = 6;
    }
    subScores.push({ name: 'marketConcentration', value: concentrationScore, signal: `${compCount} competitors in market` });
    // Sub-score 4: Positioning clarity from patterns
    const hasPositioningData = (input.research.patterns.topCompanies || []).some(c => c.positioning !== null && c.positioning.length > 0);
    subScores.push({ name: 'positioningClarity', value: hasPositioningData ? 6 : 4, signal: hasPositioningData ? 'Market has clear positioning patterns' : 'No positioning data available' });
    const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
    const confidence = isResearchLimited(input.research.researchQuality) ? 'low' : 'medium';
    let finalScore = clampScore(avg);
    if (confidence === 'low') {
        finalScore = clampScore(finalScore - 1);
    }
    return { score: finalScore, subScores, confidence };
}
// 4g: scoreTrustAndProof -- Social proof, reviews, and market validation (weight: 0.08)
function scoreTrustAndProof(input) {
    const subScores = [];
    // Sub-score 1: Review volume (market engagement)
    const totalReviews = input.research.competitors
        .map(c => c.reviewCount)
        .filter((r) => r !== null)
        .reduce((a, b) => a + b, 0);
    let volumeScore;
    if (totalReviews >= 10000) {
        volumeScore = 8;
    }
    else if (totalReviews >= 1000) {
        volumeScore = 6;
    }
    else if (totalReviews >= 100) {
        volumeScore = 4;
    }
    else {
        volumeScore = 3;
    }
    subScores.push({ name: 'reviewVolume', value: volumeScore, signal: `${totalReviews} total competitor reviews` });
    // Sub-score 2: Maturity as trust proxy
    const maturityMap = { scaling: 9, launched: 7, beta: 5, mvp: 3, idea: 2 };
    const maturityScore = maturityMap[input.classification.product_signals.maturity_stage] ?? 5;
    subScores.push({ name: 'maturityProof', value: maturityScore, signal: `Maturity: ${input.classification.product_signals.maturity_stage}` });
    // Sub-score 3: Traction as trust proof
    const tractionMap = { established: 9, growing: 7, early: 4, none: 2 };
    const tractionScore = tractionMap[input.classification.product_signals.traction_level] ?? 5;
    subScores.push({ name: 'tractionProof', value: tractionScore, signal: `Traction: ${input.classification.product_signals.traction_level}` });
    const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
    let finalScore = clampScore(avg);
    // Real traction is the ultimate proof of trust
    const tm = input.classification.traction_metrics;
    if (tm.arr && tm.arr >= 1000000) {
        finalScore = 10; // $1M ARR = instant 10/10 trust
        subScores.push({ name: 'hardTraction', value: 10, signal: `Proven by $ ${(tm.arr / 1000000).toFixed(1)}M ARR` });
    }
    else if (tm.mrr && tm.mrr >= 10000) {
        finalScore = clampScore(finalScore + 2);
        subScores.push({ name: 'hardTraction', value: 9, signal: `Proven by $${(tm.mrr / 1000).toFixed(1)}k MRR` });
    }
    return { score: finalScore, subScores, confidence: 'medium' };
}
// ============================================================================
// Section 5: Final Score Computation
// ============================================================================
function computeFinalScore(dimensions) {
    let rawWeightedSum = 0;
    for (const [key, weight] of Object.entries(exports.DIMENSION_WEIGHTS)) {
        rawWeightedSum += dimensions[key].score * weight;
    }
    const finalScore = Math.max(0, Math.min(100, Math.round(rawWeightedSum * 10)));
    return {
        rawWeightedSum: Math.round(rawWeightedSum * 100) / 100,
        finalScore,
    };
}
// ============================================================================
// Section 6: Stage Derivation
// ============================================================================
const STAGE_THRESHOLDS = [
    { max: 35, stage: 'pre_pmf' },
    { max: 60, stage: 'approaching' },
    { max: 80, stage: 'early_pmf' },
    { max: 100, stage: 'strong' },
];
function deriveStage(finalScore) {
    for (const { max, stage } of STAGE_THRESHOLDS) {
        if (finalScore <= max)
            return stage;
    }
    return 'strong';
}
// ============================================================================
// Section 7: Break Identification with Q4 Cross-Reference
// ============================================================================
const PROBLEM_TYPE_TO_DIMENSION = {
    acquisition: 'demand',
    retention: 'problemSeverity',
    activation: 'distributionFit',
    monetization: 'differentiation',
    positioning: 'competitivePosition',
};
function identifyBreaks(dimensions, problemType) {
    // Sort by score ASC, then weight DESC for tie-breaking, then key ASC for determinism
    const sorted = Object.entries(dimensions)
        .map(([key, result]) => ({ key, score: result.score, weight: exports.DIMENSION_WEIGHTS[key] }))
        .sort((a, b) => a.score - b.score || b.weight - a.weight || a.key.localeCompare(b.key));
    const primaryBreak = sorted[0].key;
    const secondaryBreak = sorted[1].key;
    const founderDimension = PROBLEM_TYPE_TO_DIMENSION[problemType] || null;
    const founderMismatch = founderDimension !== null && founderDimension !== primaryBreak;
    return { primaryBreak, secondaryBreak, founderMismatch, founderIdentifiedDimension: founderDimension };
}
// ============================================================================
// Section 8: Input Assembly (private helper)
// ============================================================================
function assembleScoringInput(assessment) {
    const classification = assessment.classificationData;
    const research = assessment.researchData;
    const responses = assessment.responses;
    // Map responses to founder answers by questionOrder
    const getAnswer = (order) => {
        const r = responses.find(r => r.questionOrder === order);
        return r?.answerText || r?.answerValue || '';
    };
    // Q3 uses answerValue first (single_select) with answerText fallback
    const q3Response = responses.find(r => r.questionOrder === 3);
    const q3Answer = q3Response?.answerValue || q3Response?.answerText || '';
    return {
        classification: {
            category: classification.category,
            sub_category: classification.sub_category,
            category_confidence: classification.category_confidence,
            problem_type: classification.problem_type,
            icp_specificity: classification.icp_specificity,
            icp_extracted: classification.icp_extracted || {
                industry: null, company_size: null, stage: null, role: null, geography: null,
            },
            product_signals: classification.product_signals || {
                pricing_model: null, traction_level: 'none', maturity_stage: 'idea',
            },
            business_model: classification.business_model || 'other',
            traction_metrics: classification.traction_metrics || {
                mrr: null, arr: null, user_count: null, growth_rate: null, months_active: null,
            },
            likely_competitors: classification.likely_competitors || [],
        },
        research: {
            competitors: (research.competitors || []).map((c) => ({
                name: c.name,
                g2Rating: c.g2Rating ?? null,
                reviewCount: c.reviewCount ?? null,
                funding: c.funding ?? null,
                pricingModel: c.pricingModel ?? null,
                freeTier: c.freeTier ?? null,
                tagline: c.tagline ?? null,
            })),
            market: {
                tam: research.market?.tam ?? null,
                sam: research.market?.sam ?? null,
                growthRate: research.market?.growthRate ?? null,
            },
            complaints: (research.complaints || []).map((c) => ({
                theme: c.theme,
                percentage: c.percentage ?? null,
            })),
            patterns: {
                topCompanies: research.patterns?.topCompanies ?? null,
                gaps: research.patterns?.gaps ?? null,
            },
            researchQuality: research.researchQuality || { overall: 'minimal', competitorCount: 0, hasMarketData: false, complaintCount: 0 },
        },
        founderAnswers: {
            q1_product: getAnswer(1),
            q2_icp: getAnswer(2),
            q3_distribution: q3Answer,
            q4_stuck: getAnswer(4),
            q5_traction: getAnswer(5),
        },
    };
}
// ============================================================================
// Section 9: Benchmark Computation
// ============================================================================
const BENCHMARK_MIN_SAMPLE = 5;
const BENCHMARK_DEFAULT = 70;
function computeDimensionAverages(assessments) {
    const benchmarks = {};
    for (const key of Object.keys(exports.DIMENSION_WEIGHTS)) {
        const scores = assessments
            .map((a) => a.scoreData?.dimensions?.[key]?.score)
            .filter((s) => typeof s === 'number');
        benchmarks[key] = scores.length > 0
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10)
            : BENCHMARK_DEFAULT;
    }
    return benchmarks;
}
async function computeBenchmarks(category, subCategory) {
    // Fetch assessments that have scoreData
    const assessments = await prisma_1.prisma.assessment.findMany({
        where: {
            scoreData: { not: null },
            classificationData: { not: null },
        },
        select: { classificationData: true, scoreData: true },
    });
    // Filter by category + sub_category (application-level -- Prisma JSON AND is limited)
    const exactMatches = assessments.filter((a) => {
        const cd = a.classificationData;
        return cd?.category === category && cd?.sub_category === subCategory;
    });
    // Try exact match first
    if (exactMatches.length >= BENCHMARK_MIN_SAMPLE) {
        return {
            benchmarks: computeDimensionAverages(exactMatches),
            meta: { source: 'category_subcategory', sampleSize: exactMatches.length },
        };
    }
    // Fallback: category-only
    const categoryMatches = assessments.filter((a) => {
        const cd = a.classificationData;
        return cd?.category === category;
    });
    if (categoryMatches.length >= BENCHMARK_MIN_SAMPLE) {
        return {
            benchmarks: computeDimensionAverages(categoryMatches),
            meta: { source: 'category_only', sampleSize: categoryMatches.length },
        };
    }
    // Default: 70 per dimension
    const defaults = {};
    for (const key of Object.keys(exports.DIMENSION_WEIGHTS)) {
        defaults[key] = BENCHMARK_DEFAULT;
    }
    return {
        benchmarks: defaults,
        meta: { source: 'default', sampleSize: 0 },
    };
}
// ============================================================================
// Section 10: Score Assessment Orchestrator (main export)
// ============================================================================
async function scoreAssessment(assessmentId) {
    // 1. Fetch assessment with all data needed for scoring
    const assessment = await prisma_1.prisma.assessment.findUnique({
        where: { id: assessmentId },
        include: { responses: { orderBy: { questionOrder: 'asc' } } },
    });
    if (!assessment)
        throw new errors_1.NotFoundError('Assessment not found');
    // 2. Validate prerequisites
    if (!assessment.classificationData) {
        throw new errors_1.ValidationError('Assessment must be classified before scoring');
    }
    if (!assessment.researchData) {
        throw new errors_1.ValidationError('Assessment must have research data before scoring');
    }
    // 3. Assemble scoring input (pure data object from DB data)
    const input = assembleScoringInput(assessment);
    // 4. Score all 7 dimensions (pure functions, no side effects)
    const dimensions = {
        demand: scoreDemand(input),
        icpFocus: scoreIcpFocus(input),
        differentiation: scoreDifferentiation(input),
        distributionFit: scoreDistributionFit(input),
        problemSeverity: scoreProblemSeverity(input),
        competitivePosition: scoreCompetitivePosition(input),
        trustAndProof: scoreTrustAndProof(input),
    };
    // 5. Compute final score
    const { rawWeightedSum, finalScore } = computeFinalScore(dimensions);
    // 6. Derive stage
    const pmfStage = deriveStage(finalScore);
    // 7. Identify breaks with Q4 cross-reference
    const breaks = identifyBreaks(dimensions, input.classification.problem_type);
    // 8. Compute benchmarks
    const { benchmarks, meta: benchmarkMeta } = await computeBenchmarks(input.classification.category, input.classification.sub_category);
    // 9. Assemble scoreData
    const scoreData = {
        dimensions,
        weights: { ...exports.DIMENSION_WEIGHTS },
        rawWeightedSum,
        finalScore,
        pmfStage,
        ...breaks,
        benchmarks,
        benchmarkMeta,
        scoredAt: new Date().toISOString(),
    };
    // 10. Validate with Zod
    const validated = scoring_schema_1.scoreDataSchema.safeParse(scoreData);
    if (!validated.success) {
        throw new errors_1.ValidationError(`Score data failed validation: ${validated.error.message}`);
    }
    // 11. Store in assessment
    await prisma_1.prisma.assessment.update({
        where: { id: assessmentId },
        data: { scoreData: validated.data },
    });
    return validated.data;
}
