import { Request, Response } from 'express';
import * as assessmentService from '../services/assessment.service';
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
