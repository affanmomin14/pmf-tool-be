interface ReportEmailParams {
  pmfScore: number;
  pmfStage: string;
  verdict: string;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stageConfig(stage: string): { label: string; color: string; bg: string } {
  const s = (stage || '').toLowerCase();
  if (s.includes('strong')) return { label: 'Strong PMF', color: '#059669', bg: '#ecfdf5' };
  if (s.includes('early')) return { label: 'Early PMF', color: '#0891b2', bg: '#ecfeff' };
  if (s.includes('good') || s.includes('solid')) return { label: 'Solid PMF', color: '#047857', bg: '#ecfdf5' };
  if (s.includes('approach') || s.includes('emerging') || s.includes('moderate')) return { label: 'Approaching', color: '#d97706', bg: '#fffbeb' };
  return { label: 'Pre-PMF', color: '#dc2626', bg: '#fef2f2' };
}

function scoreColor(score: number): string {
  if (score >= 70) return '#10B981';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

export function buildReportEmailHtml(params: ReportEmailParams): string {
  const { pmfScore, pmfStage, verdict } = params;
  // reportUrl removed — email now only delivers the attached PDF
  const safeVerdict = escapeHtml(verdict || '');
  const stage = stageConfig(pmfStage);
  const color = scoreColor(pmfScore);

  // SVG score ring (inline for email compatibility)
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pmfScore / 100);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your PMF Insights Report</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#f8fafc;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0f172a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <span style="font-size:13px;font-weight:700;letter-spacing:2px;color:#818cf8;text-transform:uppercase;">PMF Insights</span>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:20px;border:1px solid rgba(255,255,255,0.06);">

                <!-- Header -->
                <tr>
                  <td style="padding:40px 36px 8px;text-align:center;">
                    <div style="font-size:12px;font-weight:500;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Your Assessment is Complete</div>
                    <h1 style="margin:0;font-size:28px;font-weight:200;color:#f1f5f9;letter-spacing:-0.3px;">Product-Market Fit <span style="font-weight:700;">Report</span></h1>
                  </td>
                </tr>

                <!-- Score Ring -->
                <tr>
                  <td align="center" style="padding:32px 0 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="width:140px;height:140px;position:relative;">
                          <svg viewBox="0 0 140 140" width="140" height="140" style="display:block;">
                            <circle cx="70" cy="70" r="${radius}" fill="none" stroke="#334155" stroke-width="8"/>
                            <circle cx="70" cy="70" r="${radius}" fill="none" stroke="${color}" stroke-width="8"
                              stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
                              stroke-linecap="round" transform="rotate(-90 70 70)"/>
                            <text x="70" y="64" text-anchor="middle" fill="#ffffff" font-size="36" font-weight="700" font-family="-apple-system,sans-serif">${Math.round(pmfScore)}</text>
                            <text x="70" y="84" text-anchor="middle" fill="#64748b" font-size="12" font-family="-apple-system,sans-serif">/100</text>
                          </svg>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Stage Badge -->
                <tr>
                  <td align="center" style="padding:0 0 20px;">
                    <span style="display:inline-block;background:${stage.bg};color:${stage.color};padding:6px 20px;border-radius:100px;font-size:13px;font-weight:600;">${stage.label}</span>
                  </td>
                </tr>

                <!-- Verdict -->
                ${safeVerdict ? `<tr>
                  <td style="padding:0 36px 32px;">
                    <p style="margin:0;font-size:15px;color:#94a3b8;text-align:center;line-height:1.7;">${safeVerdict}</p>
                  </td>
                </tr>` : ''}

                <!-- Divider -->
                <tr>
                  <td style="padding:0 36px;">
                    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);"></div>
                  </td>
                </tr>

                <!-- PDF Download Note -->
                <tr>
                  <td align="center" style="padding:28px 36px 36px;">
                    <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);border-radius:12px;padding:16px 24px;">
                      <div style="font-size:20px;margin-bottom:6px;">📎</div>
                      <div style="font-size:14px;font-weight:600;color:#e2e8f0;margin-bottom:4px;">Your full report is attached</div>
                      <div style="font-size:12px;color:#64748b;">Download the PDF from this email for your complete analysis</div>
                    </div>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">Generated by PMF Insights Tool</p>
              <p style="margin:4px 0 0;font-size:11px;color:#334155;">This report is confidential and intended for the recipient only.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
