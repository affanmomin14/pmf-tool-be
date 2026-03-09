import { Request, Response } from 'express';
import * as assessmentService from '../services/assessment.service';
import * as pipelineService from '../services/pipeline.service';
import * as researchService from '../services/research.service';
import * as scoringService from '../services/scoring.service';
import { hashIp } from '../utils/hash';
import { logger } from '../config/logger';

export const createAssessment = async (req: Request, res: Response) => {
  const start = Date.now();
  logger.info(`[API] POST /assessments — problemType=${req.body.problemType}`);
  const ip = req.ip || req.socket?.remoteAddress || '0.0.0.0';
  const ipHash = hashIp(ip);
  const assessment = await assessmentService.createAssessment({
    ...req.body,
    ipHash,
  });
  logger.info(`[API] POST /assessments → 201 — id=${assessment.id} (${Date.now() - start}ms)`);
  res.status(201).json({ success: true, data: assessment });
};

export const getAssessment = async (req: Request, res: Response) => {
  const start = Date.now();
  const id = req.params.id as string;
  logger.info(`[API] GET /assessments/${id.slice(0, 8)}…`);
  const assessment = await assessmentService.getAssessmentWithResponses(id);
  logger.info(`[API] GET /assessments/${id.slice(0, 8)}… → 200 — status=${assessment.status}, responses=${assessment.responses.length} (${Date.now() - start}ms)`);
  res.json({ success: true, data: assessment });
};

export const createResponse = async (req: Request, res: Response) => {
  const start = Date.now();
  const id = req.params.id as string;
  logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/responses — Q${req.body.questionOrder} (questionId=${req.body.questionId})`);
  const result = await assessmentService.storeResponseWithInsight({
    assessmentId: id,
    ...req.body,
  });
  logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/responses → 201 — responseId=${result.response.id}, hasMicroInsight=${!!result.microInsight} (${Date.now() - start}ms)`);
  res.status(201).json({ success: true, data: result });
};

export const completeAssessment = async (req: Request, res: Response) => {
  const start = Date.now();
  const id = req.params.id as string;
  logger.info('');
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/complete — STARTING FULL PIPELINE`);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  const result = await pipelineService.runFullPipeline(id);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/complete → 200 — pmfScore=${result.pmfScore}, pmfStage=${result.pmfStage} (${Date.now() - start}ms total)`);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info('');
  res.json({ success: true, data: result });
};

export const runResearch = async (req: Request, res: Response) => {
  const start = Date.now();
  const id = req.params.id as string;
  const forceRefresh = req.query.refresh === 'true';
  logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/research — forceRefresh=${forceRefresh}`);
  const result = await researchService.runResearch(id, forceRefresh);

  const response: Record<string, any> = {
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

  logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/research → 200 — quality=${typeof quality === 'string' ? quality : quality.overall}, competitors=${result.competitors?.length ?? 0} (${Date.now() - start}ms)`);
  res.json(response);
};

export const scoreAssessment = async (req: Request, res: Response) => {
  const start = Date.now();
  const id = req.params.id as string;
  logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/score`);
  const result = await scoringService.scoreAssessment(id);
  logger.info(`[API] POST /assessments/${id.slice(0, 8)}…/score → 200 — finalScore=${result.finalScore}, stage=${result.pmfStage} (${Date.now() - start}ms)`);
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

