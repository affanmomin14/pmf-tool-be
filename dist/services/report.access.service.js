"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReportByToken = getReportByToken;
const prisma_1 = require("../db/prisma");
const errors_1 = require("../errors");
async function getReportByToken(token) {
    const report = await prisma_1.prisma.report.findUnique({
        where: { urlToken: token },
        include: {
            assessment: {
                include: { lead: { select: { isUnlocked: true } } },
            },
        },
    });
    if (!report)
        throw new errors_1.NotFoundError('Report not found');
    const isExpired = report.expiresAt < new Date();
    const isUnlocked = report.assessment.lead?.isUnlocked === true;
    if (isExpired) {
        return {
            isExpired: true,
            isUnlocked,
            report: null,
            previewContent: report.previewContent,
        };
    }
    if (!isUnlocked) {
        return {
            isExpired: false,
            isUnlocked: false,
            report: null,
            previewContent: report.previewContent,
            pmfScore: report.pmfScore,
            pmfStage: report.pmfStage,
        };
    }
    return {
        isExpired: false,
        isUnlocked: true,
        report: report.content,
        previewContent: report.previewContent,
        pmfScore: report.pmfScore,
        pmfStage: report.pmfStage,
        primaryBreak: report.primaryBreak,
    };
}
