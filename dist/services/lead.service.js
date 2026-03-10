"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLead = createLead;
const dns_1 = __importDefault(require("dns"));
const prisma_1 = require("../db/prisma");
const errors_1 = require("../errors");
const MX_TIMEOUT_MS = 5000;
async function validateEmailMx(email) {
    const domain = email.split('@')[1];
    if (!domain)
        return false;
    try {
        const records = await Promise.race([
            dns_1.default.promises.resolveMx(domain),
            new Promise((_, reject) => setTimeout(() => reject(new Error('MX lookup timeout')), MX_TIMEOUT_MS)),
        ]);
        return Array.isArray(records) && records.length > 0;
    }
    catch {
        return false;
    }
}
async function createLead(data) {
    // 1. Validate MX records
    const hasMx = await validateEmailMx(data.email);
    if (!hasMx) {
        throw new errors_1.ValidationError('Email domain does not have valid MX records');
    }
    // 2. Fetch assessment with report and lead
    const assessment = await prisma_1.prisma.assessment.findUnique({
        where: { id: data.assessmentId },
        include: {
            report: { select: { urlToken: true } },
            lead: true,
        },
    });
    if (!assessment)
        throw new errors_1.NotFoundError('Assessment not found');
    if (!assessment.report) {
        throw new errors_1.ValidationError('Assessment has no report yet. Complete the assessment first.');
    }
    // 3. Idempotent duplicate check
    if (assessment.lead) {
        return {
            leadId: assessment.lead.id,
            isUnlocked: true,
            reportToken: assessment.report.urlToken,
        };
    }
    // 4. Create lead + unlock
    const lead = await prisma_1.prisma.lead.create({
        data: {
            assessmentId: data.assessmentId,
            email: data.email,
            isUnlocked: true,
            utmSource: assessment.utmSource,
            utmMedium: assessment.utmMedium,
            utmCampaign: assessment.utmCampaign,
        },
    });
    await prisma_1.prisma.assessment.update({
        where: { id: data.assessmentId },
        data: { status: 'unlocked' },
    });
    // 5. Return
    return {
        leadId: lead.id,
        isUnlocked: true,
        reportToken: assessment.report.urlToken,
    };
}
