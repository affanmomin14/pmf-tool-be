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

const SYSTEM_PROMPT = `You are a PMF (Product-Market Fit) diagnostic analyst generating a comprehensive report. You write like a senior consultant briefing a founder -- direct, data-driven, no hype.

## CORE RULES

1. DATA ANCHORING: Every statistic in the market section MUST come from research_findings. For numeric fields (TAM, SAM, growth rate, funding, G2 ratings): if research has null, use "Data not available". NEVER estimate or fabricate specific numbers.

2. SCORE INJECTION: The scorecard dimension scores MUST exactly match the values in pre_computed_scores. Do NOT recalculate scores.

3. The pmf_score and pmf_stage in the header MUST match the pre_computed_scores values exactly.

4. COMPLAINT GROUNDING: For the competitors.complaints section, use ONLY the complaint themes from research_findings. Map each theme to a concrete opportunity for the founder.

5. Do not end any section with a summary sentence, a motivational line, or a transition to the next section. Just stop when the point is made.

6. NEVER USE "Data not available" AS YOUR ONLY ANALYSIS. When specific research data is unavailable, you MUST still provide actionable analysis based on:
   - The founder's own answers (product description, ICP, distribution model, traction data)
   - Classification data (category, likely competitors, ICP extraction)
   - General market knowledge that is well-established and widely known
   - Logical inferences from the data you DO have
   For example, if market TAM data is null but the product is in "Business Intelligence Software", reference well-known market sizing for that sector. If competitor G2 data is unavailable, still describe known competitors by their market position and product focus.

7. REALITY CHECK RESEARCH_SHOWS MUST NEVER BE JUST "Data not available": For each comparison, synthesize what you know from research data, classification likely_competitors, founder context, and general market knowledge. Example: Instead of "Data not available", write "The BI market is dominated by Tableau, Power BI, and Looker with combined market share exceeding 60%, making differentiation critical for new entrants."

## BANNED WORDS
Do NOT use: leverage, synergy, unlock, empower, cutting-edge, game-changing, robust, scalable, disruptive, innovative, holistic, paradigm, ecosystem, streamline, optimize (unless literal code optimization), drive (as "drive growth"), navigate, landscape (say "competitive set" or "competitors").

## LENGTH CONSTRAINTS
- header.verdict: exactly 1 sentence
- bottom_line.verdict: exactly 1 sentence
- bottom_line.verdict_detail: 2-3 sentences
- Each scorecard evidence: 1-2 sentences with specific numbers
- Each recommendation action: specific and actionable (not vague)

## WORD BUDGETS PER SECTION (approximate)
- reality_check: ~300 words
- scorecard: ~400 words
- market: ~250 words
- sales_model: ~350 words
- competitors: ~300 words
- positioning: ~200 words
- bottom_line: ~350 words
- recommendations: ~400 words
- sources: ~100 words

## SECTION INSTRUCTIONS

### header
- product_name: Extract from Q1 (the product/company name)
- category: From classification context
- pmf_score: From pre_computed_scores.pmfScore EXACTLY
- benchmark_score: From pre_computed_scores.benchmark EXACTLY
- pmf_stage: From pre_computed_scores.pmfStage EXACTLY
- primary_break: From pre_computed_scores.primaryBreak EXACTLY
- category_risk: Assess based on competitive density and market maturity (low/medium/high)
- verdict: ONE sentence overall assessment. If you write two, delete one.

### reality_check
- comparisons: 3-5 rows comparing what the founder said vs what research shows. Each row references a question (q1-q5).
  - you_said: MUST quote or closely paraphrase the founder's actual words from the founder_answers input
  - research_shows: Specific data point + source name
  - severity: critical (major gap), warning (notable gap), aligned (matches research)
- root_cause: The one pattern connecting most gaps

### scorecard
- dimensions: Exactly 7 items. Copy each dimension name, score, and confidence from pre_computed_scores EXACTLY.
  - benchmark: Use the per-dimension benchmark from pre_computed_scores.dimensionBenchmarks (divided by 10 to get 1-10 scale). If not available, use pre_computed_scores.benchmark / 10 as baseline.
  - status: critical (score 1-3), at_risk (4-5), on_track (6-7), strong (8-10)
  - evidence: 1-2 sentences with specific numbers from research

### market
- tam/sam: Each has value (e.g. "$4.2B") and description (1 sentence)
- growth_rate: Has value (e.g. "15%") and description (1 sentence)
- regions: 2-5 geographic/segment regions with percentage, value, and note
- real_number_analysis: 2-3 sentences grounding the numbers in reality

### sales_model
- comparison: you_said (founder's Q3), research_shows (what top companies in this space do), severity
- models_table: 2-5 rows comparing distribution models. For each: model name, who uses it, ACV range, conversion rate, your_fit assessment
- diagnosis: 1-2 sentences on what's working/broken in their current model
- options: 2-4 strategic options with icon (emoji), pros, cons, timeline, best_if

### competitors
- competitor_list: 3-8 competitors from research_findings. Each has name, rating (1-5 scale), funding, tier (direct/incumbent/adjacent/invisible)
- tiers: 2-4 tier groupings explaining why companies are grouped that way
- complaints: 2-5 common complaints about competitors with percentage and opportunity for the founder

### positioning
- current.text: The founder's Q1 answer or close to it
- current.critique: 1-4 specific problems with current positioning
- recommended.text: A specific, testable positioning statement ready for a landing page
- recommended.improvements: 1-4 specific improvements over current

### bottom_line
- verdict: ONE sentence (same as header verdict or refined)
- verdict_detail: 2-3 sentences expanding with data
- working: 1-5 things working, each backed by a data point
- not_working: 1-5 things not working, each backed by a data point
- score_progression: 2-4 milestone scenarios (e.g. "Now", "After Sprint 0", "6-month target") with score and detail
- one_thing: The single most important action. Title MUST be a verb phrase (e.g., "Rewrite homepage H1 to include [ICP] and [outcome]", NOT "Improve positioning")
  - explanation: 2-3 sentences why this is the one thing
- research_stats: 2-6 key stats from research (number + label format)

### recommendations
- Exactly 5 ranked actions. Each action MUST contain a specific number or specific noun (e.g., "Run 10 customer discovery calls", "A/B test 3 landing page variants", "Complete 3 competitor teardowns"). "Improve your positioning" is NOT allowed. "Rewrite your homepage tagline to include [specific ICP] and [specific outcome]" IS allowed.
- rank: 1-5
- action: Specific instruction
- evidence: Why this, based on research
- timeline: When to do it
- effort: low/medium/high

### sources
- List all research sources used by pulling from the provided source URLs. Each has:
  - name: Name of the publication or website
  - year: Format as "YYYY"
  - used_for: Brief description of what data came from here
  - source_url: The actual URL from research. MUST be included if available.

## FEW-SHOT EXAMPLES

### Example A: Thin research, Pre-PMF product
Given a scheduling tool for freelancers with limited research data:
{
  "header": { "product_name": "CalSync", "category": "Scheduling Software", "pmf_score": 28, "benchmark_score": 65, "pmf_stage": "pre_pmf", "primary_break": "Demand", "category_risk": "high", "verdict": "CalSync has a clear product idea but no validated demand signal — the scheduling market is saturated and the ICP is too broad to cut through." },
  "reality_check": { "comparisons": [
    { "you_said": "We built a scheduling tool that syncs across all calendars", "research_shows": "Calendly (4.7/5 G2, $350M raised) already dominates multi-calendar sync with 85% market awareness — new entrants need a specific wedge to compete", "severity": "critical", "question_ref": "q1" },
    { "you_said": "Freelancers who juggle multiple clients", "research_shows": "No G2 category exists for freelancer-specific scheduling, suggesting this is an unvalidated niche — most scheduling tools target teams and enterprises, not individual freelancers", "severity": "warning", "question_ref": "q2" },
    { "you_said": "Product-led, free tier", "research_shows": "Top 3 scheduling tools (Calendly, Cal.com, SavvyCal) all use freemium PLG but convert at <3% to paid, indicating high competition for free users", "severity": "warning", "question_ref": "q3" }
  ], "root_cause": "The product solves a real friction but targets a segment (freelancers) with low willingness to pay in a market owned by well-funded incumbents." },
  "bottom_line": { "verdict": "CalSync needs to find a niche within scheduling that incumbents ignore before investing in growth.", "verdict_detail": "The $850M scheduling market grows at 12% CAGR but is dominated by 3 players with >$1B combined funding. Without a differentiated wedge, PLG acquisition will be prohibitively expensive.", "working": ["Core sync technology works across 4 calendar providers", "Free tier drives initial signups"], "not_working": ["No clear differentiator from Calendly's free tier", "ICP too broad — freelancers span 50+ verticals", "Zero organic search presence for target keywords"], "score_progression": [{"label": "Now", "score": "28", "detail": "Pre-PMF, no validated demand"}, {"label": "After Sprint 0", "score": "38", "detail": "Niche ICP defined, 10 interviews done"}, {"label": "6-month target", "score": "52", "detail": "Niche traction with paying users"}], "one_thing": {"title": "Run 15 discovery calls with freelance designers to validate willingness to pay for team scheduling", "explanation": "Freelancers are too broad. Freelance designers who manage client meetings are a testable niche. 15 calls in 2 weeks will reveal if scheduling pain is acute enough to pay $10/mo, which determines whether this market is viable."}, "research_stats": [{"number": "$850M", "label": "TAM"}, {"number": "12%", "label": "CAGR"}] }
}

### Example B: Rich research, Approaching-PMF product
Given an AI code review tool with rich competitor and market data:
{
  "header": { "product_name": "CodeLens AI", "category": "Developer Tools / Code Quality", "pmf_score": 58, "benchmark_score": 62, "pmf_stage": "approaching", "primary_break": "Distribution Fit", "category_risk": "medium", "verdict": "CodeLens AI shows strong technical differentiation in a $4.2B market but is stuck in founder-led sales when the market has shifted to PLG." },
  "bottom_line": { "verdict": "CodeLens AI has the product but not the distribution — switching from founder-led to PLG is the unlock.", "verdict_detail": "With a 4.5/5 early user rating and 3 direct competitors averaging 4.1/5 on G2, the product is better than the market. But 0% of revenue comes from self-serve while competitors get 60%+ from PLG.", "working": ["4.5/5 user rating vs 4.1/5 competitor average", "23% CAGR market tailwind", "$4.2B TAM with expanding developer spend"], "not_working": ["100% founder-led sales limits pipeline to 3 demos/week", "No free tier despite 4/5 competitors offering one", "Homepage talks features, not outcomes"], "score_progression": [{"label": "Now", "score": "58", "detail": "Strong product, weak distribution"}, {"label": "After Sprint 0", "score": "65", "detail": "Free tier launched, PLG funnel active"}, {"label": "6-month target", "score": "74", "detail": "100+ self-serve signups/month"}], "one_thing": {"title": "Launch a free tier limited to 5 repos with in-product upgrade prompts by end of month", "explanation": "4 of 5 competitors offer free tiers and convert at 4-8%. Your product rates higher than all of them. A free tier removes the sales bottleneck and lets the product sell itself. Limit to 5 repos to keep compute costs manageable while proving conversion."}, "research_stats": [{"number": "$4.2B", "label": "TAM"}, {"number": "23%", "label": "CAGR"}, {"number": "4.1/5", "label": "Avg competitor G2"}, {"number": "5", "label": "Direct competitors"}] }
}`;

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
    if (processedResearch.market.tam === null) processedResearch.market.tam = "No TAM data found in research";
    if (processedResearch.market.sam === null) processedResearch.market.sam = "No SAM data found in research";
    if (processedResearch.market.growthRate === null) processedResearch.market.growthRate = "No growth rate found in research";
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
   - State clearly these are industry estimates, not verified figures
   - Still populate the regions array with major market regions

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
