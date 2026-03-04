import { callOpenAIWebSearch } from './ai.service';
import { zodTextFormat } from 'openai/helpers/zod';
import {
  competitorExtractionSchema,
  marketExtractionSchema,
  complaintExtractionSchema,
  patternExtractionSchema,
  researchOutputSchema,
  type ResearchOutput,
  type Competitor,
  type MarketData,
  type Complaint,
  type Pattern,
} from '../schemas/research.schema';
import { prisma } from '../db/prisma';
import { AIError, NotFoundError, ValidationError } from '../errors';

// ============================================================================
// Per-dimension search functions (single-step: web search + structured parse combined)
// Each catches errors and returns empty/null defaults -- never throws.
// ============================================================================

/**
 * Search for competitors in the given category using web search,
 * then parse results into structured data with zodTextFormat.
 */
async function searchCompetitors(
  category: string,
  subCategory: string,
  searchQueries: string[],
  assessmentId: string,
): Promise<Competitor[]> {
  try {
    const result = await callOpenAIWebSearch({
      assessmentId,
      promptName: 'research_competitors',
      input: `Find the top competitors in the "${category}" / "${subCategory}" market. For each, find: company name, G2 rating (number out of 5), G2 review count, total funding raised, pricing model (freemium/subscription/usage-based/etc), whether they have a free tier (yes/no), and a one-line tagline. Include source URLs. Use null for any field not found. Never invent or estimate data. Return only competitors explicitly mentioned. Base search terms: ${searchQueries.slice(0, 3).join(', ')}`,
      searchContextSize: 'medium',
      textFormat: zodTextFormat(competitorExtractionSchema, 'competitor_extraction'),
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.outputText);
    return parsed.competitors;
  } catch {
    return [];
  }
}

/**
 * Search for market size data (TAM, SAM, growth rate, regions).
 * Uses high search context size for dense market research results.
 */
async function searchMarketData(
  category: string,
  subCategory: string,
  searchQueries: string[],
  assessmentId: string,
): Promise<MarketData> {
  try {
    const result = await callOpenAIWebSearch({
      assessmentId,
      promptName: 'research_market',
      input: `Find market size data for the "${category}" / "${subCategory}" market. Include: Total Addressable Market (TAM), Serviceable Addressable Market (SAM), annual growth rate or CAGR, and major regional market shares/splits. Look for recent market research reports and analyst estimates. Use null for any field not found. Never invent or estimate data. Base search terms: ${searchQueries.slice(0, 3).join(', ')}`,
      searchContextSize: 'medium',
      textFormat: zodTextFormat(marketExtractionSchema, 'market_extraction'),
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.outputText);
    return parsed.market;
  } catch {
    return { tam: null, sam: null, growthRate: null, regions: null };
  }
}

/**
 * Search for common complaints and pain points from review sites.
 */
async function searchComplaints(
  category: string,
  subCategory: string,
  searchQueries: string[],
  assessmentId: string,
): Promise<Complaint[]> {
  try {
    const result = await callOpenAIWebSearch({
      assessmentId,
      promptName: 'research_complaints',
      input: `Find the top complaints and pain points in the "${category}" / "${subCategory}" market. Look at G2 reviews, Capterra reviews, Reddit threads, and Trustpilot. Identify 4-6 major complaint themes and estimate what percentage of complaints each theme represents. Use null for any field not found. Never invent or estimate data. Base search terms: ${searchQueries.slice(0, 3).join(', ')}`,
      searchContextSize: 'medium',
      textFormat: zodTextFormat(complaintExtractionSchema, 'complaint_extraction'),
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.outputText);
    return parsed.complaints;
  } catch {
    return [];
  }
}

/**
 * Search for sales/positioning patterns and market gaps.
 */
async function searchPatterns(
  category: string,
  subCategory: string,
  searchQueries: string[],
  assessmentId: string,
): Promise<Pattern> {
  try {
    const result = await callOpenAIWebSearch({
      assessmentId,
      promptName: 'research_patterns',
      input: `Analyze the sales and positioning patterns in the "${category}" / "${subCategory}" market. For the top 3 companies, identify: their sales model (self-serve, sales-led, PLG, hybrid), their positioning language/value prop, and identify market gaps or underserved segments. Use null for any field not found. Never invent or estimate data. Base search terms: ${searchQueries.slice(0, 3).join(', ')}`,
      searchContextSize: 'medium',
      textFormat: zodTextFormat(patternExtractionSchema, 'pattern_extraction'),
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.outputText);
    return parsed.patterns;
  } catch {
    return { topCompanies: null, gaps: null };
  }
}

// ============================================================================
// Main research orchestrator
// ============================================================================

/**
 * Run the full research pipeline for an assessment.
 *
 * 1. Validates assessment exists and is classified (status: completed)
 * 2. Checks ResearchCache for cached results (7-day TTL)
 * 3. Runs 4 parallel web search dimensions (competitors, market, complaints, patterns)
 * 4. Validates output with Zod, determines research quality
 * 5. Stores in cache and on assessment.researchData
 */
export async function runResearch(
  assessmentId: string,
  forceRefresh: boolean = false,
): Promise<ResearchOutput> {
  // 1. Fetch assessment
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
  });
  if (!assessment) {
    throw new NotFoundError(`Assessment ${assessmentId} not found`);
  }

  // 2. Validate status -- must be completed (post-classification)
  if (assessment.status !== 'completed') {
    throw new ValidationError('Assessment must be completed (classified) before research');
  }

  // 3. Extract classification data
  const classification = assessment.classificationData as any;
  if (!classification?.category || !classification?.sub_category) {
    throw new ValidationError('Assessment must be classified before research');
  }
  const { category, sub_category: subCategory, search_queries: searchQueries } = classification;

  // 4. Normalize cache keys
  const cacheKey = {
    category: (category as string).toLowerCase().trim(),
    subCategory: (subCategory as string).toLowerCase().trim(),
  };

  // 5. Check cache (unless forceRefresh)
  if (!forceRefresh) {
    const cached = await prisma.researchCache.findUnique({
      where: { category_subCategory: cacheKey },
    });
    if (cached && cached.expiresAt > new Date()) {
      const cachedData = cached.data as any;
      // Update assessment with cached snapshot
      await prisma.assessment.update({
        where: { id: assessmentId },
        data: { researchData: cached.data as any },
      });
      // Return with cache metadata
      return {
        ...cachedData,
        metadata: {
          totalDurationMs: 0,
          callCount: 0,
          cachedHit: true,
          researchedAt: cached.createdAt.toISOString(),
        },
      } as ResearchOutput;
    }
  }

  // 6. Run all 4 search dimensions in parallel
  const start = Date.now();
  const [competitors, market, complaints, patterns] = await Promise.all([
    searchCompetitors(category, subCategory, searchQueries || [], assessmentId),
    searchMarketData(category, subCategory, searchQueries || [], assessmentId),
    searchComplaints(category, subCategory, searchQueries || [], assessmentId),
    searchPatterns(category, subCategory, searchQueries || [], assessmentId),
  ]);
  const totalDurationMs = Date.now() - start;

  // 7. Determine research quality
  const researchQuality =
    competitors.length < 3 || !market.tam ? ('limited' as const) : ('sufficient' as const);

  // 8. Build the output object
  const researchOutput: ResearchOutput = {
    competitors,
    market,
    complaints,
    patterns,
    researchQuality,
    metadata: {
      totalDurationMs,
      callCount: 4, // 4 dimensions x 1 call each (search + parse combined)
      cachedHit: false,
      researchedAt: new Date().toISOString(),
    },
  };

  // 9. Validate with Zod
  const validated = researchOutputSchema.safeParse(researchOutput);
  if (!validated.success) {
    throw new AIError(`Research output failed validation: ${validated.error.message}`);
  }

  // 10. Store in cache with 7-day TTL
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.researchCache.upsert({
    where: { category_subCategory: cacheKey },
    update: { data: validated.data as any, expiresAt },
    create: { ...cacheKey, data: validated.data as any, expiresAt },
  });

  // 11. Store snapshot on assessment
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { researchData: validated.data as any },
  });

  // 12. Return validated data
  return validated.data;
}
