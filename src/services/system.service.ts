import { prisma } from '../db/prisma';

export const getActiveQuestions = () =>
  prisma.question.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      questionText: true,
      questionType: true,
      placeholder: true,
      options: true,
      displayOrder: true,
    },
  });

export const getActiveCategories = () =>
  prisma.problemCategory.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      iconUrl: true,
      usageCount: true,
      displayOrder: true,
    },
  });

export const getActiveFacts = (location?: string) =>
  prisma.pmfFact.findMany({
    where: {
      isActive: true,
      ...(location ? { displayLocation: location } : {}),
    },
    select: {
      id: true,
      factText: true,
      source: true,
      displayLocation: true,
    },
  });

export const getActiveSocialProof = () =>
  prisma.socialProof.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      quote: true,
      authorName: true,
      authorTitle: true,
      companyName: true,
      proofType: true,
      displayOrder: true,
    },
  });

export const getMicroInsightsByQuestion = (questionId: number) =>
  prisma.microInsight.findMany({
    where: { questionId, isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      insightText: true,
      source: true,
      triggerKeywords: true,
      displayOrder: true,
    },
  });
