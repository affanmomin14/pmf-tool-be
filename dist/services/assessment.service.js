"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeResponseWithInsight = exports.transitionStatus = exports.getAssessmentWithResponses = exports.createAssessment = void 0;
const prisma_1 = require("../db/prisma");
const client_1 = require("../generated/prisma/client");
const errors_1 = require("../errors");
const sanitize_1 = require("../utils/sanitize");
// Explicit mapping: ProblemType enum values -> ProblemCategory slugs
// NOTE: product_quality maps to 'positioning' (not 'product-quality')
const PROBLEM_TYPE_TO_SLUG = {
    market_fit: 'market-fit',
    product_quality: 'positioning',
    distribution: 'distribution',
    monetization: 'monetization',
    retention: 'retention',
};
const VALID_TRANSITIONS = {
    started: ['in_progress'],
    in_progress: ['completed'],
    completed: ['report_generated'],
    report_generated: ['unlocked'],
};
const createAssessment = async (data) => {
    const slug = PROBLEM_TYPE_TO_SLUG[data.problemType];
    // Increment category usage count (non-critical, no transaction needed)
    const category = await prisma_1.prisma.problemCategory.findFirst({
        where: { slug },
    });
    if (category) {
        await prisma_1.prisma.problemCategory.update({
            where: { id: category.id },
            data: { usageCount: { increment: 1 } },
        });
    }
    // Create assessment with status 'started'
    return prisma_1.prisma.assessment.create({
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
exports.createAssessment = createAssessment;
const getAssessmentWithResponses = async (id) => {
    const assessment = await prisma_1.prisma.assessment.findUnique({
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
    if (!assessment)
        throw new errors_1.NotFoundError('Assessment not found');
    return assessment;
};
exports.getAssessmentWithResponses = getAssessmentWithResponses;
const transitionStatus = async (assessmentId, newStatus) => {
    const assessment = await prisma_1.prisma.assessment.findUnique({
        where: { id: assessmentId },
        select: { status: true },
    });
    if (!assessment)
        throw new errors_1.NotFoundError('Assessment not found');
    const allowed = VALID_TRANSITIONS[assessment.status] || [];
    if (!allowed.includes(newStatus)) {
        throw new errors_1.ValidationError(`Cannot transition from ${assessment.status} to ${newStatus}`);
    }
    return prisma_1.prisma.assessment.update({
        where: { id: assessmentId },
        data: { status: newStatus },
        select: {
            id: true,
            status: true,
            updatedAt: true,
        },
    });
};
exports.transitionStatus = transitionStatus;
const storeResponseWithInsight = async (data) => {
    // 1. Verify assessment exists and get current status
    const assessment = await prisma_1.prisma.assessment.findUnique({
        where: { id: data.assessmentId },
        select: { id: true, status: true },
    });
    if (!assessment)
        throw new errors_1.NotFoundError('Assessment not found');
    // 2. Create response with sanitized answerText; handle P2002 duplicate
    let response;
    try {
        response = await prisma_1.prisma.response.create({
            data: {
                assessmentId: data.assessmentId,
                questionId: data.questionId,
                answerText: data.answerText ? (0, sanitize_1.sanitizeInput)(data.answerText) : null,
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
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002') {
            // Duplicate response for this question -- return existing
            const existing = await prisma_1.prisma.response.findFirst({
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
            }
            else {
                throw error;
            }
        }
        else {
            throw error;
        }
    }
    // 3. Auto-transition started -> in_progress on first response (idempotent)
    if (assessment.status === 'started') {
        await prisma_1.prisma.assessment.updateMany({
            where: { id: data.assessmentId, status: 'started' },
            data: { status: 'in_progress' },
        });
    }
    // 4. Get a random micro-insight for this questionId
    const insights = await prisma_1.prisma.microInsight.findMany({
        where: { questionId: data.questionId, isActive: true },
        select: { insightText: true, source: true },
    });
    const microInsight = insights.length > 0
        ? insights[Math.floor(Math.random() * insights.length)]
        : null;
    return { response, microInsight };
};
exports.storeResponseWithInsight = storeResponseWithInsight;
