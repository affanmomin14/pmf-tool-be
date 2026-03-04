import { classifyAssessment } from './classification.service';
import { runResearch } from './research.service';
import { scoreAssessment } from './scoring.service';
import { generateReport } from './report.service';
import { validateReport } from './hallucination.service';
import { prisma } from '../db/prisma';
import { generateToken } from '../utils/token';
import { env } from '../config/env';
import { NotFoundError, ValidationError } from '../errors';
import type { FounderAnswers, ScoringInput, ReportOutput } from '../schemas/report.schema';
import type { ScoreData } from '../schemas/scoring.schema';
import type { ResearchOutput } from '../schemas/research.schema';

// ============================================================================
// Helper: Build FounderAnswers from assessment responses
// ============================================================================

function buildFounderAnswers(
  responses: Array<{ questionOrder: number; answerText: string | null; answerValue: string | null }>,
): FounderAnswers {
  const get = (order: number): string => {
    const r = responses.find((r) => r.questionOrder === order);
    return r?.answerText || r?.answerValue || '';
  };
  // Q3 uses answerValue first (single_select) with answerText fallback (project decision [04-02])
  const q3 = responses.find((r) => r.questionOrder === 3);
  return {
    q1_product: get(1),
    q2_icp: get(2),
    q3_distribution: q3?.answerValue || q3?.answerText || '',
    q4_stuck: get(4),
    q5_traction: get(5),
  };
}

// ============================================================================
// Helper: Score label mapping
// ============================================================================

function scoreToLabel(score: number): 'critical' | 'weak' | 'moderate' | 'solid' | 'strong' {
  if (score <= 3) return 'critical';
  if (score <= 5) return 'weak';
  if (score <= 6) return 'moderate';
  if (score <= 8) return 'solid';
  return 'strong';
}

// ============================================================================
// Helper: Transform ScoreData (scoring.service) -> ScoringInput (report.service)
// ============================================================================

function buildScoringInputForReport(scoreData: ScoreData): ScoringInput {
  const dimensionNames: Array<{ key: string; display: string }> = [
    { key: 'demand', display: 'Demand' },
    { key: 'icpFocus', display: 'ICP Focus' },
    { key: 'differentiation', display: 'Differentiation' },
    { key: 'distributionFit', display: 'Distribution Fit' },
    { key: 'problemSeverity', display: 'Problem Severity' },
    { key: 'competitivePosition', display: 'Competitive Position' },
    { key: 'trustAndProof', display: 'Trust & Proof' },
  ];

  return {
    dimensions: dimensionNames.map(({ key, display }) => ({
      dimension: display,
      score: scoreData.dimensions[key as keyof typeof scoreData.dimensions].score,
      label: scoreToLabel(scoreData.dimensions[key as keyof typeof scoreData.dimensions].score),
      weight: scoreData.weights[key],
    })),
    pmfScore: scoreData.finalScore,
    pmfStage: scoreData.pmfStage,
    primaryBreak: scoreData.primaryBreak,
    benchmark: 70, // Default benchmark (SCOR-06)
  };
}

// ============================================================================
// Helper: Extract preview content for Report record
// ============================================================================

function extractPreviewContent(report: ReportOutput, scoreData: ScoreData) {
  return {
    pmfScore: scoreData.finalScore,
    pmfStage: scoreData.pmfStage,
    verdict: report.header.verdict,
    strengths: report.reality_check.strengths.slice(0, 2),
    primaryBreak: scoreData.primaryBreak,
  };
}

// ============================================================================
// Main pipeline orchestrator
// ============================================================================

export async function runFullPipeline(assessmentId: string) {
  // Fetch assessment for status check
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      status: true,
      classificationData: true,
    },
  });

  if (!assessment) {
    throw new NotFoundError(`Assessment ${assessmentId} not found`);
  }

  // Step 0: Idempotency -- if already report_generated or unlocked, return existing report
  if (assessment.status === 'report_generated' || assessment.status === 'unlocked') {
    const existingReport = await prisma.report.findUnique({
      where: { assessmentId },
      select: {
        urlToken: true,
        previewContent: true,
        pmfScore: true,
        pmfStage: true,
      },
    });
    if (existingReport) {
      return {
        reportToken: existingReport.urlToken,
        previewContent: existingReport.previewContent,
        pmfScore: existingReport.pmfScore,
        pmfStage: existingReport.pmfStage,
      };
    }
  }

  // Status guard
  if (assessment.status === 'started') {
    throw new ValidationError(
      'Assessment must have responses before running pipeline. Current status: started',
    );
  }
  if (assessment.status !== 'in_progress' && assessment.status !== 'completed') {
    throw new ValidationError(
      `Assessment cannot run pipeline. Current status: ${assessment.status}`,
    );
  }

  const start = Date.now();

  // Step 1: Classify (skip if already completed)
  let classification;
  if (assessment.status === 'in_progress') {
    classification = await classifyAssessment(assessmentId);
  } else {
    // Already classified (status === 'completed'), use stored classificationData
    classification = assessment.classificationData;
  }

  // Step 2: Research
  const research = await runResearch(assessmentId) as ResearchOutput;

  // Step 3: Score
  const scoreData = await scoreAssessment(assessmentId) as ScoreData;

  // Step 4: Prepare report inputs -- re-fetch with responses
  const assessmentWithResponses = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { responses: { orderBy: { questionOrder: 'asc' } } },
  });
  const founderAnswers = buildFounderAnswers(assessmentWithResponses!.responses);
  const scoringInput = buildScoringInputForReport(scoreData);

  // Step 5: Generate report
  const rawReport = await generateReport({
    assessmentId,
    founderAnswers,
    research,
    scores: scoringInput,
  });

  // Step 6: Validate (hallucination checks + retry)
  const validated = await validateReport({
    assessmentId,
    founderAnswers,
    research,
    scores: scoringInput,
    report: rawReport,
  });

  // Step 7: Extract preview
  const previewContent = extractPreviewContent(validated.report, scoreData);

  // Step 8: Aggregate AI metadata
  const aiLogs = await prisma.aiLog.findMany({
    where: { assessmentId },
    select: { totalTokens: true, costCents: true },
  });
  const totalTokens = aiLogs.reduce((sum, l) => sum + l.totalTokens, 0);
  const totalCost = aiLogs.reduce((sum, l) => sum + l.costCents, 0);

  // Step 9: Create Report record
  const urlToken = generateToken();
  const expiresAt = new Date(Date.now() + env.REPORT_EXPIRY_DAYS * 86400000);
  const totalLatencyMs = Date.now() - start;

  if (totalLatencyMs > 15000) {
    console.warn(
      `[pipeline] Assessment ${assessmentId} took ${totalLatencyMs}ms (exceeds 15s target)`,
    );
  }

  await prisma.report.create({
    data: {
      assessmentId,
      content: validated.report as any,
      scores: scoreData as any,
      previewContent: previewContent as any,
      intermediateArtifacts: {
        classification,
        researchQuality: research.researchQuality,
        hallucinationFlags: validated.flags,
        needsReview: validated.needsReview,
        attempts: validated.attempts,
      } as any,
      pmfScore: scoreData.finalScore,
      pmfStage: scoreData.pmfStage,
      primaryBreak: scoreData.primaryBreak,
      aiModel: env.OPENAI_MODEL,
      aiTokensUsed: totalTokens,
      aiCostCents: totalCost,
      aiLatencyMs: totalLatencyMs,
      urlToken,
      expiresAt,
    },
  });

  // Step 10: Transition status
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: 'report_generated' },
  });

  return {
    reportToken: urlToken,
    previewContent,
    pmfScore: scoreData.finalScore,
    pmfStage: scoreData.pmfStage,
  };
}
