import { Request, Response } from 'express';
import * as systemService from '../services/system.service';

export const getQuestions = async (_req: Request, res: Response) => {
  const questions = await systemService.getActiveQuestions();
  res.json({ success: true, data: questions });
};

export const getCategories = async (_req: Request, res: Response) => {
  const categories = await systemService.getActiveCategories();
  res.json({ success: true, data: categories });
};

export const getFacts = async (req: Request, res: Response) => {
  const location = req.query.location as string | undefined;
  const facts = await systemService.getActiveFacts(location);
  res.json({ success: true, data: facts });
};

export const getSocialProof = async (_req: Request, res: Response) => {
  const socialProof = await systemService.getActiveSocialProof();
  res.json({ success: true, data: socialProof });
};

export const getMicroInsights = async (req: Request, res: Response) => {
  const questionId = Number(req.params.questionId);
  const insights = await systemService.getMicroInsightsByQuestion(questionId);
  res.json({ success: true, data: insights });
};
