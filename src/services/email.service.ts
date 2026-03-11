import { resend } from '../config/resend';
import { env } from '../config/env';
import { generateReportPdf, getReportFilename } from './pdf.service';
import { buildReportEmailHtml } from '../templates/report-email';
import type { ReportOutput } from '../schemas/report.schema';

interface SendReportEmailParams {
  to: string;
  pmfScore: number;
  pmfStage: string;
  verdict: string;
  reportContent: ReportOutput;
}

export async function sendReportEmail(params: SendReportEmailParams): Promise<void> {
  const { to, pmfScore, pmfStage, verdict, reportContent } = params;

  const emailHtml = buildReportEmailHtml({ pmfScore, pmfStage, verdict });

  // Resend API expects attachment content as base64 string (JSON body); Buffer would serialize incorrectly
  let attachments: Array<{ filename: string; content: string }> = [];
  try {
    const pdfBuffer = await generateReportPdf(reportContent);
    const filename = getReportFilename();
    attachments = [{ filename, content: pdfBuffer.toString('base64') }];
  } catch (err) {
    console.warn('PDF generation failed for email attachment, sending without PDF:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.warn(err.stack);
  }

  await resend.emails.send({
    from: `PMF Insights <${env.RESEND_FROM_EMAIL}>`,
    to,
    subject: 'Your PMF Insights Report is Ready',
    html: emailHtml,
    attachments,
  });
}
