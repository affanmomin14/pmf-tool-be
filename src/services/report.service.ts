import { callOpenAI } from './ai.service';
import { env } from '../config/env';
import { AIError } from '../errors';
import {
  FounderAnswers,
  ScoringInput,
  ReportOutput,
  reportOutputSchema,
  reportResponseFormat,
} from '../schemas/report.schema';
import type { ResearchOutput, ResearchQuality } from '../schemas/research.schema';

// ============================================================================
// System prompt -- PRD-aligned, enforces data anchoring, score injection, tone
// ============================================================================

const SYSTEM_PROMPT = `You are a PMF diagnostic analyst. Write like a senior consultant: direct, data-backed, zero hype.

## CRITICAL RULES (MUST FOLLOW)

RULE 1 — COPY SCORES EXACTLY: header.pmf_score, header.pmf_stage, header.benchmark_score, header.primary_break, and all 7 scorecard dimension scores/confidence values MUST be copied verbatim from pre_computed_scores. Do NOT recalculate.

RULE 2 — NEVER OUTPUT "Data not available": For ANY missing data, derive an estimate and mark "(est.)". Examples:
- SAM unknown + TAM=$4.9B → SAM="~$1.2B (est.)" based on ICP segment share
- Regions unknown → use industry splits: NA 38%, Europe 27%, APAC 22%, RoW 13%
- Competitor funding unknown → "Not publicly disclosed"

RULE 3 — DATA ANCHORING: Use exact numbers from research_findings when available. Only estimate when research has null.

RULE 4 — COMPLAINT GROUNDING: competitors.complaints must use themes from research_findings only.

RULE 5 — NO FILLER: Never end a section with a summary, motivational line, or transition sentence. Stop when the point is made.

## BANNED WORDS
Never use: leverage, synergy, unlock, empower, cutting-edge, game-changing, robust, scalable, disruptive, innovative, holistic, paradigm, ecosystem, streamline, optimize (unless literal), drive (as "drive growth"), navigate, landscape (say "competitive set").

## LENGTH RULES
- header.verdict: exactly 1 sentence
- bottom_line.verdict: exactly 1 sentence
- bottom_line.verdict_detail: 2-3 sentences
- scorecard evidence: 1-2 sentences with specific numbers
- recommendations: each action MUST contain a specific number or noun (e.g., "Run 10 customer calls", NOT "Improve positioning")

## SECTION SPECS

**header**: product_name from Q1. category from classification. pmf_score/benchmark_score/pmf_stage/primary_break = COPY from pre_computed_scores. category_risk = low/medium/high based on competitive density. verdict = 1 sentence.

**reality_check**: 3-5 comparisons (q1-q5). you_said = quote founder's actual words. research_shows = specific data + source (NEVER just "Data not available" — synthesize from research, classification competitors, and market knowledge). severity = critical/warning/aligned. root_cause = one pattern connecting gaps.

**scorecard**: Exactly 7 dimensions. For each: name/score/confidence = COPY from pre_computed_scores. benchmark = dimensionBenchmarks[dim]/10. status: 1-3=critical, 4-5=at_risk, 6-7=on_track, 8-10=strong. evidence = 1-2 sentences with numbers.

**market**: tam/sam each have value + description. If SAM is null, derive from TAM × ICP segment share, mark "(est.)". growth_rate: value + description. regions: 3-5 regions, ALL with non-zero percentage and dollar value. real_number_analysis: 2-3 sentences noting which figures are researched vs estimated.

**sales_model**: comparison of founder's Q3 vs market reality. models_table: 2-5 distribution models with who_uses, acv_range, conversion, your_fit. diagnosis: 1-2 sentences. options: 2-4 strategic alternatives with emoji icon, pros, cons, timeline, best_if.

**competitors**: competitor_list: 3-8 from research with name, rating (1-5), funding, tier (direct/incumbent/adjacent/invisible). tiers: 2-4 groupings with why. complaints: 2-5 with percentage and opportunity.

**positioning**: current.text ≈ founder's Q1. current.critique: 1-4 specific problems. recommended.text: specific, testable positioning statement. recommended.improvements: 1-4 improvements.

**bottom_line**: verdict = 1 sentence. verdict_detail = 2-3 sentences with data. working: 1-5 items backed by data. not_working: 1-5 items backed by data. score_progression: 2-4 milestones ("Now", "After Sprint 0", "6-month target") with score + detail. one_thing: title MUST be a verb phrase (e.g., "Run 15 user interviews..." NOT "Improve engagement"). explanation: 2-3 sentences. research_stats: 2-6 key stats as number + label.

**recommendations**: Exactly 5 ranked. Each must be specific and actionable with a number (e.g., "Complete 3 competitor teardowns", "A/B test 3 landing page variants"). rank 1-5, action, evidence, timeline, effort (low/medium/high).

**sources**: List research sources with name, year (YYYY), used_for, source_url (from research URLs, or null).

## FEW-SHOT EXAMPLES

### Example A: Thin research, Pre-PMF
{
  "header": { "product_name": "CalSync", "category": "Scheduling Software", "pmf_score": 28, "benchmark_score": 65, "pmf_stage": "pre_pmf", "primary_break": "Demand", "category_risk": "high", "verdict": "CalSync has a clear product idea but no validated demand signal — the scheduling market is saturated and the ICP is too broad to cut through." },
  "reality_check": { "comparisons": [
    { "you_said": "We built a scheduling tool that syncs across all calendars", "research_shows": "Calendly (4.7/5 G2, $350M raised) already dominates multi-calendar sync with 85% market awareness — new entrants need a specific wedge to compete", "severity": "critical", "question_ref": "q1" },
    { "you_said": "Freelancers who juggle multiple clients", "research_shows": "No G2 category exists for freelancer-specific scheduling, suggesting this is an unvalidated niche — most scheduling tools target teams and enterprises, not individual freelancers", "severity": "warning", "question_ref": "q2" },
    { "you_said": "Product-led, free tier", "research_shows": "Top 3 scheduling tools (Calendly, Cal.com, SavvyCal) all use freemium PLG but convert at <3% to paid, indicating high competition for free users", "severity": "warning", "question_ref": "q3" }
  ], "root_cause": "The product solves a real friction but targets a segment (freelancers) with low willingness to pay in a market owned by well-funded incumbents." },
  "bottom_line": { "verdict": "CalSync needs to find a niche within scheduling that incumbents ignore before investing in growth.", "verdict_detail": "The $850M scheduling market grows at 12% CAGR but is dominated by 3 players with >$1B combined funding. Without a differentiated wedge, PLG acquisition will be prohibitively expensive.", "working": ["Core sync technology works across 4 calendar providers", "Free tier drives initial signups"], "not_working": ["No clear differentiator from Calendly's free tier", "ICP too broad — freelancers span 50+ verticals", "Zero organic search presence for target keywords"], "score_progression": [{"label": "Now", "score": "28", "detail": "Pre-PMF, no validated demand"}, {"label": "After Sprint 0", "score": "38", "detail": "Niche ICP defined, 10 interviews done"}, {"label": "6-month target", "score": "52", "detail": "Niche traction with paying users"}], "one_thing": {"title": "Run 15 discovery calls with freelance designers to validate willingness to pay for team scheduling", "explanation": "Freelancers are too broad. Freelance designers who manage client meetings are a testable niche. 15 calls in 2 weeks will reveal if scheduling pain is acute enough to pay $10/mo, which determines whether this market is viable."}, "research_stats": [{"number": "$850M", "label": "TAM"}, {"number": "12%", "label": "CAGR"}] }
}

### Example B: Rich research, Approaching-PMF
{
  "header": { "product_name": "CodeLens AI", "category": "Developer Tools / Code Quality", "pmf_score": 58, "benchmark_score": 62, "pmf_stage": "approaching", "primary_break": "Distribution Fit", "category_risk": "medium", "verdict": "CodeLens AI shows strong technical differentiation in a $4.2B market but is stuck in founder-led sales when the market has shifted to PLG." },
  "bottom_line": { "verdict": "CodeLens AI has the product but not the distribution — switching from founder-led to PLG is the unlock.", "verdict_detail": "With a 4.5/5 early user rating and 3 direct competitors averaging 4.1/5 on G2, the product is better than the market. But 0% of revenue comes from self-serve while competitors get 60%+ from PLG.", "working": ["4.5/5 user rating vs 4.1/5 competitor average", "23% CAGR market tailwind", "$4.2B TAM with expanding developer spend"], "not_working": ["100% founder-led sales limits pipeline to 3 demos/week", "No free tier despite 4/5 competitors offering one", "Homepage talks features, not outcomes"], "score_progression": [{"label": "Now", "score": "58", "detail": "Strong product, weak distribution"}, {"label": "After Sprint 0", "score": "65", "detail": "Free tier launched, PLG funnel active"}, {"label": "6-month target", "score": "74", "detail": "100+ self-serve signups/month"}], "one_thing": {"title": "Launch a free tier limited to 5 repos with in-product upgrade prompts by end of month", "explanation": "4 of 5 competitors offer free tiers and convert at 4-8%. Your product rates higher than all of them. A free tier removes the sales bottleneck and lets the product sell itself. Limit to 5 repos to keep compute costs manageable while proving conversion."}, "research_stats": [{"number": "$4.2B", "label": "TAM"}, {"number": "23%", "label": "CAGR"}, {"number": "4.1/5", "label": "Avg competitor G2"}, {"number": "5", "label": "Direct competitors"}] }
}

## FINAL CHECKLIST (verify before returning)
✓ header.pmf_score matches pre_computed_scores.pmfScore exactly
✓ header.pmf_stage matches pre_computed_scores.pmfStage exactly
✓ All 7 scorecard scores match pre_computed_scores dimensions exactly
✓ Zero occurrences of "Data not available" anywhere
✓ header.verdict is exactly 1 sentence
✓ bottom_line.verdict is exactly 1 sentence
✓ Exactly 7 scorecard dimensions, exactly 5 recommendations
✓ All market regions have non-zero percentages and dollar values
✓ Every recommendation action contains a specific number or noun`;

// ============================================================================
// User message builder
// ============================================================================

function buildReportUserMessage(
  founderAnswers: FounderAnswers,
  research: ResearchOutput,
  scores: ScoringInput,
  classificationData?: any,
  researchQuality?: ResearchQuality,
): string {
  // Pre-process research to explicitly mark nulls for numeric/specific fields
  const processedResearch = JSON.parse(JSON.stringify(research));

  // Extract all source URLs to make them prominent in the prompt
  const sourceUrls = new Set<string>();

  if (processedResearch.competitors) {
    processedResearch.competitors.forEach((c: any) => {
      if (c.sourceUrl) sourceUrls.add(c.sourceUrl);
      // Only mark strictly numeric fields as "Data not available"
      if (c.g2Rating === null) c.g2Rating = "Not found on G2";
      if (c.reviewCount === null) c.reviewCount = "Not found on G2";
      if (c.funding === null) c.funding = "Not publicly disclosed";
      if (c.pricingModel === null) c.pricingModel = "Not found";
      if (c.freeTier === null) c.freeTier = "Unknown";
    });
  }

  if (processedResearch.market) {
    if (processedResearch.market.tam === null) processedResearch.market.tam = "No TAM data found — use general market knowledge for " + (classificationData?.category || "this sector") + " to provide an estimate marked (est.)";
    if (processedResearch.market.sam === null && processedResearch.market.tam !== null) {
      processedResearch.market.sam = `No SAM data found — DERIVE from TAM (${processedResearch.market.tam}) by estimating what % applies to the target ICP. Mark as (est.)`;
    } else if (processedResearch.market.sam === null) {
      processedResearch.market.sam = "No SAM data found — derive an estimate from TAM and target ICP segment. Mark as (est.)";
    }
    if (processedResearch.market.growthRate === null) processedResearch.market.growthRate = "No growth rate found — use known CAGR for " + (classificationData?.category || "this sector") + ". Mark as (est.)";
    if (processedResearch.market.regions === null || (processedResearch.market.regions && processedResearch.market.regions.length === 0)) {
      processedResearch.market.regions = "No regional data — DERIVE using standard SaaS geographic splits (NA ~38%, Europe ~27%, APAC ~22%, RoW ~13%) applied to the TAM. Mark as (est.)";
    }
  }

  if (processedResearch.complaints) {
    processedResearch.complaints.forEach((c: any) => {
      if (c.percentage === null) c.percentage = "Not quantified";
      if (c.sourceUrl) sourceUrls.add(c.sourceUrl);
    });
  }

  if (processedResearch.patterns?.topCompanies) {
    processedResearch.patterns.topCompanies.forEach((c: any) => {
      if (c.salesModel === null) c.salesModel = "Not determined";
      if (c.positioning === null) c.positioning = "Not found";
      if (c.sourceUrl) sourceUrls.add(c.sourceUrl);
    });
  }

  // Build classification context for the LLM
  const classificationContext = classificationData ? `
### Classification Context (from AI analysis of founder answers)
- Category: ${classificationData.category} / ${classificationData.sub_category}
- Category confidence: ${classificationData.category_confidence}
- Problem type: ${classificationData.problem_type}
- ICP specificity: ${classificationData.icp_specificity}/5
- ICP extracted: ${JSON.stringify(classificationData.icp_extracted || {})}
- Product signals: ${JSON.stringify(classificationData.product_signals || {})}
- Business model: ${classificationData.business_model}
- Traction metrics: ${JSON.stringify(classificationData.traction_metrics || {})}
- Known competitors (from classification): ${(classificationData.likely_competitors || []).join(', ') || 'None identified'}` : '';

  let message = `## IMMUTABLE INPUTS -- DO NOT MODIFY THESE VALUES

### Founder Answers
${JSON.stringify(founderAnswers, null, 2)}
${classificationContext}

### Research Findings
${JSON.stringify(processedResearch, null, 2)}

### Source URLs Collected from Research
${sourceUrls.size > 0 ? Array.from(sourceUrls).join('\\n') : 'No source URLs available from web search.'}
(Use these URLs to populate the sources section. If no URLs, use "Industry analysis" as the source.)

### Pre-Computed Scores (USE THESE EXACTLY)
${JSON.stringify(scores, null, 2)}`;

  // Thin/minimal research handling -- give explicit instructions
  if (researchQuality && (researchQuality.overall === 'thin' || researchQuality.overall === 'minimal')) {
    message += `

## CRITICAL: LIMITED RESEARCH DATA — ENHANCED ANALYSIS REQUIRED
Research data is limited (quality: ${researchQuality.overall}, competitors: ${researchQuality.competitorCount}, market data: ${researchQuality.hasMarketData ? 'yes' : 'no'}, complaints: ${researchQuality.complaintCount}).

Because research data is limited, you MUST:

1. **Reality Check section**: For each comparison, provide substantive analysis even without web research data. Use:
   - The classification's known competitors list (${(classificationData?.likely_competitors || []).join(', ')})
   - General knowledge about the ${classificationData?.category || 'software'} market
   - Inferences from what the founder told you (traction, ICP, distribution)
   - NEVER leave research_shows as just "Data not available". Always provide at least 1-2 sentences of analysis.

2. **Market section**: If TAM/SAM/growth is unavailable from web research:
   - Use well-known industry estimates for the ${classificationData?.category || 'software'} market
   - Mark all estimated values with "(est.)" suffix (e.g., "~$2.1B (est.)")
   - ALWAYS populate the regions array with 3-5 regions, each with non-zero percentage and dollar values derived from TAM
   - NEVER output "Data not available" as a value — always derive an estimate

3. **Competitors section**: Even with limited research:
   - Use the classification's known competitors: ${(classificationData?.likely_competitors || []).join(', ')}
   - Provide what you know about these companies from general knowledge
   - For complaints, infer common pain points in the ${classificationData?.sub_category || 'software'} space

4. **Sales Model section**: Analyze based on the founder's stated distribution model and how top companies in this space typically sell.

5. **Sources section**: If no web sources available, cite "Industry analysis" and "Founder-provided data" as sources.

6. **Recommendations**: Focus on founder-actionable items that validate assumptions and fill data gaps.`;
  }

  return message;
}

// ============================================================================
// Content validation -- post-parse checks beyond Zod structure
// ============================================================================

function validateContent(report: ReportOutput, scores: ScoringInput): void {
  const errors: string[] = [];

  // Scorecard must have exactly 7 dimensions
  if (report.scorecard.dimensions.length !== 7) {
    errors.push(`Scorecard has ${report.scorecard.dimensions.length} dimensions, expected 7`);
  }

  // Recommendations must have exactly 5 items
  if (report.recommendations.length !== 5) {
    errors.push(`Recommendations has ${report.recommendations.length} items, expected 5`);
  }

  // Each scorecard score must match the corresponding input score
  for (const inputDim of scores.dimensions) {
    const reportDim = report.scorecard.dimensions.find(
      (s) => s.name.toLowerCase() === inputDim.dimension.toLowerCase(),
    );
    if (!reportDim) {
      errors.push(`Scorecard missing dimension: ${inputDim.dimension}`);
    } else if (reportDim.score !== inputDim.score) {
      errors.push(
        `Scorecard score mismatch for ${inputDim.dimension}: got ${reportDim.score}, expected ${inputDim.score}`,
      );
    }
  }

  // pmf_score must match
  if (report.header.pmf_score !== scores.pmfScore) {
    errors.push(
      `Header pmf_score ${report.header.pmf_score} does not match input ${scores.pmfScore}`,
    );
  }

  // pmf_stage must match
  if (report.header.pmf_stage !== scores.pmfStage) {
    errors.push(
      `Header pmf_stage "${report.header.pmf_stage}" does not match input "${scores.pmfStage}"`,
    );
  }

  // verdict must be single sentence
  const verdictSentences = report.header.verdict.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (verdictSentences.length > 1) {
    errors.push(`Header verdict has ${verdictSentences.length} sentences, expected 1`);
  }

  if (errors.length > 0) {
    throw new AIError(`Report content validation failed: ${errors.join('; ')}`);
  }
}

// ============================================================================
// Main report generation
// ============================================================================

export async function generateReport(params: {
  assessmentId: string;
  founderAnswers: FounderAnswers;
  research: ResearchOutput;
  scores: ScoringInput;
  classificationData?: any;
}): Promise<ReportOutput> {
  const researchQuality = typeof params.research.researchQuality === 'object'
    ? params.research.researchQuality as ResearchQuality
    : undefined;
  const userMessage = buildReportUserMessage(params.founderAnswers, params.research, params.scores, params.classificationData, researchQuality);

  const result = await callOpenAI({
    assessmentId: params.assessmentId,
    promptName: 'generate_report',
    model: env.OPENAI_REPORT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    responseFormat: reportResponseFormat,
    temperature: 0.1,
    maxTokens: 16000,
  });

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new AIError('Report generation returned invalid JSON');
  }

  // Zod structural validation
  const parseResult = reportOutputSchema.safeParse(parsed);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new AIError(`Report schema validation failed: ${issues.join('; ')}`);
  }

  // Content validation -- scores match input
  validateContent(parseResult.data, params.scores);

  return parseResult.data;
}

// ============================================================================
// Report generation with corrections (for hallucination retry flow)
// ============================================================================

export async function generateReportWithCorrections(
  params: {
    assessmentId: string;
    founderAnswers: FounderAnswers;
    research: ResearchOutput;
    scores: ScoringInput;
    classificationData?: any;
  },
  previousFlags: string[],
): Promise<ReportOutput> {
  const researchQuality = typeof params.research.researchQuality === 'object'
    ? params.research.researchQuality as ResearchQuality
    : undefined;
  const userMessage = buildReportUserMessage(params.founderAnswers, params.research, params.scores, params.classificationData, researchQuality);

  const correctionSection = `\n\n## CORRECTION REQUIRED\nThe previous report had the following issues:\n${previousFlags.map((f) => `- ${f}`).join('\n')}\nPlease regenerate the report fixing these specific issues.`;

  const result = await callOpenAI({
    assessmentId: params.assessmentId,
    promptName: 'generate_report',
    model: env.OPENAI_REPORT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage + correctionSection },
    ],
    responseFormat: reportResponseFormat,
    temperature: 0.1,
    maxTokens: 16000,
  });

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new AIError('Report correction returned invalid JSON');
  }

  // Zod structural validation
  const parseResult = reportOutputSchema.safeParse(parsed);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new AIError(`Report schema validation failed: ${issues.join('; ')}`);
  }

  // Content validation -- scores match input
  validateContent(parseResult.data, params.scores);

  return parseResult.data;
}
