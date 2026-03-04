import { Request, Response } from 'express';
import * as reportAccessService from '../services/report.access.service';
import { prisma } from '../db/prisma';
import { AppError, NotFoundError } from '../errors';
import { sendReportEmail } from '../services/email.service';

export const getReport = async (req: Request, res: Response) => {
  const token = req.params.token as string;
  const result = await reportAccessService.getReportByToken(token);
  res.json({ success: true, data: result });
};

export const emailReport = async (req: Request, res: Response) => {
  const token = req.params.token as string;
  const { email } = req.body as { email: string };

  const report = await prisma.report.findUnique({
    where: { urlToken: token },
  });

  if (!report) {
    throw new NotFoundError('Report not found');
  }

  if (report.expiresAt < new Date()) {
    throw new AppError('Report has expired', 410, 'REPORT_EXPIRED');
  }

  // Extract verdict from report content JSON
  const content = report.content as Record<string, any>;
  const verdict =
    content?.header?.verdict ||
    content?.bottom_line?.verdict ||
    content?.executive_summary?.verdict ||
    '';

  await sendReportEmail({
    to: email,
    pmfScore: report.pmfScore,
    pmfStage: report.pmfStage,
    verdict,
    reportToken: token,
    reportData: {
      pmfScore: report.pmfScore,
      pmfStage: report.pmfStage,
      primaryBreak: report.primaryBreak,
      content: report.content as Record<string, any>,
      scores: report.scores as Array<{ name: string; score: number; weight: number; verdict: string }>,
    },
  });

  res.json({ success: true, data: { sent: true } });
};
