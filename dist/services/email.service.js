"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendReportEmail = sendReportEmail;
const resend_1 = require("../config/resend");
const env_1 = require("../config/env");
const pdf_service_1 = require("./pdf.service");
const report_email_1 = require("../templates/report-email");
async function sendReportEmail(params) {
    const { to, pmfScore, pmfStage, verdict, reportContent } = params;
    const emailHtml = (0, report_email_1.buildReportEmailHtml)({ pmfScore, pmfStage, verdict });
    let attachments = [];
    try {
        const pdfBuffer = await (0, pdf_service_1.generateReportPdf)(reportContent);
        const filename = (0, pdf_service_1.getReportFilename)();
        attachments = [{ filename, content: pdfBuffer }];
    }
    catch (err) {
        console.warn('PDF generation failed for email attachment, sending without PDF:', err);
    }
    await resend_1.resend.emails.send({
        from: `PMF Insights <${env_1.env.RESEND_FROM_EMAIL}>`,
        to,
        subject: 'Your PMF Insights Report is Ready',
        html: emailHtml,
        attachments,
    });
}
