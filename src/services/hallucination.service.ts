import type { FounderAnswers, ScoringInput, ReportOutput } from '../schemas/report.schema';
import type { ResearchOutput } from '../schemas/research.schema';
import { generateReportWithCorrections } from './report.service';

// ============================================================================
// Types
// ============================================================================

export interface HallucinationFlag {
  check: string;
  field: string;
  expected: string;
  found: string;
  severity: 'error' | 'warning';
}

// ============================================================================
// Check 1 -- Number verification (HVAL-01)
// ============================================================================

function extractNumbers(text: string): string[] {
  const matches = text.match(/\$?[\d,]+\.?\d*[BMK%]?(?:\/\d+)?/g);
  if (!matches) return [];
  const seen: Record<string, boolean> = {};
  return matches.filter((m) => {
    if (seen[m]) return false;
    seen[m] = true;
    return true;
  });
}

function buildNumberAllowlist(
  research: ResearchOutput,
  scores: ScoringInput,
  founderAnswers: FounderAnswers,
): Set<string> {
  const allowlist = new Set<string>();

  // Extract numbers from research and founder answers
  const sourceNumbers = extractNumbers(
    JSON.stringify(research) + ' ' + JSON.stringify(founderAnswers),
  );
  for (const n of sourceNumbers) {
    allowlist.add(n);
  }

  // Add scores 1-10 (for ratings and dimension scores)
  for (let i = 1; i <= 10; i++) {
    allowlist.add(String(i));
  }

  // Add score-derived numbers
  allowlist.add(String(scores.pmfScore));
  allowlist.add(String(scores.benchmark));
  for (const dim of scores.dimensions) {
    allowlist.add(String(dim.score));
    allowlist.add(String(dim.weight));
  }

  // Skip common year numbers (dates)
  for (let year = 2020; year <= 2030; year++) {
    allowlist.add(String(year));
  }

  return allowlist;
}

export function checkNumbers(
  report: ReportOutput,
  research: ResearchOutput,
  scores: ScoringInput,
  founderAnswers: FounderAnswers,
): HallucinationFlag[] {
  const flags: HallucinationFlag[] = [];
  const allowlist = buildNumberAllowlist(research, scores, founderAnswers);
  const reportNumbers = extractNumbers(JSON.stringify(report));

  for (const num of reportNumbers) {
    if (!allowlist.has(num)) {
      flags.push({
        check: 'number_verification',
        field: 'report_text',
        expected: 'Number from research/answers/scores',
        found: num,
        severity: 'error',
      });
    }
  }

  return flags;
}

// ============================================================================
// Check 2 -- Company name verification (HVAL-02)
// ============================================================================

const COMMON_SKIP_TERMS = new Set([
  'product market fit', 'pmf', 'tam', 'sam', 'saas', 'b2b', 'b2c', 'ai',
  'series a', 'series b', 'series c', 'mrr', 'arr', 'api', 'roi', 'kpi',
  'cac', 'ltv', 'nps', 'seo', 'crm', 'erp', 'mvp', 'ux', 'ui',
  'data not available', 'not available', 'sprint',
  'the', 'this', 'we', 'they', 'our', 'their', 'it', 'he', 'she',
  'however', 'therefore', 'first', 'second', 'next', 'finally', 'yes', 'no',
  'for', 'in', 'on', 'at', 'to', 'with', 'from', 'by', 'as', 'an', 'a',
]);

export function checkCompanyNames(
  report: ReportOutput,
  research: ResearchOutput,
): HallucinationFlag[] {
  const flags: HallucinationFlag[] = [];

  // Build known company names set
  const knownCompanies = new Set<string>();
  for (const c of research.competitors) {
    knownCompanies.add(c.name.toLowerCase());
  }
  // Add the founder's company name from report header
  knownCompanies.add(report.header.product_name.toLowerCase());

  // Extract capitalized multi-word phrases from report text
  const reportStr = JSON.stringify(report);
  const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const extractedNames = reportStr.match(namePattern) || [];
  const seen: Record<string, boolean> = {};
  const uniqueNames = extractedNames.filter((n) => {
    if (seen[n]) return false;
    seen[n] = true;
    return true;
  });

  for (const name of uniqueNames) {
    const lower = name.toLowerCase();
    if (knownCompanies.has(lower)) continue;
    if (COMMON_SKIP_TERMS.has(lower)) continue;
    // Skip single-letter capitalizations
    if (name.length === 1) continue;

    flags.push({
      check: 'company_names',
      field: 'report_text',
      expected: 'Known company from research.competitors',
      found: name,
      severity: 'warning',
    });
  }

  return flags;
}

// ============================================================================
// Check 3 -- Score-text consistency (HVAL-03)
// ============================================================================

const POSITIVE_WORDS = ['strong', 'excellent', 'impressive', 'outstanding', 'exceptional'];
const NEGATIVE_WORDS = ['weak', 'poor', 'critical', 'concerning', 'lacking', 'insufficient'];

function textContainsWord(text: string, words: string[]): string | null {
  const lower = text.toLowerCase();
  for (const word of words) {
    if (lower.includes(word)) return word;
  }
  return null;
}

export function checkScoreTextConsistency(
  report: ReportOutput,
  scores: ScoringInput,
): HallucinationFlag[] {
  const flags: HallucinationFlag[] = [];

  // Check each scorecard dimension
  for (const item of report.scorecard.dimensions) {
    if (item.score <= 3) {
      const found = textContainsWord(item.evidence, POSITIVE_WORDS);
      if (found) {
        flags.push({
          check: 'score_text_consistency',
          field: `scorecard.${item.name}.evidence`,
          expected: `Negative/neutral tone for score ${item.score}`,
          found: `Positive word "${found}" with score ${item.score}`,
          severity: 'error',
        });
      }
    }
    if (item.score >= 8) {
      const found = textContainsWord(item.evidence, NEGATIVE_WORDS);
      if (found) {
        flags.push({
          check: 'score_text_consistency',
          field: `scorecard.${item.name}.evidence`,
          expected: `Positive/neutral tone for score ${item.score}`,
          found: `Negative word "${found}" with score ${item.score}`,
          severity: 'error',
        });
      }
    }
  }

  // Check overall PMF score consistency
  const overallTexts = [
    { text: report.bottom_line.verdict, field: 'bottom_line.verdict' },
    { text: report.bottom_line.verdict_detail, field: 'bottom_line.verdict_detail' },
  ];

  for (const { text, field } of overallTexts) {
    if (scores.pmfScore <= 35) {
      const found = textContainsWord(text, POSITIVE_WORDS);
      if (found) {
        flags.push({
          check: 'score_text_consistency',
          field,
          expected: `Cautious tone for PMF score ${scores.pmfScore}`,
          found: `Positive word "${found}" with PMF score ${scores.pmfScore}`,
          severity: 'warning',
        });
      }
    }
    if (scores.pmfScore >= 80) {
      const found = textContainsWord(text, NEGATIVE_WORDS);
      if (found) {
        flags.push({
          check: 'score_text_consistency',
          field,
          expected: `Positive tone for PMF score ${scores.pmfScore}`,
          found: `Negative word "${found}" with PMF score ${scores.pmfScore}`,
          severity: 'warning',
        });
      }
    }
  }

  // Check specific semantic contradictions for key dimensions
  const demandScore = scores.dimensions.find(d => d.dimension.toLowerCase() === 'demand')?.score;
  if (demandScore && demandScore >= 8) {
    const demandTexts = [report.header.verdict, report.bottom_line.verdict].join(' ');
    const found = textContainsWord(demandTexts, ['no demand', 'low demand', 'no validated demand', 'lack of demand']);
    if (found) {
      flags.push({ check: 'semantic_consistency', field: 'verdict', expected: 'Acknowledges strong demand (score >= 8)', found: `Contradictory phrase "${found}"`, severity: 'error' });
    }
  }

  const diffScore = scores.dimensions.find(d => d.dimension.toLowerCase() === 'differentiation')?.score;
  if (diffScore && diffScore >= 8) {
    const diffTexts = [report.header.verdict, report.bottom_line.verdict].join(' ');
    const found = textContainsWord(diffTexts, ['no differentiation', 'undifferentiated', 'commodity', 'looks like everyone else']);
    if (found) {
      flags.push({ check: 'semantic_consistency', field: 'verdict', expected: 'Acknowledges strong differentiation (score >= 8)', found: `Contradictory phrase "${found}"`, severity: 'error' });
    }
  }

  return flags;
}

// ============================================================================
// Check 4 -- Verdict length (HVAL-04)
// ============================================================================

export function checkVerdictLength(report: ReportOutput): HallucinationFlag[] {
  const flags: HallucinationFlag[] = [];

  for (const [field, text] of [
    ['header.verdict', report.header.verdict],
    ['bottom_line.verdict', report.bottom_line.verdict],
  ] as const) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    if (sentences.length > 1) {
      flags.push({
        check: 'verdict_length',
        field,
        expected: 'Single sentence verdict',
        found: `${sentences.length} sentences: "${text}"`,
        severity: 'warning',
      });
    }
  }

  return flags;
}

export function truncateVerdicts(report: ReportOutput): ReportOutput {
  const truncate = (text: string) => {
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    return sentences.length <= 1 ? text : sentences[0];
  };

  return {
    ...report,
    header: { ...report.header, verdict: truncate(report.header.verdict) },
    bottom_line: { ...report.bottom_line, verdict: truncate(report.bottom_line.verdict) },
  };
}

// ============================================================================
// Check 5 -- Banned word detection and replacement (HVAL-05)
// ============================================================================

const BANNED_WORD_MAP: Record<string, string> = {
  'revolutionary': 'notable',
  'game-changing': 'significant',
  'game-changer': 'significant development',
  'synergy': 'alignment',
  'disruptive': 'differentiated',
  'paradigm shift': 'major change',
  'best-in-class': 'strong',
  'cutting-edge': 'modern',
  'world-class': 'high-quality',
  'groundbreaking': 'notable',
  'unprecedented': 'unusual',
  'leverage': 'use',
  'holistic': 'comprehensive',
  'ecosystem': 'market',
  'streamline': 'simplify',
  'navigate': 'address',
  'landscape': 'competitive set',
  'empower': 'enable',
  'robust': 'strong',
  'scalable': 'growth-ready',
  'innovative': 'differentiated',
};

export function checkAndReplaceBannedWords(
  report: ReportOutput,
): { flags: HallucinationFlag[]; cleaned: ReportOutput } {
  const flags: HallucinationFlag[] = [];
  let reportStr = JSON.stringify(report);

  for (const [banned, replacement] of Object.entries(BANNED_WORD_MAP)) {
    const regex = new RegExp(banned, 'gi');
    const matches = reportStr.match(regex);
    if (matches) {
      for (const match of matches) {
        flags.push({
          check: 'banned_words',
          field: 'report_text',
          expected: `"${replacement}" (neutral alternative)`,
          found: `"${match}" (banned word)`,
          severity: 'warning',
        });
      }
      reportStr = reportStr.replace(regex, replacement);
    }
  }

  return {
    flags,
    cleaned: flags.length > 0 ? JSON.parse(reportStr) : report,
  };
}

// ============================================================================
// Orchestration -- validateReport (HVAL-06)
// ============================================================================

function runAllChecks(
  report: ReportOutput,
  research: ResearchOutput,
  scores: ScoringInput,
  founderAnswers: FounderAnswers,
): { allFlags: HallucinationFlag[]; fixedReport: ReportOutput; errorCount: number } {
  const numberFlags = checkNumbers(report, research, scores, founderAnswers);
  const companyFlags = checkCompanyNames(report, research);
  const consistencyFlags = checkScoreTextConsistency(report, scores);
  const verdictFlags = checkVerdictLength(report);
  const { flags: bannedFlags, cleaned } = checkAndReplaceBannedWords(report);

  // Apply auto-fixes
  let fixedReport = cleaned;
  if (verdictFlags.length > 0) {
    fixedReport = truncateVerdicts(fixedReport);
  }

  const allFlags = [
    ...numberFlags,
    ...companyFlags,
    ...consistencyFlags,
    ...verdictFlags,
    ...bannedFlags,
  ];

  const errorCount = allFlags.filter((f) => f.severity === 'error').length;

  return { allFlags, fixedReport, errorCount };
}

export async function validateReport(params: {
  assessmentId: string;
  founderAnswers: FounderAnswers;
  research: ResearchOutput;
  scores: ScoringInput;
  report: ReportOutput;
  maxRetries?: number;
}): Promise<{
  report: ReportOutput;
  flags: HallucinationFlag[];
  needsReview: boolean;
  attempts: number;
}> {
  const maxRetries = params.maxRetries ?? 2;

  // First pass
  let { allFlags, fixedReport, errorCount } = runAllChecks(
    params.report,
    params.research,
    params.scores,
    params.founderAnswers,
  );

  if (errorCount <= 3) {
    return { report: fixedReport, flags: allFlags, needsReview: false, attempts: 1 };
  }

  // Track best attempt
  let bestReport = fixedReport;
  let bestFlags = allFlags;
  let bestErrorCount = errorCount;

  // Retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.warn(
      `[hallucination] Retry ${attempt}/${maxRetries} -- ${errorCount} error flags exceed threshold of 3`,
    );

    const errorFlagDescriptions = allFlags
      .filter((f) => f.severity === 'error')
      .map((f) => `[${f.check}] ${f.field}: expected ${f.expected}, found ${f.found}`);

    const newReport = await generateReportWithCorrections(
      {
        assessmentId: params.assessmentId,
        founderAnswers: params.founderAnswers,
        research: params.research,
        scores: params.scores,
      },
      errorFlagDescriptions,
    );

    const result = runAllChecks(
      newReport,
      params.research,
      params.scores,
      params.founderAnswers,
    );

    allFlags = result.allFlags;
    fixedReport = result.fixedReport;
    errorCount = result.errorCount;

    if (errorCount < bestErrorCount) {
      bestReport = fixedReport;
      bestFlags = allFlags;
      bestErrorCount = errorCount;
    }

    if (errorCount <= 3) {
      return { report: fixedReport, flags: allFlags, needsReview: false, attempts: attempt + 1 };
    }
  }

  console.warn(
    `[hallucination] All ${maxRetries} retries exhausted. Using best attempt with ${bestErrorCount} error flags. Flagging needsReview.`,
  );

  return {
    report: bestReport,
    flags: bestFlags,
    needsReview: true,
    attempts: maxRetries + 1,
  };
}
