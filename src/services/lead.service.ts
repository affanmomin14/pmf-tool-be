import dns from 'dns';
import { prisma } from '../db/prisma';
import { NotFoundError, ValidationError } from '../errors';

const MX_TIMEOUT_MS = 5000;

async function validateEmailMx(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  if (!domain) return false;

  try {
    const records = await Promise.race([
      dns.promises.resolveMx(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MX lookup timeout')), MX_TIMEOUT_MS)
      ),
    ]);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

export async function createLead(data: { assessmentId: string; email: string }) {
  // 1. Validate MX records
  const hasMx = await validateEmailMx(data.email);
  if (!hasMx) {
    throw new ValidationError('Email domain does not have valid MX records');
  }

  // 2. Fetch assessment with report and lead
  const assessment = await prisma.assessment.findUnique({
    where: { id: data.assessmentId },
    include: {
      report: { select: { urlToken: true } },
      lead: true,
    },
  });

  if (!assessment) throw new NotFoundError('Assessment not found');
  if (!assessment.report) {
    throw new ValidationError('Assessment has no report yet. Complete the assessment first.');
  }

  // 3. Idempotent duplicate check
  if (assessment.lead) {
    return {
      leadId: assessment.lead.id,
      isUnlocked: true,
      reportToken: assessment.report.urlToken,
    };
  }

  // 4. Create lead + unlock
  const lead = await prisma.lead.create({
    data: {
      assessmentId: data.assessmentId,
      email: data.email,
      isUnlocked: true,
      utmSource: assessment.utmSource,
      utmMedium: assessment.utmMedium,
      utmCampaign: assessment.utmCampaign,
    },
  });

  await prisma.assessment.update({
    where: { id: data.assessmentId },
    data: { status: 'unlocked' },
  });

  // 5. Return
  return {
    leadId: lead.id,
    isUnlocked: true,
    reportToken: assessment.report.urlToken,
  };
}
