import { getBrowser } from '../config/puppeteer';
import { env } from '../config/env';

export async function generateReportPdf(reportToken: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set a desktop viewport for consistent rendering
    await page.setViewport({ width: 1280, height: 900 });

    // Navigate to the actual frontend report page with print mode
    const reportUrl = `${env.FRONTEND_URL}/report/${reportToken}?print=true`;
    await page.goto(reportUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    // Wait for the report content to render
    await page.waitForSelector('.report-hero', { timeout: 15000 }).catch(() => {
      // Fallback: try SVG (charts)
      return page.waitForSelector('svg', { timeout: 5000 }).catch(() => {});
    });

    // Wait for Recharts containers to render and framer-motion to resolve
    await new Promise((r) => setTimeout(r, 3000));

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5cm',
        right: '0.5cm',
        bottom: '1cm',
        left: '0.5cm',
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
