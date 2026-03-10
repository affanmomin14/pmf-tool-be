import { prisma } from '../db/prisma';
import { ProblemType, AssessmentStatus, Prisma } from '../generated/prisma/client';
import { NotFoundError, ValidationError } from '../errors';
import { sanitizeInput } from '../utils/sanitize';

// Explicit mapping: ProblemType enum values -> ProblemCategory slugs
// NOTE: product_quality maps to 'positioning' (not 'product-quality')
const PROBLEM_TYPE_TO_SLUG: Record<string, string> = {
  market_fit: 'market-fit',
  product_quality: 'positioning',
  distribution: 'distribution',
  monetization: 'monetization',
  retention: 'retention',
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  started: ['in_progress'],
  in_progress: ['completed'],
  completed: ['report_generated'],
  report_generated: ['unlocked'],
};

export const createAssessment = async (data: {
  problemType: ProblemType;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  ipHash: string;
}) => {
  const slug = PROBLEM_TYPE_TO_SLUG[data.problemType];

  // Increment category usage count (non-critical, no transaction needed)
  const category = await prisma.problemCategory.findFirst({
    where: { slug },
  });

  if (category) {
    await prisma.problemCategory.update({
      where: { id: category.id },
      data: { usageCount: { increment: 1 } },
    });
  }

  // Create assessment with status 'started'
  return prisma.assessment.create({
    data: {
      problemType: data.problemType,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      ipHash: data.ipHash,
      status: 'started',
    },
    select: {
      id: true,
      problemType: true,
      status: true,
      createdAt: true,
    },
  });
};

export const getAssessmentWithResponses = async (id: string) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    select: {
      id: true,
      problemType: true,
      status: true,
      createdAt: true,
      responses: {
        orderBy: { questionOrder: 'asc' },
        select: {
          id: true,
          questionId: true,
          answerText: true,
          answerValue: true,
          timeSpentMs: true,
          questionOrder: true,
        },
      },
    },
  });

  if (!assessment) throw new NotFoundError('Assessment not found');
  return assessment;
};

export const getReportInfoByAssessmentId = async (assessmentId: string) => {
  return prisma.report.findUnique({
    where: { assessmentId },
    select: {
      urlToken: true,
      previewContent: true,
      pmfScore: true,
      pmfStage: true,
    },
  });
};

export const transitionStatus = async (
  assessmentId: string,
  newStatus: AssessmentStatus,
) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { status: true },
  });

  if (!assessment) throw new NotFoundError('Assessment not found');

  const allowed = VALID_TRANSITIONS[assessment.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `Cannot transition from ${assessment.status} to ${newStatus}`,
    );
  }

  return prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: newStatus },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  });
};

export const storeResponseWithInsight = async (data: {
  assessmentId: string;
  questionId: number;
  answerText?: string;
  answerValue?: string;
  timeSpentMs?: number;
  questionOrder: number;
}) => {
  // 1. Verify assessment exists and get current status
  const assessment = await prisma.assessment.findUnique({
    where: { id: data.assessmentId },
    select: { id: true, status: true },
  });
  if (!assessment) throw new NotFoundError('Assessment not found');

  // 2. Create response with sanitized answerText; handle P2002 duplicate
  let response;
  try {
    response = await prisma.response.create({
      data: {
        assessmentId: data.assessmentId,
        questionId: data.questionId,
        answerText: data.answerText ? sanitizeInput(data.answerText) : null,
        answerValue: data.answerValue || null,
        timeSpentMs: data.timeSpentMs || null,
        questionOrder: data.questionOrder,
      },
      select: {
        id: true,
        questionId: true,
        answerText: true,
        answerValue: true,
        questionOrder: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // Duplicate response for this question -- return existing
      const existing = await prisma.response.findFirst({
        where: {
          assessmentId: data.assessmentId,
          questionId: data.questionId,
        },
        select: {
          id: true,
          questionId: true,
          answerText: true,
          answerValue: true,
          questionOrder: true,
        },
      });
      if (existing) {
        response = existing;
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  // 3. Auto-transition started -> in_progress on first response (idempotent)
  if (assessment.status === 'started') {
    await prisma.assessment.updateMany({
      where: { id: data.assessmentId, status: 'started' },
      data: { status: 'in_progress' },
    });
  }

  // 4. Get a random micro-insight for this questionId
  const insights = await prisma.microInsight.findMany({
    where: { questionId: data.questionId, isActive: true },
    select: { insightText: true, source: true },
  });
  const microInsight =
    insights.length > 0
      ? insights[Math.floor(Math.random() * insights.length)]
      : null;

  return { response, microInsight };
};
