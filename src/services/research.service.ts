import { callOpenAIWebSearch } from './ai.service';
import { env } from '../config/env';
import { zodTextFormat } from 'openai/helpers/zod';
import {
  competitorExtractionSchema,
  marketExtractionSchema,
  complaintExtractionSchema,
  patternExtractionSchema,
  researchOutputSchema,
  type ResearchOutput,
  type ResearchQuality,
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
      model: env.OPENAI_RESEARCH_MODEL,
      input: `Find the top competitors in the "${category}" / "${subCategory}" market. For each competitor, provide:
- Company name (official name)
- G2 rating as a decimal number (e.g., 4.5). Return null if not found on G2.
- G2 review count as an integer. Return null if not found.
- Total funding raised as a dollar string (e.g., '$50M Series B', '$1.2B'). Return null if not found.
- Pricing model as specific text (e.g., 'freemium, paid from $29/mo', 'usage-based starting at $0.01/request'). Return null if not found.
- Whether they have a free tier (true/false). Return null if unclear.
- A one-line tagline from their website.
- Source URL where you found the data.

CRITICAL: Only include competitors that actually appear in search results. Never invent companies. Use null for any field where data was not explicitly found. Base search terms: ${searchQueries.slice(0, 3).join(', ')}`,
      searchContextSize: 'high',
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
      model: env.OPENAI_RESEARCH_MODEL,
      input: `Find market size data for the "${category}" / "${subCategory}" market. Provide:
- Total Addressable Market (TAM) as a dollar amount with multiplier (e.g., '$4.2B', '$850M'). Return null if no reliable data.
- Serviceable Addressable Market (SAM) as a dollar amount with multiplier. Return null if no reliable data.
- Annual growth rate as 'X.X% CAGR' format (e.g., '12.5% CAGR'). Return null if no reliable data.
- Major regional market shares/splits.

Look for recent market research reports and analyst estimates (Grand View Research, Mordor Intelligence, Fortune Business Insights, Gartner, etc.). Use null for any field not found. Never invent or estimate data. Base search terms: ${searchQueries.slice(0, 3).join(', ')}`,
      searchContextSize: 'high',
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
      model: env.OPENAI_RESEARCH_MODEL,
      input: `Find the top complaints and pain points in the "${category}" / "${subCategory}" market.
Source from G2 reviews, Capterra reviews, Reddit threads, and Trustpilot.
Identify 4-6 major complaint themes. For each theme:
- Return the theme description
- Return the source URL where you found this complaint
- Set percentage to null (do NOT estimate percentages)

CRITICAL: Only report complaints that are explicitly mentioned in search results. Do NOT estimate or fabricate complaint percentages. Set percentage to null for every complaint. Base search terms: ${searchQueries.slice(0, 3).join(', ')}`,
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
      model: env.OPENAI_RESEARCH_MODEL,
      input: `Analyze the sales and positioning patterns in the "${category}" / "${subCategory}" market. For the top 3 companies, identify:
- Company name
- Sales model (self-serve, sales-led, PLG, hybrid, etc.)
- Positioning language / value prop
- Source URL where you found this information

Also identify market gaps or underserved segments.

CRITICAL: Only report companies and patterns from search results. Use null for any field not found. Never invent or estimate data. Base search terms: ${searchQueries.slice(0, 3).join(', ')}`,
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
// Research quality computation
// ============================================================================

function computeResearchQuality(
  competitors: Competitor[],
  market: MarketData,
  complaints: Complaint[],
): ResearchQuality {
  const competitorCount = competitors.length;
  const hasMarketData = market.tam !== null;
  const complaintCount = complaints.length;

  let overall: ResearchQuality['overall'];
  if (competitorCount === 0 && !hasMarketData) {
    overall = 'minimal';
  } else if (competitorCount < 3 || !hasMarketData) {
    overall = 'thin';
  } else if (competitorCount >= 5 && hasMarketData && complaintCount >= 3) {
    overall = 'rich';
  } else {
    overall = 'sufficient';
  }

  return { overall, competitorCount, hasMarketData, complaintCount };
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
 * 5. Single targeted retry when quality is 'minimal' (0 competitors AND no TAM)
 * 6. Stores in cache and on assessment.researchData
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
  let [competitors, market, complaints, patterns] = await Promise.all([
    searchCompetitors(category, subCategory, searchQueries || [], assessmentId),
    searchMarketData(category, subCategory, searchQueries || [], assessmentId),
    searchComplaints(category, subCategory, searchQueries || [], assessmentId),
    searchPatterns(category, subCategory, searchQueries || [], assessmentId),
  ]);

  // 7. Determine research quality
  let researchQuality = computeResearchQuality(competitors, market, complaints);
  let callCount = 4;

  // 8. Targeted retry when quality is 'minimal' (0 competitors AND no TAM)
  if (researchQuality.overall === 'minimal') {
    // Retry both weakest dimensions with reformulated queries
    if (competitors.length === 0) {
      const retried = await searchCompetitors(
        category, subCategory,
        [`top ${subCategory} software companies`, `${category} ${subCategory} alternatives`, `best ${subCategory} tools`],
        assessmentId,
      );
      if (retried.length > 0) competitors = retried;
      callCount++;
    }
    if (!market.tam) {
      const retried = await searchMarketData(
        category, subCategory,
        [`${subCategory} market size 2024 2025`, `${category} TAM report`, `${subCategory} industry revenue`],
        assessmentId,
      );
      if (retried.tam) market = retried;
      callCount++;
    }
    researchQuality = computeResearchQuality(competitors, market, complaints);
  } else if (researchQuality.overall === 'thin') {
    // Thin: try to fill the weakest gap
    if (competitors.length < 3) {
      const retried = await searchCompetitors(
        category, subCategory,
        [`${subCategory} alternatives comparison`, `top ${category} companies list`],
        assessmentId,
      );
      if (retried.length > competitors.length) competitors = retried;
      callCount++;
    }
    researchQuality = computeResearchQuality(competitors, market, complaints);
  }

  const totalDurationMs = Date.now() - start;

  // 9. Build the output object
  const researchOutput: ResearchOutput = {
    competitors,
    market,
    complaints,
    patterns,
    researchQuality,
    metadata: {
      totalDurationMs,
      callCount,
      cachedHit: false,
      researchedAt: new Date().toISOString(),
    },
  };

  // 10. Validate with Zod
  const validated = researchOutputSchema.safeParse(researchOutput);
  if (!validated.success) {
    throw new AIError(`Research output failed validation: ${validated.error.message}`);
  }

  // 11. Store in cache with 7-day TTL
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.researchCache.upsert({
    where: { category_subCategory: cacheKey },
    update: { data: validated.data as any, expiresAt },
    create: { ...cacheKey, data: validated.data as any, expiresAt },
  });

  // 12. Store snapshot on assessment
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { researchData: validated.data as any },
  });

  // 13. Return validated data
  return validated.data;
}
