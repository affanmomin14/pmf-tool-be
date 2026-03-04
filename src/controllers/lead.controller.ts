import { Request, Response } from 'express';
import * as leadService from '../services/lead.service';

export const createLead = async (req: Request, res: Response) => {
  const result = await leadService.createLead(req.body);
  res.status(201).json({ success: true, data: result });
};
