import { prisma } from '../db/prisma';
import { NotFoundError } from '../errors';

export async function getReportByToken(token: string) {
  const report = await prisma.report.findUnique({
    where: { urlToken: token },
    include: {
      assessment: {
        include: { lead: { select: { isUnlocked: true } } },
      },
    },
  });

  if (!report) throw new NotFoundError('Report not found');

  const isExpired = report.expiresAt < new Date();
  const isUnlocked = report.assessment.lead?.isUnlocked === true;

  if (isExpired) {
    return {
      isExpired: true,
      isUnlocked,
      report: null,
      previewContent: report.previewContent,
    };
  }

  if (!isUnlocked) {
    return {
      isExpired: false,
      isUnlocked: false,
      report: null,
      previewContent: report.previewContent,
      pmfScore: report.pmfScore,
      pmfStage: report.pmfStage,
    };
  }

  return {
    isExpired: false,
    isUnlocked: true,
    report: report.content,
    previewContent: report.previewContent,
    pmfScore: report.pmfScore,
    pmfStage: report.pmfStage,
    primaryBreak: report.primaryBreak,
  };
}
