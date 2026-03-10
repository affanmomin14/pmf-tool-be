"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFullPipeline = runFullPipeline;
const classification_service_1 = require("./classification.service");
const research_service_1 = require("./research.service");
const scoring_service_1 = require("./scoring.service");
const report_service_1 = require("./report.service");
const hallucination_service_1 = require("./hallucination.service");
const prisma_1 = require("../db/prisma");
const token_1 = require("../utils/token");
const env_1 = require("../config/env");
const errors_1 = require("../errors");
const logger_1 = require("../config/logger");
// ============================================================================
// Pipeline Logger — rich step-by-step trace for monitoring
// ============================================================================
class PipelineLogger {
    constructor(assessmentId) {
        this.stepStart = 0;
        this.currentStep = 0;
        this.assessmentId = assessmentId;
        this.pipelineStart = Date.now();
    }
    shortId() {
        return this.assessmentId.slice(0, 8);
    }
    elapsed() {
        return `${Date.now() - this.pipelineStart}ms`;
    }
    stepElapsed() {
        return `${Date.now() - this.stepStart}ms`;
    }
    banner() {
        logger_1.logger.info('');
        logger_1.logger.info(`╔══════════════════════════════════════════════════════════════╗`);
        logger_1.logger.info(`║  🚀 PIPELINE START — Assessment ${this.shortId()}…               ║`);
        logger_1.logger.info(`║  Full ID: ${this.assessmentId}  ║`);
        logger_1.logger.info(`║  Time: ${new Date().toISOString()}                     ║`);
        logger_1.logger.info(`╚══════════════════════════════════════════════════════════════╝`);
    }
    stepBegin(stepNum, title, details) {
        this.currentStep = stepNum;
        this.stepStart = Date.now();
        logger_1.logger.info('');
        logger_1.logger.info(`┌─── Step ${stepNum} │ ${title} ───────────────────────────`);
        logger_1.logger.info(`│  ⏱  Pipeline elapsed: ${this.elapsed()}`);
        if (details) {
            for (const [k, v] of Object.entries(details)) {
                const value = typeof v === 'object' ? JSON.stringify(v) : String(v);
                logger_1.logger.info(`│  📋 ${k}: ${value}`);
            }
        }
    }
    stepEnd(title, details) {
        if (details) {
            for (const [k, v] of Object.entries(details)) {
                const value = typeof v === 'object' ? JSON.stringify(v) : String(v);
                logger_1.logger.info(`│  ✅ ${k}: ${value}`);
            }
        }
        logger_1.logger.info(`│  ⏱  Step took: ${this.stepElapsed()}`);
        logger_1.logger.info(`└─── Step ${this.currentStep} │ ${title} DONE ─────────────`);
    }
    stepSkip(stepNum, title, reason) {
        logger_1.logger.info('');
        logger_1.logger.info(`┌─── Step ${stepNum} │ ${title} ───────────────────────────`);
        logger_1.logger.info(`│  ⏭  SKIPPED: ${reason}`);
        logger_1.logger.info(`└─── Step ${stepNum} │ ${title} ─────────────────────────`);
    }
    idempotent() {
        logger_1.logger.info('');
        logger_1.logger.info(`┌─── 🔄 IDEMPOTENT HIT ───────────────────────────────────────`);
        logger_1.logger.info(`│  Report already exists for ${this.shortId()}…`);
        logger_1.logger.info(`│  Returning cached report. No pipeline work needed.`);
        logger_1.logger.info(`└──────────────────────────────────────────────────────────────`);
    }
    finish(result) {
        const totalMs = Date.now() - this.pipelineStart;
        logger_1.logger.info('');
        logger_1.logger.info(`╔══════════════════════════════════════════════════════════════╗`);
        logger_1.logger.info(`║  🏁 PIPELINE COMPLETE — ${this.shortId()}…                       ║`);
        logger_1.logger.info(`║  Total time: ${totalMs}ms${totalMs > 15000 ? ' ⚠️  EXCEEDS 15s TARGET' : ''}                                    ║`);
        for (const [k, v] of Object.entries(result)) {
            logger_1.logger.info(`║  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
        }
        logger_1.logger.info(`╚══════════════════════════════════════════════════════════════╝`);
        logger_1.logger.info('');
    }
    error(step, err) {
        logger_1.logger.error(`│  ❌ FAILED at "${step}": ${err instanceof Error ? err.message : String(err)}`);
        logger_1.logger.error(`│  Pipeline elapsed before failure: ${this.elapsed()}`);
    }
}
// ============================================================================
// Helper: Build FounderAnswers from assessment responses
// ============================================================================
function buildFounderAnswers(responses) {
    const get = (order) => {
        const r = responses.find((r) => r.questionOrder === order);
        return r?.answerText || r?.answerValue || '';
    };
    // Q3 uses answerValue first (single_select) with answerText fallback
    // Q1=product, Q2=ICP, Q3=distribution model, Q4=pain/stuck, Q5=traction
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
function scoreToLabel(score) {
    if (score <= 3)
        return 'critical';
    if (score <= 5)
        return 'weak';
    if (score <= 6)
        return 'moderate';
    if (score <= 8)
        return 'solid';
    return 'strong';
}
// ============================================================================
// Helper: Transform ScoreData (scoring.service) -> ScoringInput (report.service)
// ============================================================================
function buildScoringInputForReport(scoreData) {
    const dimensionNames = [
        { key: 'demand', display: 'Demand' },
        { key: 'icpFocus', display: 'ICP Focus' },
        { key: 'differentiation', display: 'Differentiation' },
        { key: 'distributionFit', display: 'Distribution Fit' },
        { key: 'problemSeverity', display: 'Problem Severity' },
        { key: 'competitivePosition', display: 'Competitive Position' },
        { key: 'trustAndProof', display: 'Trust & Proof' },
    ];
    // Compute weighted benchmark from per-dimension benchmarks
    let weightedBenchmark = 0;
    for (const { key } of dimensionNames) {
        const dimBenchmark = scoreData.benchmarks[key] ?? 70;
        const weight = scoreData.weights[key] ?? 0;
        weightedBenchmark += dimBenchmark * weight;
    }
    const benchmark = Math.round(weightedBenchmark);
    return {
        dimensions: dimensionNames.map(({ key, display }) => ({
            dimension: display,
            score: scoreData.dimensions[key].score,
            label: scoreToLabel(scoreData.dimensions[key].score),
            weight: scoreData.weights[key],
            confidence: scoreData.dimensions[key].confidence,
        })),
        pmfScore: scoreData.finalScore,
        pmfStage: scoreData.pmfStage,
        primaryBreak: scoreData.primaryBreak,
        secondaryBreak: scoreData.secondaryBreak,
        benchmark,
        dimensionBenchmarks: scoreData.benchmarks,
        founderMismatch: scoreData.founderMismatch,
        founderIdentifiedDimension: scoreData.founderIdentifiedDimension,
    };
}
// ============================================================================
// Helper: Extract preview content for Report record
// ============================================================================
function extractPreviewContent(report, scoreData) {
    // Extract top "aligned" comparisons as strengths for preview
    const strengths = report.reality_check.comparisons
        .filter((c) => c.severity === 'aligned')
        .map((c) => c.research_shows)
        .slice(0, 2);
    return {
        pmfScore: scoreData.finalScore,
        pmfStage: scoreData.pmfStage,
        verdict: report.header.verdict,
        strengths: strengths.length > 0 ? strengths : [report.bottom_line.working[0] ?? 'N/A'],
        primaryBreak: scoreData.primaryBreak,
    };
}
// ============================================================================
// Main pipeline orchestrator
// ============================================================================
async function runFullPipeline(assessmentId) {
    const log = new PipelineLogger(assessmentId);
    log.banner();
    // ── Fetch assessment for status check ──
    log.stepBegin(0, 'FETCH ASSESSMENT');
    const assessment = await prisma_1.prisma.assessment.findUnique({
        where: { id: assessmentId },
        select: {
            id: true,
            status: true,
            classificationData: true,
        },
    });
    if (!assessment) {
        log.error('Fetch assessment', `Assessment ${assessmentId} not found`);
        throw new errors_1.NotFoundError(`Assessment ${assessmentId} not found`);
    }
    log.stepEnd('FETCH ASSESSMENT', {
        status: assessment.status,
        hasClassificationData: !!assessment.classificationData,
    });
    // ── Step 0: Idempotency check ──
    if (assessment.status === 'report_generated' || assessment.status === 'unlocked') {
        log.idempotent();
        const existingReport = await prisma_1.prisma.report.findUnique({
            where: { assessmentId },
            select: {
                urlToken: true,
                previewContent: true,
                pmfScore: true,
                pmfStage: true,
            },
        });
        if (existingReport) {
            log.finish({
                source: 'CACHED',
                pmfScore: existingReport.pmfScore,
                pmfStage: existingReport.pmfStage,
            });
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
        log.error('Status guard', 'Assessment has no responses yet');
        throw new errors_1.ValidationError('Assessment must have responses before running pipeline. Current status: started');
    }
    if (assessment.status !== 'in_progress' && assessment.status !== 'completed') {
        log.error('Status guard', `Invalid status: ${assessment.status}`);
        throw new errors_1.ValidationError(`Assessment cannot run pipeline. Current status: ${assessment.status}`);
    }
    const start = Date.now();
    // ── Step 1: Classify ──
    let classification;
    if (assessment.status === 'in_progress') {
        log.stepBegin(1, 'CLASSIFICATION (AI)', { source: 'OpenAI call' });
        try {
            classification = await (0, classification_service_1.classifyAssessment)(assessmentId);
            log.stepEnd('CLASSIFICATION', {
                category: classification?.category,
                subCategory: classification?.sub_category,
                confidence: classification?.confidence,
            });
        }
        catch (err) {
            log.error('Classification', err);
            throw err;
        }
    }
    else {
        log.stepSkip(1, 'CLASSIFICATION', 'Already classified (status=completed), using stored data');
        classification = assessment.classificationData;
    }
    // ── Step 2: Research (Web Search) ──
    log.stepBegin(2, 'RESEARCH (Web Search)', {
        note: 'Parallel web searches for competitors, market, complaints, patterns',
    });
    let research;
    try {
        research = await (0, research_service_1.runResearch)(assessmentId);
        log.stepEnd('RESEARCH', {
            competitors: research.competitors?.length ?? 0,
            marketTAM: research.market?.tam ?? 'N/A',
            marketGrowth: research.market?.growthRate ?? 'N/A',
            complaints: research.complaints?.length ?? 0,
            researchQuality: research.researchQuality,
        });
    }
    catch (err) {
        log.error('Research', err);
        throw err;
    }
    // ── Step 3: Scoring ──
    log.stepBegin(3, 'SCORING (Deterministic)', {
        note: '7-dimension weighted scoring algorithm',
    });
    let scoreData;
    try {
        scoreData = await (0, scoring_service_1.scoreAssessment)(assessmentId);
        const dimSummary = {};
        for (const [key, val] of Object.entries(scoreData.dimensions)) {
            dimSummary[key] = val.score;
        }
        log.stepEnd('SCORING', {
            finalScore: scoreData.finalScore,
            pmfStage: scoreData.pmfStage,
            primaryBreak: scoreData.primaryBreak,
            secondaryBreak: scoreData.secondaryBreak,
            founderMismatch: scoreData.founderMismatch,
            dimensions: dimSummary,
        });
    }
    catch (err) {
        log.error('Scoring', err);
        throw err;
    }
    // ── Step 4: Prepare report inputs ──
    log.stepBegin(4, 'PREPARE REPORT INPUTS', {
        note: 'Re-fetch responses, build founderAnswers & scoringInput',
    });
    const assessmentWithResponses = await prisma_1.prisma.assessment.findUnique({
        where: { id: assessmentId },
        include: { responses: { orderBy: { questionOrder: 'asc' } } },
    });
    const founderAnswers = buildFounderAnswers(assessmentWithResponses.responses);
    const scoringInput = buildScoringInputForReport(scoreData);
    log.stepEnd('PREPARE REPORT INPUTS', {
        responsesCount: assessmentWithResponses.responses.length,
        q1_product: founderAnswers.q1_product.slice(0, 80) + (founderAnswers.q1_product.length > 80 ? '…' : ''),
        q2_icp: founderAnswers.q2_icp.slice(0, 80) + (founderAnswers.q2_icp.length > 80 ? '…' : ''),
        q3_distribution: founderAnswers.q3_distribution,
        scoringDimensions: scoringInput.dimensions.length,
    });
    // ── Step 5: Generate report (AI) ──
    log.stepBegin(5, 'GENERATE REPORT (AI)', {
        model: env_1.env.OPENAI_REPORT_MODEL,
        note: 'Full report generation via OpenAI structured output',
    });
    let rawReport;
    try {
        rawReport = await (0, report_service_1.generateReport)({
            assessmentId,
            founderAnswers,
            research,
            scores: scoringInput,
            classificationData: classification,
        });
        log.stepEnd('GENERATE REPORT', {
            productName: rawReport.header.product_name,
            category: rawReport.header.category,
            headerPmfScore: rawReport.header.pmf_score,
            verdict: rawReport.header.verdict.slice(0, 100) + '…',
            comparisons: rawReport.reality_check.comparisons.length,
            competitors: rawReport.competitors.competitor_list.length,
            recommendations: rawReport.recommendations.length,
        });
    }
    catch (err) {
        log.error('Generate report', err);
        throw err;
    }
    // ── Step 6: Hallucination validation ──
    log.stepBegin(6, 'HALLUCINATION VALIDATION', {
        checks: 'HVAL-01 numbers, HVAL-02 companies, HVAL-03 score-text, HVAL-04 verdict, HVAL-05 banned words',
    });
    let validated;
    try {
        validated = await (0, hallucination_service_1.validateReport)({
            assessmentId,
            founderAnswers,
            research,
            scores: scoringInput,
            report: rawReport,
            classificationData: classification,
        });
        const errorFlags = validated.flags.filter((f) => f.severity === 'error');
        const warnFlags = validated.flags.filter((f) => f.severity === 'warning');
        log.stepEnd('HALLUCINATION VALIDATION', {
            totalFlags: validated.flags.length,
            errors: errorFlags.length,
            warnings: warnFlags.length,
            needsReview: validated.needsReview,
            attempts: validated.attempts,
            flagDetails: validated.flags.map((f) => `[${f.severity}] ${f.check}: ${f.field}`),
        });
    }
    catch (err) {
        log.error('Hallucination validation', err);
        throw err;
    }
    // ── Step 7: Extract preview content ──
    log.stepBegin(7, 'EXTRACT PREVIEW');
    const previewContent = extractPreviewContent(validated.report, scoreData);
    log.stepEnd('EXTRACT PREVIEW', {
        pmfScore: previewContent.pmfScore,
        pmfStage: previewContent.pmfStage,
        verdict: previewContent.verdict.slice(0, 80) + '…',
        strengths: previewContent.strengths,
        primaryBreak: previewContent.primaryBreak,
    });
    // ── Step 8: Aggregate AI metadata ──
    log.stepBegin(8, 'AGGREGATE AI METADATA');
    const aiLogs = await prisma_1.prisma.aiLog.findMany({
        where: { assessmentId },
        select: { totalTokens: true, costCents: true, promptName: true },
    });
    const totalTokens = aiLogs.reduce((sum, l) => sum + l.totalTokens, 0);
    const totalCost = aiLogs.reduce((sum, l) => sum + l.costCents, 0);
    log.stepEnd('AGGREGATE AI METADATA', {
        aiCalls: aiLogs.length,
        totalTokens,
        totalCostCents: totalCost,
        breakdown: aiLogs.map((l) => `${l.promptName}: ${l.totalTokens} tokens, ${l.costCents}¢`),
    });
    // ── Step 9: Create Report record ──
    log.stepBegin(9, 'SAVE REPORT TO DB');
    const urlToken = (0, token_1.generateToken)();
    const expiresAt = new Date(Date.now() + env_1.env.REPORT_EXPIRY_DAYS * 86400000);
    const totalLatencyMs = Date.now() - start;
    if (totalLatencyMs > 15000) {
        logger_1.logger.warn(`[pipeline] Assessment ${assessmentId} took ${totalLatencyMs}ms (exceeds 15s target)`);
    }
    await prisma_1.prisma.report.create({
        data: {
            assessmentId,
            content: validated.report,
            scores: scoreData,
            previewContent: previewContent,
            intermediateArtifacts: {
                classification,
                researchQuality: research.researchQuality,
                hallucinationFlags: validated.flags,
                needsReview: validated.needsReview,
                attempts: validated.attempts,
            },
            pmfScore: scoreData.finalScore,
            pmfStage: scoreData.pmfStage,
            primaryBreak: scoreData.primaryBreak,
            aiModel: env_1.env.OPENAI_REPORT_MODEL,
            aiTokensUsed: totalTokens,
            aiCostCents: totalCost,
            aiLatencyMs: totalLatencyMs,
            urlToken,
            expiresAt,
        },
    });
    log.stepEnd('SAVE REPORT TO DB', {
        reportToken: urlToken,
        expiresAt: expiresAt.toISOString(),
        totalLatencyMs,
    });
    // ── Step 10: Transition status ──
    log.stepBegin(10, 'TRANSITION STATUS', {
        from: assessment.status,
        to: 'report_generated',
    });
    await prisma_1.prisma.assessment.update({
        where: { id: assessmentId },
        data: { status: 'report_generated' },
    });
    log.stepEnd('TRANSITION STATUS', { newStatus: 'report_generated' });
    // ── Pipeline complete ──
    const result = {
        reportToken: urlToken,
        previewContent,
        pmfScore: scoreData.finalScore,
        pmfStage: scoreData.pmfStage,
    };
    log.finish({
        pmfScore: scoreData.finalScore,
        pmfStage: scoreData.pmfStage,
        primaryBreak: scoreData.primaryBreak,
        totalLatencyMs,
        totalTokens,
        totalCostCents: totalCost,
        reportToken: urlToken,
    });
    return result;
}
