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

export interface SendReportEmailResult {
  pdfAttached: boolean;
}

export async function sendReportEmail(params: SendReportEmailParams): Promise<SendReportEmailResult> {
  const { to, pmfScore, pmfStage, verdict, reportContent } = params;

  const emailHtml = buildReportEmailHtml({ pmfScore, pmfStage, verdict });

  // Resend API: content as base64 string; contentType required for PDF
  let attachments: Array<{ filename: string; content: string; contentType: string }> = [];
  try {
    const pdfBuffer = await generateReportPdf(reportContent);
    const filename = getReportFilename();
    attachments = [
      { filename, content: pdfBuffer.toString('base64'), contentType: 'application/pdf' },
    ];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : 'Error';
    console.warn('[email] PDF generation failed:', name, msg);
    if (err instanceof Error && err.stack) console.warn('[email] PDF stack:', err.stack);
  }

  await resend.emails.send({
    from: `PMF Insights <${env.RESEND_FROM_EMAIL}>`,
    to,
    subject: 'Your PMF Insights Report is Ready',
    html: emailHtml,
    attachments,
  });

  return { pdfAttached: attachments.length > 0 };
}
