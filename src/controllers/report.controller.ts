import { Request, Response } from 'express';
import * as reportAccessService from '../services/report.access.service';

export const getReport = async (req: Request, res: Response) => {
  const token = req.params.token as string;
  const result = await reportAccessService.getReportByToken(token);
  res.json({ success: true, data: result });
};
