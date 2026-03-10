"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreAssessment = exports.runResearch = exports.completeAssessment = exports.createResponse = exports.getAssessment = exports.createAssessment = void 0;
const assessmentService = __importStar(require("../services/assessment.service"));
const pipelineService = __importStar(require("../services/pipeline.service"));
const researchService = __importStar(require("../services/research.service"));
const scoringService = __importStar(require("../services/scoring.service"));
const hash_1 = require("../utils/hash");
const logger_1 = require("../config/logger");
const createAssessment = async (req, res) => {
    const start = Date.now();
    logger_1.logger.info(`[API] POST /assessments — problemType=${req.body.problemType}`);
    const ip = req.ip || req.socket?.remoteAddress || '0.0.0.0';
    const ipHash = (0, hash_1.hashIp)(ip);
    const assessment = await assessmentService.createAssessment({
        ...req.body,
        ipHash,
    });
    logger_1.logger.info(`[API] POST /assessments → 201 — id=${assessment.id} (${Date.now() - start}ms)`);
    res.status(201).json({ success: true, data: assessment });
};
exports.createAssessment = createAssessment;
const getAssessment = async (req, res) => {
    const start = Date.now();
    const id = req.params.id;
    logger_1.logger.info(`[API] GET /assessments/${id.slice(0, 8)}…`);
    const assessment = await assessmentService.getAssessmentWithResponses(id);
    logger_1.logger.info(`[API] GET /assessments/${id.slice(0, 8)}… → 200 — status=${assessment.status}, responses=${assessment.responses.length} (${Date.now() - start}ms)`);
    res.json({ success: true, data: assessment });
};
exports.getAssessment = getAssessment;
const createResponse = async (req, res) => {
    const start = Date.now();
    const id = req.params.id;
    logger_1.logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/responses — Q${req.body.questionOrder} (questionId=${req.body.questionId})`);
    const result = await assessmentService.storeResponseWithInsight({
        assessmentId: id,
        ...req.body,
    });
    logger_1.logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/responses → 201 — responseId=${result.response.id}, hasMicroInsight=${!!result.microInsight} (${Date.now() - start}ms)`);
    res.status(201).json({ success: true, data: result });
};
exports.createResponse = createResponse;
const completeAssessment = async (req, res) => {
    const start = Date.now();
    const id = req.params.id;
    logger_1.logger.info('');
    logger_1.logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger_1.logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/complete — STARTING FULL PIPELINE`);
    logger_1.logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    const result = await pipelineService.runFullPipeline(id);
    logger_1.logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger_1.logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/complete → 200 — pmfScore=${result.pmfScore}, pmfStage=${result.pmfStage} (${Date.now() - start}ms total)`);
    logger_1.logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger_1.logger.info('');
    res.json({ success: true, data: result });
};
exports.completeAssessment = completeAssessment;
const runResearch = async (req, res) => {
    const start = Date.now();
    const id = req.params.id;
    const forceRefresh = req.query.refresh === 'true';
    logger_1.logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/research — forceRefresh=${forceRefresh}`);
    const result = await researchService.runResearch(id, forceRefresh);
    const response = {
        success: true,
        data: result,
    };
    const quality = result.researchQuality;
    const isLimited = typeof quality === 'string'
        ? quality === 'limited'
        : quality.overall === 'thin' || quality.overall === 'minimal';
    if (isLimited) {
        response.warning = 'Research data is limited for this category. Some sections may have incomplete data.';
    }
    logger_1.logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/research → 200 — quality=${typeof quality === 'string' ? quality : quality.overall}, competitors=${result.competitors?.length ?? 0} (${Date.now() - start}ms)`);
    res.json(response);
};
exports.runResearch = runResearch;
const scoreAssessment = async (req, res) => {
    const start = Date.now();
    const id = req.params.id;
    logger_1.logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/score`);
    const result = await scoringService.scoreAssessment(id);
    logger_1.logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/score → 200 — finalScore=${result.finalScore}, stage=${result.pmfStage} (${Date.now() - start}ms)`);
    res.json({
        success: true,
        data: {
            finalScore: result.finalScore,
            pmfStage: result.pmfStage,
            primaryBreak: result.primaryBreak,
            secondaryBreak: result.secondaryBreak,
            founderMismatch: result.founderMismatch,
            dimensions: result.dimensions,
            benchmarks: result.benchmarks,
        },
    });
};
exports.scoreAssessment = scoreAssessment;
