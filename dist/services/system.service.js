"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMicroInsightsByQuestion = exports.getActiveSocialProof = exports.getActiveFacts = exports.getActiveCategories = exports.getActiveQuestions = void 0;
const prisma_1 = require("../db/prisma");
const getActiveQuestions = () => prisma_1.prisma.question.findMany({
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
exports.getActiveQuestions = getActiveQuestions;
const getActiveCategories = () => prisma_1.prisma.problemCategory.findMany({
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
exports.getActiveCategories = getActiveCategories;
const getActiveFacts = (location) => prisma_1.prisma.pmfFact.findMany({
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
exports.getActiveFacts = getActiveFacts;
const getActiveSocialProof = () => prisma_1.prisma.socialProof.findMany({
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
exports.getActiveSocialProof = getActiveSocialProof;
const getMicroInsightsByQuestion = (questionId) => prisma_1.prisma.microInsight.findMany({
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
exports.getMicroInsightsByQuestion = getMicroInsightsByQuestion;
