import { getBrowser } from '../config/puppeteer';
import { buildReportHtml, ReportPdfData } from '../templates/report-pdf';

export async function generateReportPdf(reportData: ReportPdfData): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    const html = buildReportHtml(reportData);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1.5cm',
        bottom: '1.5cm',
        left: '1.5cm',
      },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="font-size:8px;width:100%;text-align:center;color:#6b7280;">PMF Insights Report | Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

export function getReportFilename(): string {
  return `PMF-Insight-Report-${new Date().toISOString().split('T')[0]}.pdf`;
}
