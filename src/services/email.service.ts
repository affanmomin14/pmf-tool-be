import { resend } from '../config/resend';
import { env } from '../config/env';
import { generateReportPdf, getReportFilename } from './pdf.service';
import { buildReportEmailHtml } from '../templates/report-email';
import { ReportPdfData } from '../templates/report-pdf';

interface SendReportEmailParams {
  to: string;
  pmfScore: number;
  pmfStage: string;
  verdict: string;
  reportToken: string;
  reportData: ReportPdfData;
}

export async function sendReportEmail(params: SendReportEmailParams): Promise<void> {
  const { to, pmfScore, pmfStage, verdict, reportToken, reportData } = params;

  const reportUrl = `${env.FRONTEND_URL}/report/${reportToken}`;
  const emailHtml = buildReportEmailHtml({ pmfScore, pmfStage, verdict, reportUrl });

  // Generate PDF attachment -- graceful degradation if it fails
  let attachments: Array<{ filename: string; content: Buffer }> = [];
  try {
    const pdfBuffer = await generateReportPdf(reportData);
    const filename = getReportFilename();
    attachments = [{ filename, content: pdfBuffer }];
  } catch (err) {
    console.warn('PDF generation failed for email attachment, sending without PDF:', err);
  }

  await resend.emails.send({
    from: `PMF Insights <${env.RESEND_FROM_EMAIL}>`,
    to,
    subject: 'Your PMF Insights Report is Ready',
    html: emailHtml,
    attachments,
  });
}
