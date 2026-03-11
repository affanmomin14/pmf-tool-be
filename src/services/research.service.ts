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
import { logger } from '../config/logger';

// ============================================================================
// Context interface -- rich context passed to every search function
// ============================================================================

interface ResearchContext {
  category: string;
  subCategory: string;
  searchQueries: string[];
  likelyCompetitors: string[];
  productDescription: string;
  icpDescription: string;
  distributionModel: string;
  tractionSummary: string;
  assessmentId: string;
}

// ============================================================================
// Per-dimension search functions
// Each catches errors and returns empty/null defaults -- never throws.
// ============================================================================

async function searchCompetitors(
  ctx: ResearchContext,
): Promise<Competitor[]> {
  try {
    const competitorHints = ctx.likelyCompetitors.length > 0
      ? `\nKnown competitors to research (verify and enrich these): ${ctx.likelyCompetitors.join(', ')}`
      : '';

    const result = await callOpenAIWebSearch({
      assessmentId: ctx.assessmentId,
      promptName: 'research_competitors',
      model: env.OPENAI_RESEARCH_MODEL,
      input: `Find the top competitors in the "${ctx.category}" / "${ctx.subCategory}" market.

Product context: "${ctx.productDescription}"
Target customers: "${ctx.icpDescription}"
${competitorHints}

For each competitor, provide:
- Company name (official name)
- G2 rating as a decimal number (e.g., 4.5). Search G2.com specifically. Return null if not found on G2.
- G2 review count as an integer. Return null if not found.
- Total funding raised as a dollar string (e.g., '$50M Series B', '$1.2B'). Search Crunchbase or similar. Return null if not found.
- Pricing model as specific text (e.g., 'freemium, paid from $29/mo', 'usage-based starting at $0.01/request'). Check their pricing page. Return null if not found.
- Whether they have a free tier (true/false). Return null if unclear.
- A one-line tagline from their website.
- Source URL where you found the data.

IMPORTANT: Search for at least 5-8 competitors. Look on G2, Capterra, and industry comparison articles.
Search terms to use: ${ctx.searchQueries.slice(0, 3).join(', ')}
Additional searches: "best ${ctx.subCategory} software", "top ${ctx.category} tools", "${ctx.subCategory} G2 grid"

CRITICAL: Only include competitors that actually appear in search results. Never invent companies. Use null for any field where data was not explicitly found.`,
      searchContextSize: 'high',
      textFormat: zodTextFormat(competitorExtractionSchema, 'competitor_extraction'),
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.outputText);
    logger.info(`[research] Competitors found: ${parsed.competitors?.length ?? 0} for ${ctx.category}/${ctx.subCategory}`);
    return parsed.competitors;
  } catch (err) {
    logger.error(`[research] searchCompetitors failed for ${ctx.category}/${ctx.subCategory}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

async function searchMarketData(
  ctx: ResearchContext,
): Promise<MarketData> {
  try {
    const result = await callOpenAIWebSearch({
      assessmentId: ctx.assessmentId,
      promptName: 'research_market',
      model: env.OPENAI_RESEARCH_MODEL,
      input: `Find market size data for the "${ctx.category}" / "${ctx.subCategory}" market.

Product context: "${ctx.productDescription}"
Target customers: "${ctx.icpDescription}"

Provide:
- Total Addressable Market (TAM) as a dollar amount with multiplier (e.g., '$4.2B', '$850M'). Return null if no reliable data.
- Serviceable Addressable Market (SAM) as a dollar amount. SAM is the portion of TAM reachable by this specific product given its ICP: "${ctx.icpDescription}". If an exact SAM figure is not in reports, look for the specific segment size (e.g., "enterprise BI market" or "no-code analytics market") as a proxy. Return null only if absolutely nothing relevant can be found.
- Annual growth rate as 'X.X% CAGR' format (e.g., '12.5% CAGR'). Return null if no reliable data.
- Regional market breakdown: Search for geographic revenue splits. Provide at least 3-4 regions (North America, Europe, Asia-Pacific, Rest of World). For each region provide the percentage share of the global market. Search specifically for "${ctx.subCategory} market share by region" and "${ctx.category} revenue by geography".

IMPORTANT: Search multiple sources. Try these specific searches:
1. "${ctx.subCategory} market size 2024 2025 2026"
2. "${ctx.category} market growth rate CAGR"
3. "${ctx.subCategory} market size by region geography"
4. "${ctx.category} industry revenue forecast regional breakdown"
5. "${ctx.subCategory} serviceable addressable market ${ctx.icpDescription}"

Look for recent market research reports from: Grand View Research, Mordor Intelligence, Fortune Business Insights, Gartner, MarketsandMarkets, Statista, IBISWorld, Precedence Research.

If exact ${ctx.subCategory} data is not found, look for the broader ${ctx.category} market data as a proxy.

Use null for any field not found. Never invent or estimate data.`,
      searchContextSize: 'high',
      textFormat: zodTextFormat(marketExtractionSchema, 'market_extraction'),
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.outputText);
    logger.info(`[research] Market data found: TAM=${parsed.market?.tam ?? 'null'}, growth=${parsed.market?.growthRate ?? 'null'}`);
    return parsed.market;
  } catch (err) {
    logger.error(`[research] searchMarketData failed for ${ctx.category}/${ctx.subCategory}: ${err instanceof Error ? err.message : String(err)}`);
    return { tam: null, sam: null, growthRate: null, regions: null };
  }
}

async function searchComplaints(
  ctx: ResearchContext,
): Promise<Complaint[]> {
  try {
    const competitorNames = ctx.likelyCompetitors.length > 0
      ? `\nSearch for complaints about these specific companies: ${ctx.likelyCompetitors.slice(0, 5).join(', ')}`
      : '';

    const result = await callOpenAIWebSearch({
      assessmentId: ctx.assessmentId,
      promptName: 'research_complaints',
      model: env.OPENAI_RESEARCH_MODEL,
      input: `Find the top complaints and pain points in the "${ctx.category}" / "${ctx.subCategory}" market.
${competitorNames}

Source from G2 reviews, Capterra reviews, Reddit threads, Trustpilot, and Product Hunt comments.

IMPORTANT: Search for specific complaints using these queries:
1. "${ctx.subCategory} problems complaints reddit"
2. "${ctx.subCategory} software frustrations G2 reviews"
3. "worst things about ${ctx.subCategory} tools"
4. "${ctx.likelyCompetitors.length > 0 ? ctx.likelyCompetitors[0] + ' complaints reviews' : ctx.category + ' user complaints'}"

Identify 4-6 major complaint themes. For each theme:
- Return the theme description (be specific, e.g., "Steep learning curve requiring weeks of training" not just "Hard to use")
- Return the source URL where you found this complaint
- Set percentage to null (do NOT estimate percentages)

CRITICAL: Only report complaints that are explicitly mentioned in search results. Do NOT estimate or fabricate complaint percentages. Set percentage to null for every complaint.`,
      searchContextSize: 'medium',
      textFormat: zodTextFormat(complaintExtractionSchema, 'complaint_extraction'),
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.outputText);
    logger.info(`[research] Complaints found: ${parsed.complaints?.length ?? 0}`);
    return parsed.complaints;
  } catch (err) {
    logger.error(`[research] searchComplaints failed for ${ctx.category}/${ctx.subCategory}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

async function searchPatterns(
  ctx: ResearchContext,
): Promise<Pattern> {
  try {
    const competitorHints = ctx.likelyCompetitors.length > 0
      ? `\nAnalyze these companies specifically: ${ctx.likelyCompetitors.slice(0, 5).join(', ')}`
      : '';

    const result = await callOpenAIWebSearch({
      assessmentId: ctx.assessmentId,
      promptName: 'research_patterns',
      model: env.OPENAI_RESEARCH_MODEL,
      input: `Analyze the sales and positioning patterns in the "${ctx.category}" / "${ctx.subCategory}" market.
${competitorHints}

Product context: "${ctx.productDescription}"
Current distribution: "${ctx.distributionModel}"

For the top 3-5 companies in this space, identify:
- Company name
- Sales model (self-serve, sales-led, PLG, hybrid, partner/channel, marketplace, etc.)
- Positioning language / value prop (exact tagline from their website if possible)
- Source URL where you found this information

Also identify 2-4 market gaps or underserved segments that a new entrant could target.

IMPORTANT: Search using these queries:
1. "how ${ctx.likelyCompetitors.length > 0 ? ctx.likelyCompetitors[0] : ctx.subCategory + ' companies'} sells pricing model"
2. "${ctx.subCategory} go-to-market strategy"
3. "${ctx.subCategory} underserved segments market gaps"

CRITICAL: Only report companies and patterns from search results. Use null for any field not found.`,
      searchContextSize: 'medium',
      textFormat: zodTextFormat(patternExtractionSchema, 'pattern_extraction'),
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.outputText);
    logger.info(`[research] Patterns found: ${parsed.patterns?.topCompanies?.length ?? 0} companies, ${parsed.patterns?.gaps?.length ?? 0} gaps`);
    return parsed.patterns;
  } catch (err) {
    logger.error(`[research] searchPatterns failed for ${ctx.category}/${ctx.subCategory}: ${err instanceof Error ? err.message : String(err)}`);
    return { topCompanies: null, gaps: null };
  }
}

// ============================================================================
// Fallback: seed competitors from classification's likely_competitors
// When web search returns 0 competitors, use classification data as baseline
// ============================================================================

async function seedCompetitorsFromClassification(
  ctx: ResearchContext,
): Promise<Competitor[]> {
  if (ctx.likelyCompetitors.length === 0) return [];

  try {
    const competitorList = ctx.likelyCompetitors.slice(0, 6).join(', ');
    const result = await callOpenAIWebSearch({
      assessmentId: ctx.assessmentId,
      promptName: 'research_competitors_seed',
      model: env.OPENAI_RESEARCH_MODEL,
      input: `I need to verify and enrich data about these specific companies: ${competitorList}

These are companies in the "${ctx.category}" / "${ctx.subCategory}" market.

For EACH company listed above, search and provide:
- Company name (official name, confirm it exists)
- G2 rating as a decimal number. Search "COMPANY_NAME G2 reviews". Return null if not found.
- G2 review count as an integer. Return null if not found.
- Total funding raised. Search "COMPANY_NAME funding crunchbase". Return null if not found.
- Pricing model. Search "COMPANY_NAME pricing". Return null if not found.
- Whether they have a free tier (true/false). Return null if unclear.
- A one-line tagline from their website.
- Source URL where you found the data.

CRITICAL: Search for each company individually. Only include companies you can verify exist. Return at least basic info (name + tagline) for each verified company.`,
      searchContextSize: 'high',
      textFormat: zodTextFormat(competitorExtractionSchema, 'competitor_extraction'),
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.outputText);
    logger.info(`[research] Seeded competitors from classification: ${parsed.competitors?.length ?? 0}`);
    return parsed.competitors;
  } catch (err) {
    logger.error(`[research] seedCompetitorsFromClassification failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
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
 * 5. Multi-level retry: seed from classification, broaden queries, retry weak dimensions
 * 6. Stores in cache and on assessment.researchData
 */
export async function runResearch(
  assessmentId: string,
  forceRefresh: boolean = false,
): Promise<ResearchOutput> {
  // 1. Fetch assessment with responses and classification
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { responses: { orderBy: { questionOrder: 'asc' } } },
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
  const likelyCompetitors: string[] = classification.likely_competitors || [];

  // 4. Extract founder answers for richer context
  const getAnswer = (order: number): string => {
    const r = assessment.responses.find((r: any) => r.questionOrder === order);
    return r?.answerText || r?.answerValue || '';
  };
  const q3Response = assessment.responses.find((r: any) => r.questionOrder === 3);

  const ctx: ResearchContext = {
    category,
    subCategory,
    searchQueries: searchQueries || [],
    likelyCompetitors,
    productDescription: getAnswer(1),
    icpDescription: getAnswer(2),
    distributionModel: q3Response?.answerValue || q3Response?.answerText || '',
    tractionSummary: getAnswer(5),
    assessmentId,
  };

  // 5. Normalize cache keys
  const cacheKey = {
    category: (category as string).toLowerCase().trim(),
    subCategory: (subCategory as string).toLowerCase().trim(),
  };

  // 6. Check cache (unless forceRefresh)
  if (!forceRefresh) {
    const cached = await prisma.researchCache.findUnique({
      where: { category_subCategory: cacheKey },
    });
    if (cached && cached.expiresAt > new Date()) {
      const cachedData = cached.data as any;
      const quality = computeResearchQuality(
        cachedData.competitors || [],
        cachedData.market || { tam: null, sam: null, growthRate: null, regions: null },
        cachedData.complaints || [],
      );
      // Only use cache if it has reasonable data; otherwise re-research
      if (quality.overall !== 'minimal') {
        await prisma.assessment.update({
          where: { id: assessmentId },
          data: { researchData: cached.data as any },
        });
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
      logger.info(`[research] Cached data quality is 'minimal' — bypassing cache for ${assessmentId}`);
    }
  }

  // 7. Run all 4 search dimensions in parallel
  const start = Date.now();
  logger.info(`[research] Starting parallel searches for ${category}/${subCategory} (${likelyCompetitors.length} known competitors)`);

  let [competitors, market, complaints, patterns] = await Promise.all([
    searchCompetitors(ctx),
    searchMarketData(ctx),
    searchComplaints(ctx),
    searchPatterns(ctx),
  ]);

  // 8. Determine research quality
  let researchQuality = computeResearchQuality(competitors, market, complaints);
  let callCount = 4;

  logger.info(`[research] Initial quality: ${researchQuality.overall} (competitors=${researchQuality.competitorCount}, market=${researchQuality.hasMarketData}, complaints=${researchQuality.complaintCount})`);

  // 9. Multi-level retry strategy

  // Level 1: If 0 competitors, try seeding from classification's likely_competitors
  if (competitors.length === 0 && likelyCompetitors.length > 0) {
    logger.info(`[research] Retry L1: Seeding competitors from classification (${likelyCompetitors.length} known)`);
    const seeded = await seedCompetitorsFromClassification(ctx);
    if (seeded.length > 0) competitors = seeded;
    callCount++;
    researchQuality = computeResearchQuality(competitors, market, complaints);
  }

  // Level 2: Targeted retries for each weak dimension with broadened queries (L3-style market runs in same batch when no TAM)
  let ranL3InL2 = false;
  if (researchQuality.overall === 'minimal' || researchQuality.overall === 'thin') {
    logger.info(`[research] Retry L2: Broadened queries (quality=${researchQuality.overall})`);

    const retryPromises: Promise<void>[] = [];

    if (competitors.length < 3) {
      retryPromises.push((async () => {
        const broaderCtx = {
          ...ctx,
          searchQueries: [
            `top ${subCategory} software companies 2024 2025`,
            `${category} ${subCategory} alternatives comparison`,
            `best ${subCategory} tools G2`,
            `${subCategory} market leaders`,
          ],
        };
        const retried = await searchCompetitors(broaderCtx);
        if (retried.length > competitors.length) competitors = retried;
        callCount++;
      })());
    }

    if (!market.tam) {
      // L2: targeted market retry
      retryPromises.push((async () => {
        const broaderCtx = {
          ...ctx,
          searchQueries: [
            `${subCategory} market size 2024 2025 2026`,
            `${category} TAM report market research`,
            `${subCategory} industry revenue global`,
            `${category} market forecast CAGR`,
          ],
        };
        const retried = await searchMarketData(broaderCtx);
        if (retried.tam) market = retried;
        callCount++;
      })());
      // L3-style broader category market (run in parallel with L2 to save a round trip)
      ranL3InL2 = true;
      retryPromises.push((async () => {
        const broadCtx = {
          ...ctx,
          searchQueries: [
            `${category} software market size global`,
            `${category} industry market 2025 2026 billion`,
            `${category} market growth forecast`,
          ],
        };
        const retried = await searchMarketData(broadCtx);
        if (retried.tam && !market.tam) market = retried;
        callCount++;
      })());
    }

    if (complaints.length < 2) {
      retryPromises.push((async () => {
        const broaderCtx = {
          ...ctx,
          searchQueries: [
            `${subCategory} software problems complaints`,
            `${category} tools frustrations reddit`,
            `${likelyCompetitors.length > 0 ? likelyCompetitors[0] + ' reviews cons' : subCategory + ' reviews negative'}`,
          ],
        };
        const retried = await searchComplaints(broaderCtx);
        if (retried.length > complaints.length) complaints = retried;
        callCount++;
      })());
    }

    if (!patterns.topCompanies || patterns.topCompanies.length === 0) {
      retryPromises.push((async () => {
        const broaderCtx = {
          ...ctx,
          searchQueries: [
            `${subCategory} pricing models comparison`,
            `how ${subCategory} companies sell`,
            `${category} go-to-market strategies`,
          ],
        };
        const retried = await searchPatterns(broaderCtx);
        if (retried.topCompanies && retried.topCompanies.length > 0) patterns = retried;
        callCount++;
      })());
    }

    await Promise.all(retryPromises);
    researchQuality = computeResearchQuality(competitors, market, complaints);
    logger.info(`[research] After L2 retries: quality=${researchQuality.overall} (competitors=${researchQuality.competitorCount}, market=${researchQuality.hasMarketData})`);
  }

  // Level 3: Last resort — use broader parent category for market data (skip if already ran in L2)
  if (!market.tam && !ranL3InL2) {
    logger.info(`[research] Retry L3: Searching broader category "${category}" for market data`);
    const broadCtx = {
      ...ctx,
      searchQueries: [
        `${category} software market size global`,
        `${category} industry market 2025 2026 billion`,
        `${category} market growth forecast`,
      ],
    };
    const retried = await searchMarketData(broadCtx);
    if (retried.tam) market = retried;
    callCount++;
    researchQuality = computeResearchQuality(competitors, market, complaints);
  }

  // Level 4: If still 0 competitors, try one more time with very broad query
  if (competitors.length === 0) {
    logger.info(`[research] Retry L4: Very broad competitor search`);
    const broadCtx = {
      ...ctx,
      searchQueries: [
        `${category} software companies list`,
        `${subCategory} vendors`,
        `${category} tools market`,
      ],
    };
    const retried = await searchCompetitors(broadCtx);
    if (retried.length > 0) competitors = retried;
    callCount++;
    researchQuality = computeResearchQuality(competitors, market, complaints);
  }

  const totalDurationMs = Date.now() - start;

  logger.info(`[research] Final quality: ${researchQuality.overall} (competitors=${researchQuality.competitorCount}, market=${researchQuality.hasMarketData}, complaints=${researchQuality.complaintCount}) in ${totalDurationMs}ms with ${callCount} calls`);

  // 10. Build the output object
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

  // 11. Validate with Zod
  const validated = researchOutputSchema.safeParse(researchOutput);
  if (!validated.success) {
    throw new AIError(`Research output failed validation: ${validated.error.message}`);
  }

  // 12. Store in cache with 7-day TTL
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.researchCache.upsert({
    where: { category_subCategory: cacheKey },
    update: { data: validated.data as any, expiresAt },
    create: { ...cacheKey, data: validated.data as any, expiresAt },
  });

  // 13. Store snapshot on assessment
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { researchData: validated.data as any },
  });

  // 14. Return validated data
  return validated.data;
}
