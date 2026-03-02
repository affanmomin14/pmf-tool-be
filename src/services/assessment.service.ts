import { prisma } from '../db/prisma';
import { ProblemType, AssessmentStatus } from '../generated/prisma/client';
import { NotFoundError, ValidationError } from '../errors';

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

  return prisma.$transaction(async (tx) => {
    // Increment category usage count if category exists
    const category = await tx.problemCategory.findFirst({
      where: { slug },
    });

    if (category) {
      await tx.problemCategory.update({
        where: { id: category.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    // Create assessment with status 'started'
    return tx.assessment.create({
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
