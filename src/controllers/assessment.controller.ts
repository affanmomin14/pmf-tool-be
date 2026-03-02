import { Request, Response } from 'express';
import * as assessmentService from '../services/assessment.service';
import * as classificationService from '../services/classification.service';
import * as researchService from '../services/research.service';
import * as scoringService from '../services/scoring.service';
import { hashIp } from '../utils/hash';

export const createAssessment = async (req: Request, res: Response) => {
  const ip = req.ip || req.socket?.remoteAddress || '0.0.0.0';
  const ipHash = hashIp(ip);
  const assessment = await assessmentService.createAssessment({
    ...req.body,
    ipHash,
  });
  res.status(201).json({ success: true, data: assessment });
};

export const getAssessment = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const assessment = await assessmentService.getAssessmentWithResponses(id);
  res.json({ success: true, data: assessment });
};

export const createResponse = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await assessmentService.storeResponseWithInsight({
    assessmentId: id,
    ...req.body,
  });
  res.status(201).json({ success: true, data: result });
};

export const completeAssessment = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const classification = await classificationService.classifyAssessment(id);
  res.json({ success: true, data: { classification } });
};

export const runResearch = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const forceRefresh = req.query.refresh === 'true';
  const result = await researchService.runResearch(id, forceRefresh);

  const response: Record<string, any> = {
    success: true,
    data: result,
  };

  if (result.researchQuality === 'limited') {
    response.warning = 'Research data is limited for this category. Some sections may have incomplete data.';
  }

  res.json(response);
};

export const scoreAssessment = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await scoringService.scoreAssessment(id);
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
