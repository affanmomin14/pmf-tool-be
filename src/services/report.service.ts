import { callOpenAI } from './ai.service';
import { AIError } from '../errors';
import {
  FounderAnswers,
  ScoringInput,
  ReportOutput,
  reportOutputSchema,
  reportResponseFormat,
} from '../schemas/report.schema';
import type { ResearchOutput } from '../schemas/research.schema';

// ============================================================================
// System prompt -- enforces data anchoring, score injection, tone, banned words
// ============================================================================

const SYSTEM_PROMPT = `You are a PMF (Product-Market Fit) diagnostic analyst generating a comprehensive report.

## CORE RULES

1. DATA ANCHORING: Every statistic in the market section MUST come from research_findings. If research_findings has null for a field, say "Data not available" -- NEVER estimate or fabricate.

2. SCORE INJECTION: The scorecard dimension scores MUST exactly match the values in pre_computed_scores. Do NOT recalculate scores. Use the provided label for each dimension.

3. The pmfScore and pmfStage in the header MUST match the pre_computed_scores values exactly.

## TONE & STYLE

- Professional, direct, data-driven. Write like a senior consultant briefing a founder. Avoid hype.
- BANNED WORDS: Do NOT use these words: revolutionary, game-changing, game-changer, synergy, disruptive, paradigm shift, best-in-class, cutting-edge, world-class, groundbreaking, unprecedented, leverage (as a verb)

## LENGTH CONSTRAINTS

- verdict: exactly 1 sentence
- reality_check.summary: 2-3 sentences
- Each recommendation description: 1-2 sentences
- Each scorecard insight: 1-2 sentences

## SECTION INSTRUCTIONS

1. **header**: Use companyName from founder Q1 (extract product/company name). category and subCategory from classification context. assessmentDate as today. pmfScore and pmfStage from pre_computed_scores EXACTLY. verdict is a single-sentence overall assessment.

2. **reality_check**: Synthesize overall analysis into a 2-3 sentence summary. Identify top 1-3 strengths and 1-3 concerns based on scorecard and research data.

3. **scorecard**: MUST have exactly 7 items. Copy each dimension, score, and label from pre_computed_scores.dimensions EXACTLY. Write a 1-2 sentence insight for each dimension based on the data.

4. **market**: Use tam, sam, growthRate from research_findings.market (null becomes "Data not available" string or null). positioning describes how the product fits the market. opportunity identifies the key market opportunity.

5. **sales_model**: current from founder Q3 (distribution channel). recommended based on research_findings.patterns and market data. reasoning explains why the recommended model fits.

6. **competitors**: Based on research_findings.competitors. For each competitor, provide a comparison to the founder's product and a threat level assessment.

7. **positioning**: current from research_findings.patterns and classification. recommended based on gaps identified. gap describes what is missing.

8. **bottom_line**: summary synthesizes everything into a clear conclusion. primaryBreak identifies the lowest scoring dimension and what to do about it (use pre_computed_scores.primaryBreak). nextSteps are 1-3 actionable items.

9. **recommendations**: Exactly 5 actionable recommendations. Each has a title, 1-2 sentence description, priority (high/medium/low), and timeframe.

10. **sources**: List URLs and references from research_findings that were used.`;

// ============================================================================
// User message builder
// ============================================================================

function buildReportUserMessage(
  founderAnswers: FounderAnswers,
  research: ResearchOutput,
  scores: ScoringInput,
): string {
  return `## IMMUTABLE INPUTS -- DO NOT MODIFY THESE VALUES

### Founder Answers
${JSON.stringify(founderAnswers, null, 2)}

### Research Findings
${JSON.stringify(research, null, 2)}

### Pre-Computed Scores (USE THESE EXACTLY)
${JSON.stringify(scores, null, 2)}`;
}

// ============================================================================
// Content validation -- post-parse checks beyond Zod structure
// ============================================================================

function validateContent(report: ReportOutput, scores: ScoringInput): void {
  const errors: string[] = [];

  // Scorecard must have exactly 7 dimensions
  if (report.scorecard.length !== 7) {
    errors.push(`Scorecard has ${report.scorecard.length} dimensions, expected 7`);
  }

  // Recommendations must have exactly 5 items
  if (report.recommendations.length !== 5) {
    errors.push(`Recommendations has ${report.recommendations.length} items, expected 5`);
  }

  // Each scorecard score must match the corresponding input score
  for (const inputDim of scores.dimensions) {
    const reportDim = report.scorecard.find(
      (s) => s.dimension.toLowerCase() === inputDim.dimension.toLowerCase(),
    );
    if (!reportDim) {
      errors.push(`Scorecard missing dimension: ${inputDim.dimension}`);
    } else if (reportDim.score !== inputDim.score) {
      errors.push(
        `Scorecard score mismatch for ${inputDim.dimension}: got ${reportDim.score}, expected ${inputDim.score}`,
      );
    }
  }

  // pmfScore must match
  if (report.header.pmfScore !== scores.pmfScore) {
    errors.push(
      `Header pmfScore ${report.header.pmfScore} does not match input ${scores.pmfScore}`,
    );
  }

  // pmfStage must match
  if (report.header.pmfStage !== scores.pmfStage) {
    errors.push(
      `Header pmfStage "${report.header.pmfStage}" does not match input "${scores.pmfStage}"`,
    );
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
}): Promise<ReportOutput> {
  const userMessage = buildReportUserMessage(params.founderAnswers, params.research, params.scores);

  const result = await callOpenAI({
    assessmentId: params.assessmentId,
    promptName: 'generate_report',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    responseFormat: reportResponseFormat,
    temperature: 0.35,
    maxTokens: 4000,
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
// Report generation with corrections (for hallucination retry flow, Plan 07-02)
// ============================================================================

export async function generateReportWithCorrections(
  params: {
    assessmentId: string;
    founderAnswers: FounderAnswers;
    research: ResearchOutput;
    scores: ScoringInput;
  },
  previousFlags: string[],
): Promise<ReportOutput> {
  const userMessage = buildReportUserMessage(params.founderAnswers, params.research, params.scores);

  const correctionSection = `\n\n## CORRECTION REQUIRED\nThe previous report had the following issues:\n${previousFlags.map((f) => `- ${f}`).join('\n')}\nPlease regenerate the report fixing these specific issues.`;

  const result = await callOpenAI({
    assessmentId: params.assessmentId,
    promptName: 'generate_report',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage + correctionSection },
    ],
    responseFormat: reportResponseFormat,
    temperature: 0.35,
    maxTokens: 4000,
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
