import { resend } from '../config/resend';
import { env } from '../config/env';
import { generateReportPdf, getReportFilename } from './pdf.service';
import { buildReportEmailHtml } from '../templates/report-email';

interface SendReportEmailParams {
  to: string;
  pmfScore: number;
  pmfStage: string;
  verdict: string;
  reportToken: string;
}

export async function sendReportEmail(params: SendReportEmailParams): Promise<void> {
  const { to, pmfScore, pmfStage, verdict, reportToken } = params;

  const emailHtml = buildReportEmailHtml({ pmfScore, pmfStage, verdict });

  // Generate PDF by screenshotting the actual frontend report page
  let attachments: Array<{ filename: string; content: Buffer }> = [];
  try {
    const pdfBuffer = await generateReportPdf(reportToken);
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
