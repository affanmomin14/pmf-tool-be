import type { ScoringInput, DimensionResult, SubScore, DimensionScores, ScoreData } from '../schemas/scoring.schema';
import { scoreDataSchema } from '../schemas/scoring.schema';
import { prisma } from '../db/prisma';
import { NotFoundError, ValidationError } from '../errors';

// ============================================================================
// Section 1: Numeric Parsing Utilities
// ============================================================================

/**
 * Parse market size strings like "$2.5B", "$500M", "$50K" into numeric values.
 * Returns null for unparseable strings.
 */
export function parseMarketSize(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/\$?([\d.]+)\s*(B|billion|M|million|K|thousand)?/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return null;
  const multiplier = match[2]?.toUpperCase();
  if (multiplier === 'B' || multiplier === 'BILLION') return num * 1_000_000_000;
  if (multiplier === 'M' || multiplier === 'MILLION') return num * 1_000_000;
  if (multiplier === 'K' || multiplier === 'THOUSAND') return num * 1_000;
  return num;
}

/**
 * Parse percentage strings like "15% CAGR", "~20%", "8.5%" into numeric values.
 * Returns null for unparseable strings.
 */
export function parsePercentage(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/~?([\d.]+)\s*%/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  return isNaN(num) ? null : num;
}

/**
 * Parse funding strings like "$50M Series C", "$2.5B" into numeric values.
 * Returns null for unparseable strings.
 */
function parseFunding(value: string | null): number | null {
  return parseMarketSize(value); // Same format: "$XM", "$XB"
}

// ============================================================================
// Section 2: Dimension Weight Constants
// ============================================================================

export const DIMENSION_WEIGHTS: Record<string, number> = {
  demand: 0.18,
  icpFocus: 0.15,
  differentiation: 0.15,
  distributionFit: 0.16,
  problemSeverity: 0.14,
  competitivePosition: 0.14,
  trustAndProof: 0.08,
};

// Verify weights sum to 1.0 at module load (fail fast)
const weightSum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(weightSum - 1.0) > 0.001) {
  throw new Error(`Dimension weights must sum to 1.0, got ${weightSum}`);
}

// ============================================================================
// Section 3: Helper -- clamp score to 1-10
// ============================================================================

function clampScore(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

// ============================================================================
// Section 4: Seven Dimension Scoring Functions
// ============================================================================

// 4a: scoreDemand -- Market demand validation (weight: 0.18)
export function scoreDemand(input: ScoringInput): DimensionResult {
  const subScores: SubScore[] = [];

  // Sub-score 1: Market size (from TAM)
  const tamValue = parseMarketSize(input.research.market.tam);
  let marketSizeScore: number;
  if (tamValue === null) {
    marketSizeScore = 5;
  } else if (tamValue >= 10_000_000_000) {
    marketSizeScore = 9;
  } else if (tamValue >= 1_000_000_000) {
    marketSizeScore = 7;
  } else if (tamValue >= 100_000_000) {
    marketSizeScore = 5;
  } else {
    marketSizeScore = 3;
  }
  subScores.push({ name: 'marketSize', value: marketSizeScore, signal: input.research.market.tam || 'unknown' });

  // Sub-score 2: Growth rate
  const growthPct = parsePercentage(input.research.market.growthRate);
  let growthScore: number;
  if (growthPct === null) {
    growthScore = 5;
  } else if (growthPct >= 25) {
    growthScore = 9;
  } else if (growthPct >= 15) {
    growthScore = 7;
  } else if (growthPct >= 8) {
    growthScore = 5;
  } else {
    growthScore = 3;
  }
  subScores.push({ name: 'growthRate', value: growthScore, signal: input.research.market.growthRate || 'unknown' });

  // Sub-score 3: Competitor density (more = validated market)
  const competitorCount = input.research.competitors.length;
  let densityScore: number;
  if (competitorCount >= 6) {
    densityScore = 8;
  } else if (competitorCount >= 3) {
    densityScore = 6;
  } else if (competitorCount >= 1) {
    densityScore = 4;
  } else {
    densityScore = 2;
  }
  subScores.push({ name: 'competitorDensity', value: densityScore, signal: `${competitorCount} competitors found` });

  const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
  const confidence = input.research.researchQuality === 'limited' ? 'low' as const : 'high' as const;
  return { score: clampScore(avg), subScores, confidence };
}

// 4b: scoreIcpFocus -- ICP specificity and targeting (weight: 0.15)
export function scoreIcpFocus(input: ScoringInput): DimensionResult {
  const subScores: SubScore[] = [];

  // Sub-score 1: ICP specificity (1-5 scale mapped to 1-10)
  const specScore = input.classification.icp_specificity * 2;
  subScores.push({ name: 'icpSpecificity', value: clampScore(specScore), signal: `ICP specificity: ${input.classification.icp_specificity}/5` });

  // Sub-score 2: ICP completeness (count of non-null extracted fields)
  const icp = input.classification.icp_extracted;
  const filledFields = [icp.industry, icp.company_size, icp.stage, icp.role, icp.geography].filter(v => v !== null && v !== undefined).length;
  const completenessMap: Record<number, number> = { 5: 10, 4: 8, 3: 6, 2: 4, 1: 3, 0: 1 };
  const completenessScore = completenessMap[filledFields] ?? 1;
  subScores.push({ name: 'icpCompleteness', value: completenessScore, signal: `${filledFields}/5 ICP fields populated` });

  // Sub-score 3: Category confidence
  const confidenceMap: Record<string, number> = { high: 8, medium: 5, low: 3 };
  const confScore = confidenceMap[input.classification.category_confidence] ?? 5;
  subScores.push({ name: 'categoryConfidence', value: confScore, signal: `Category confidence: ${input.classification.category_confidence}` });

  const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
  return { score: clampScore(avg), subScores, confidence: 'high' };
}

// 4c: scoreDifferentiation -- Unique positioning and pricing power (weight: 0.15)
export function scoreDifferentiation(input: ScoringInput): DimensionResult {
  const subScores: SubScore[] = [];

  // Sub-score 1: Pricing model clarity
  const hasPricing = input.classification.product_signals.pricing_model && input.classification.product_signals.pricing_model.length > 0;
  subScores.push({ name: 'pricingModelClarity', value: hasPricing ? 7 : 4, signal: input.classification.product_signals.pricing_model || 'no pricing model specified' });

  // Sub-score 2: Market gaps (opportunities to differentiate)
  const gapCount = input.research.patterns.gaps?.length ?? 0;
  let gapScore: number;
  if (gapCount >= 3) { gapScore = 8; }
  else if (gapCount >= 1) { gapScore = 6; }
  else { gapScore = 4; }
  subScores.push({ name: 'marketGaps', value: gapScore, signal: `${gapCount} market gaps identified` });

  // Sub-score 3: Competitor pricing diversity (more = room to differentiate)
  const distinctPricingModels = new Set(
    input.research.competitors.map(c => c.pricingModel).filter((p): p is string => p !== null && p.length > 0)
  ).size;
  let spreadScore: number;
  if (distinctPricingModels >= 3) { spreadScore = 7; }
  else if (distinctPricingModels >= 2) { spreadScore = 5; }
  else { spreadScore = 3; }
  subScores.push({ name: 'competitorSpread', value: spreadScore, signal: `${distinctPricingModels} distinct pricing models among competitors` });

  // Sub-score 4: Traction signal (proven differentiation)
  const tractionMap: Record<string, number> = { established: 9, growing: 7, early: 5, none: 3 };
  const tractionScore = tractionMap[input.classification.product_signals.traction_level] ?? 5;
  subScores.push({ name: 'tractionSignal', value: tractionScore, signal: `Traction: ${input.classification.product_signals.traction_level}` });

  const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
  const confidence = input.research.researchQuality === 'limited' ? 'low' as const : 'medium' as const;
  return { score: clampScore(avg), subScores, confidence };
}

// 4d: scoreDistributionFit -- Scalable channel alignment (weight: 0.16)
export function scoreDistributionFit(input: ScoringInput): DimensionResult {
  const subScores: SubScore[] = [];

  // Sub-score 1: Maturity stage
  const maturityMap: Record<string, number> = { scaling: 9, launched: 7, beta: 5, mvp: 4, idea: 2 };
  const maturityScore = maturityMap[input.classification.product_signals.maturity_stage] ?? 5;
  subScores.push({ name: 'maturityStage', value: maturityScore, signal: `Maturity: ${input.classification.product_signals.maturity_stage}` });

  // Sub-score 2: Sales model alignment
  const q3Lower = input.founderAnswers.q3_distribution.toLowerCase();
  const distributionKeywords = ['self-serve', 'self serve', 'plg', 'product-led', 'product led', 'freemium', 'free trial', 'sales-led', 'sales led', 'outbound', 'inbound', 'content', 'seo', 'social', 'partnership', 'referral'];
  const founderChannels = distributionKeywords.filter(kw => q3Lower.includes(kw));
  const topCompanySalesModels = (input.research.patterns.topCompanies || [])
    .map(c => c.salesModel?.toLowerCase() || '')
    .filter(s => s.length > 0);
  // Simple match: do any founder keywords appear in any top company sales model?
  const hasModelMatch = founderChannels.length > 0 && topCompanySalesModels.some(sm =>
    founderChannels.some(fc => sm.includes(fc) || fc.includes(sm.split(/\s+/)[0]))
  );
  const modelScore = (founderChannels.length === 0 && topCompanySalesModels.length === 0) ? 5 : hasModelMatch ? 7 : 4;
  subScores.push({ name: 'salesModelMatch', value: modelScore, signal: hasModelMatch ? 'Distribution aligns with market leaders' : 'Distribution model differs from market leaders or insufficient data' });

  // Sub-score 3: Free tier prevalence (PLG-friendly market signal)
  const competitorsWithFreeTierData = input.research.competitors.filter(c => c.freeTier !== null);
  let freeTierScore: number;
  if (competitorsWithFreeTierData.length === 0) {
    freeTierScore = 5;
  } else {
    const freeTierPct = competitorsWithFreeTierData.filter(c => c.freeTier === true).length / competitorsWithFreeTierData.length;
    if (freeTierPct >= 0.6) { freeTierScore = 8; }
    else if (freeTierPct >= 0.3) { freeTierScore = 6; }
    else { freeTierScore = 4; }
  }
  subScores.push({ name: 'freeTierPrevalence', value: freeTierScore, signal: `${competitorsWithFreeTierData.filter(c => c.freeTier).length}/${competitorsWithFreeTierData.length} competitors offer free tier` });

  const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
  const confidence = input.research.researchQuality === 'limited' ? 'low' as const : 'medium' as const;
  return { score: clampScore(avg), subScores, confidence };
}

// 4e: scoreProblemSeverity -- How painful is the problem being solved? (weight: 0.14)
export function scoreProblemSeverity(input: ScoringInput): DimensionResult {
  const subScores: SubScore[] = [];

  // Sub-score 1: Complaint intensity (highest complaint percentage)
  const topComplaintPct = input.research.complaints
    .map(c => c.percentage)
    .filter((p): p is number => p !== null)
    .sort((a, b) => b - a)[0] ?? null;
  let intensityScore: number;
  if (topComplaintPct === null) {
    intensityScore = 5;
  } else if (topComplaintPct >= 30) {
    intensityScore = 9;
  } else if (topComplaintPct >= 20) {
    intensityScore = 7;
  } else if (topComplaintPct >= 10) {
    intensityScore = 5;
  } else {
    intensityScore = 3;
  }
  subScores.push({ name: 'complaintIntensity', value: intensityScore, signal: topComplaintPct !== null ? `Top complaint: ${topComplaintPct}%` : 'No complaint data' });

  // Sub-score 2: Complaint breadth
  const complaintCount = input.research.complaints.length;
  let breadthScore: number;
  if (complaintCount >= 5) { breadthScore = 8; }
  else if (complaintCount >= 3) { breadthScore = 6; }
  else if (complaintCount >= 1) { breadthScore = 4; }
  else { breadthScore = 3; }
  subScores.push({ name: 'complaintBreadth', value: breadthScore, signal: `${complaintCount} complaint themes identified` });

  // Sub-score 3: Traction as severity proxy
  const tractionMap: Record<string, number> = { established: 9, growing: 7, early: 5, none: 3 };
  const tractionScore = tractionMap[input.classification.product_signals.traction_level] ?? 5;
  subScores.push({ name: 'tractionAsProxy', value: tractionScore, signal: `Traction: ${input.classification.product_signals.traction_level}` });

  const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
  const confidence = (input.research.researchQuality === 'limited' || input.research.complaints.length < 2) ? 'low' as const : 'medium' as const;
  return { score: clampScore(avg), subScores, confidence };
}

// 4f: scoreCompetitivePosition -- Market dynamics and moat strength (weight: 0.14)
export function scoreCompetitivePosition(input: ScoringInput): DimensionResult {
  const subScores: SubScore[] = [];

  // Sub-score 1: Competitor quality (G2 ratings -- higher ratings = tougher but validated)
  const ratings = input.research.competitors
    .map(c => c.g2Rating)
    .filter((r): r is number => r !== null);
  let qualityScore: number;
  if (ratings.length === 0) {
    qualityScore = 5;
  } else {
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    if (avgRating >= 4.5) { qualityScore = 5; }
    else if (avgRating >= 4.0) { qualityScore = 6; }
    else if (avgRating >= 3.5) { qualityScore = 7; }
    else { qualityScore = 8; }
  }
  subScores.push({ name: 'competitorQuality', value: qualityScore, signal: ratings.length > 0 ? `Avg competitor G2: ${(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)}` : 'No G2 data' });

  // Sub-score 2: Competitor funding levels
  const fundingValues = input.research.competitors
    .map(c => parseFunding(c.funding))
    .filter((f): f is number => f !== null);
  let fundingScore: number;
  if (fundingValues.length === 0) {
    fundingScore = 5;
  } else {
    const avgFunding = fundingValues.reduce((a, b) => a + b, 0) / fundingValues.length;
    if (avgFunding >= 100_000_000) { fundingScore = 3; }
    else if (avgFunding >= 10_000_000) { fundingScore = 5; }
    else { fundingScore = 7; }
  }
  subScores.push({ name: 'competitorFunding', value: fundingScore, signal: fundingValues.length > 0 ? `Avg competitor funding: $${(fundingValues.reduce((a, b) => a + b, 0) / fundingValues.length / 1_000_000).toFixed(1)}M` : 'No funding data' });

  // Sub-score 3: Market concentration
  const compCount = input.research.competitors.length;
  let concentrationScore: number;
  if (compCount === 0) { concentrationScore = 5; }
  else if (compCount <= 2) { concentrationScore = 4; }
  else if (compCount <= 5) { concentrationScore = 7; }
  else { concentrationScore = 6; }
  subScores.push({ name: 'marketConcentration', value: concentrationScore, signal: `${compCount} competitors in market` });

  // Sub-score 4: Positioning clarity from patterns
  const hasPositioningData = (input.research.patterns.topCompanies || []).some(c => c.positioning !== null && c.positioning.length > 0);
  subScores.push({ name: 'positioningClarity', value: hasPositioningData ? 6 : 4, signal: hasPositioningData ? 'Market has clear positioning patterns' : 'No positioning data available' });

  const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
  const confidence = input.research.researchQuality === 'limited' ? 'low' as const : 'medium' as const;
  return { score: clampScore(avg), subScores, confidence };
}

// 4g: scoreTrustAndProof -- Social proof, reviews, and market validation (weight: 0.08)
export function scoreTrustAndProof(input: ScoringInput): DimensionResult {
  const subScores: SubScore[] = [];

  // Sub-score 1: Review volume (market engagement)
  const totalReviews = input.research.competitors
    .map(c => c.reviewCount)
    .filter((r): r is number => r !== null)
    .reduce((a, b) => a + b, 0);
  let volumeScore: number;
  if (totalReviews >= 10000) { volumeScore = 8; }
  else if (totalReviews >= 1000) { volumeScore = 6; }
  else if (totalReviews >= 100) { volumeScore = 4; }
  else { volumeScore = 3; }
  subScores.push({ name: 'reviewVolume', value: volumeScore, signal: `${totalReviews} total competitor reviews` });

  // Sub-score 2: Maturity as trust proxy
  const maturityMap: Record<string, number> = { scaling: 9, launched: 7, beta: 5, mvp: 3, idea: 2 };
  const maturityScore = maturityMap[input.classification.product_signals.maturity_stage] ?? 5;
  subScores.push({ name: 'maturityProof', value: maturityScore, signal: `Maturity: ${input.classification.product_signals.maturity_stage}` });

  // Sub-score 3: Traction as trust proof
  const tractionMap: Record<string, number> = { established: 9, growing: 7, early: 4, none: 2 };
  const tractionScore = tractionMap[input.classification.product_signals.traction_level] ?? 5;
  subScores.push({ name: 'tractionProof', value: tractionScore, signal: `Traction: ${input.classification.product_signals.traction_level}` });

  const avg = subScores.reduce((sum, s) => sum + s.value, 0) / subScores.length;
  return { score: clampScore(avg), subScores, confidence: 'medium' };
}

// ============================================================================
// Section 5: Final Score Computation
// ============================================================================

export function computeFinalScore(dimensions: DimensionScores): { rawWeightedSum: number; finalScore: number } {
  let rawWeightedSum = 0;
  for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    rawWeightedSum += dimensions[key as keyof DimensionScores].score * weight;
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
  { max: 35, stage: 'pre_pmf' as const },
  { max: 60, stage: 'approaching' as const },
  { max: 80, stage: 'early_pmf' as const },
  { max: 100, stage: 'strong' as const },
] as const;

export function deriveStage(finalScore: number): 'pre_pmf' | 'approaching' | 'early_pmf' | 'strong' {
  for (const { max, stage } of STAGE_THRESHOLDS) {
    if (finalScore <= max) return stage;
  }
  return 'strong';
}

// ============================================================================
// Section 7: Break Identification with Q4 Cross-Reference
// ============================================================================

const PROBLEM_TYPE_TO_DIMENSION: Record<string, string> = {
  acquisition: 'demand',
  retention: 'problemSeverity',
  activation: 'distributionFit',
  monetization: 'differentiation',
  positioning: 'competitivePosition',
};

export function identifyBreaks(
  dimensions: DimensionScores,
  problemType: string,
): {
  primaryBreak: string;
  secondaryBreak: string;
  founderMismatch: boolean;
  founderIdentifiedDimension: string | null;
} {
  // Sort by score ASC, then weight DESC for tie-breaking, then key ASC for determinism
  const sorted = Object.entries(dimensions)
    .map(([key, result]) => ({ key, score: result.score, weight: DIMENSION_WEIGHTS[key] }))
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

function assembleScoringInput(assessment: any): ScoringInput {
  const classification = assessment.classificationData as any;
  const research = assessment.researchData as any;
  const responses = assessment.responses as Array<{
    questionOrder: number;
    answerText: string | null;
    answerValue: string | null;
  }>;

  // Map responses to founder answers by questionOrder
  const getAnswer = (order: number): string => {
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
      likely_competitors: classification.likely_competitors || [],
    },
    research: {
      competitors: (research.competitors || []).map((c: any) => ({
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
      complaints: (research.complaints || []).map((c: any) => ({
        theme: c.theme,
        percentage: c.percentage ?? null,
      })),
      patterns: {
        topCompanies: research.patterns?.topCompanies ?? null,
        gaps: research.patterns?.gaps ?? null,
      },
      researchQuality: research.researchQuality || 'limited',
    },
    founderAnswers: {
      q1_product: getAnswer(1),
      q2_valueSignal: getAnswer(2),
      q3_distribution: q3Answer,
      q4_substitute: getAnswer(4),
      q5_biggestRisk: getAnswer(5),
    },
  };
}

// ============================================================================
// Section 9: Benchmark Computation
// ============================================================================

const BENCHMARK_MIN_SAMPLE = 5;
const BENCHMARK_DEFAULT = 70;

function computeDimensionAverages(assessments: any[]): Record<string, number> {
  const benchmarks: Record<string, number> = {};
  for (const key of Object.keys(DIMENSION_WEIGHTS)) {
    const scores = assessments
      .map((a: any) => (a.scoreData as any)?.dimensions?.[key]?.score)
      .filter((s: any): s is number => typeof s === 'number');
    benchmarks[key] = scores.length > 0
      ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10)
      : BENCHMARK_DEFAULT;
  }
  return benchmarks;
}

async function computeBenchmarks(
  category: string,
  subCategory: string,
): Promise<{ benchmarks: Record<string, number>; meta: { source: 'category_subcategory' | 'category_only' | 'default'; sampleSize: number } }> {
  // Fetch assessments that have scoreData
  const assessments = await prisma.assessment.findMany({
    where: {
      scoreData: { not: null as any },
      classificationData: { not: null as any },
    },
    select: { classificationData: true, scoreData: true },
  });

  // Filter by category + sub_category (application-level -- Prisma JSON AND is limited)
  const exactMatches = assessments.filter((a: any) => {
    const cd = a.classificationData as any;
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
  const categoryMatches = assessments.filter((a: any) => {
    const cd = a.classificationData as any;
    return cd?.category === category;
  });

  if (categoryMatches.length >= BENCHMARK_MIN_SAMPLE) {
    return {
      benchmarks: computeDimensionAverages(categoryMatches),
      meta: { source: 'category_only', sampleSize: categoryMatches.length },
    };
  }

  // Default: 70 per dimension
  const defaults: Record<string, number> = {};
  for (const key of Object.keys(DIMENSION_WEIGHTS)) {
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

export async function scoreAssessment(assessmentId: string): Promise<ScoreData> {
  // 1. Fetch assessment with all data needed for scoring
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { responses: { orderBy: { questionOrder: 'asc' } } },
  });
  if (!assessment) throw new NotFoundError('Assessment not found');

  // 2. Validate prerequisites
  if (!assessment.classificationData) {
    throw new ValidationError('Assessment must be classified before scoring');
  }
  if (!assessment.researchData) {
    throw new ValidationError('Assessment must have research data before scoring');
  }

  // 3. Assemble scoring input (pure data object from DB data)
  const input = assembleScoringInput(assessment);

  // 4. Score all 7 dimensions (pure functions, no side effects)
  const dimensions: DimensionScores = {
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
  const { benchmarks, meta: benchmarkMeta } = await computeBenchmarks(
    input.classification.category,
    input.classification.sub_category,
  );

  // 9. Assemble scoreData
  const scoreData: ScoreData = {
    dimensions,
    weights: { ...DIMENSION_WEIGHTS },
    rawWeightedSum,
    finalScore,
    pmfStage,
    ...breaks,
    benchmarks,
    benchmarkMeta,
    scoredAt: new Date().toISOString(),
  };

  // 10. Validate with Zod
  const validated = scoreDataSchema.safeParse(scoreData);
  if (!validated.success) {
    throw new ValidationError(`Score data failed validation: ${validated.error.message}`);
  }

  // 11. Store in assessment
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { scoreData: validated.data as any },
  });

  return validated.data;
}
