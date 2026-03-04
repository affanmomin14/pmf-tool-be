export interface ReportPdfData {
  pmfScore: number;
  pmfStage: string;
  primaryBreak: string;
  content: Record<string, any>;
  scores: Array<{ name: string; score: number; weight: number; verdict: string }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function scoreColor(score: number, max: number = 10): string {
  const pct = score / max;
  if (pct <= 0.3) return '#ef4444';
  if (pct <= 0.6) return '#f59e0b';
  return '#10b981';
}

function labelBadge(label: string): string {
  const map: Record<string, { bg: string; fg: string }> = {
    critical: { bg: '#fef2f2', fg: '#dc2626' },
    weak: { bg: '#fff7ed', fg: '#ea580c' },
    moderate: { bg: '#fffbeb', fg: '#d97706' },
    solid: { bg: '#f0fdf4', fg: '#16a34a' },
    strong: { bg: '#ecfdf5', fg: '#059669' },
  };
  const style = map[(label || '').toLowerCase()] || { bg: '#f3f4f6', fg: '#6b7280' };
  return `<span style="display:inline-block;background:${style.bg};color:${style.fg};padding:2px 10px;border-radius:100px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${esc(label)}</span>`;
}

function priorityBadge(priority: string): string {
  const map: Record<string, { bg: string; fg: string }> = {
    high: { bg: '#fef2f2', fg: '#dc2626' },
    medium: { bg: '#fffbeb', fg: '#d97706' },
    low: { bg: '#eff6ff', fg: '#2563eb' },
  };
  const style = map[(priority || '').toLowerCase()] || { bg: '#f3f4f6', fg: '#6b7280' };
  return `<span style="display:inline-block;background:${style.bg};color:${style.fg};padding:2px 10px;border-radius:100px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${esc(priority)}</span>`;
}

function threatBadge(level: string): string {
  const map: Record<string, { bg: string; fg: string; icon: string }> = {
    high: { bg: '#fef2f2', fg: '#dc2626', icon: '!!!' },
    medium: { bg: '#fffbeb', fg: '#d97706', icon: '!!' },
    low: { bg: '#f0fdf4', fg: '#16a34a', icon: '!' },
  };
  const style = map[(level || '').toLowerCase()] || { bg: '#f3f4f6', fg: '#6b7280', icon: '?' };
  return `<span style="display:inline-block;background:${style.bg};color:${style.fg};padding:2px 10px;border-radius:100px;font-size:10px;font-weight:600;text-transform:uppercase;">${esc(level)}</span>`;
}

function stageLabel(stage: string): { text: string; color: string; bg: string } {
  const s = (stage || '').toLowerCase();
  if (s.includes('strong')) return { text: 'Strong PMF', color: '#059669', bg: '#ecfdf5' };
  if (s.includes('early')) return { text: 'Early PMF', color: '#0891b2', bg: '#ecfeff' };
  if (s.includes('approach')) return { text: 'Approaching PMF', color: '#d97706', bg: '#fffbeb' };
  return { text: 'Pre-PMF', color: '#dc2626', bg: '#fef2f2' };
}

// ── CSS Variables & Global Styles ────────────────────────────────────────────

const STYLES = `
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1e293b;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background: #ffffff;
  }
  h2 { page-break-after: avoid; }
  table { page-break-inside: avoid; }

  .page {
    page-break-before: always;
    padding: 48px 52px;
    min-height: 100vh;
    position: relative;
  }
  .page:first-child { page-break-before: auto; }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e2e8f0;
  }
  .page-header-title {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
  .page-header-logo {
    font-size: 11px;
    font-weight: 700;
    color: #6366f1;
    letter-spacing: 0.5px;
  }

  .section-title {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-title::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 24px;
    background: linear-gradient(180deg, #6366f1, #8b5cf6);
    border-radius: 2px;
  }

  .card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .card-muted {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
  }

  .metric-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 18px 20px;
    text-align: center;
  }
  .metric-label {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .metric-value {
    font-size: 22px;
    font-weight: 700;
    color: #0f172a;
  }

  .bar-track {
    width: 100%;
    height: 8px;
    background: #e2e8f0;
    border-radius: 100px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 100px;
    transition: width 0.3s;
  }

  .footer {
    position: absolute;
    bottom: 24px;
    left: 52px;
    right: 52px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    color: #94a3b8;
    border-top: 1px solid #f1f5f9;
    padding-top: 12px;
  }
</style>`;

// ── Page wrapper ─────────────────────────────────────────────────────────────

function pageHeader(section: string): string {
  return `<div class="page-header">
    <span class="page-header-title">${esc(section)}</span>
    <span class="page-header-logo">PMF Insights</span>
  </div>`;
}

function pageFooter(): string {
  return `<div class="footer">
    <span>Confidential</span>
    <span>${formatDate()}</span>
  </div>`;
}

// ── Cover Page ───────────────────────────────────────────────────────────────

function renderCover(data: ReportPdfData): string {
  const stage = stageLabel(data.pmfStage);
  const content = data.content || {};
  const header = content.header || {};
  const companyName = header.companyName || '';
  const category = header.category || '';
  const subCategory = header.subCategory || '';
  const verdict = header.verdict || '';
  const ring = scoreColor(data.pmfScore, 100);

  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;background:linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);color:white;position:relative;overflow:hidden;">
    <!-- Subtle grid pattern overlay -->
    <div style="position:absolute;inset:0;opacity:0.03;background-image:radial-gradient(circle at 1px 1px, white 1px, transparent 0);background-size:40px 40px;"></div>

    <!-- Top bar -->
    <div style="padding:40px 52px 0;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1;">
      <div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#818cf8;text-transform:uppercase;">PMF Insights</div>
      <div style="font-size:12px;color:#64748b;">${formatDate()}</div>
    </div>

    <!-- Main content -->
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 52px;position:relative;z-index:1;">
      ${companyName ? `<div style="font-size:14px;font-weight:500;color:#94a3b8;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;">${esc(companyName)}</div>` : ''}
      <h1 style="font-size:44px;font-weight:200;letter-spacing:-0.5px;margin-bottom:40px;color:#f1f5f9;">Product-Market Fit<br><span style="font-weight:700;">Assessment Report</span></h1>

      <!-- Score ring -->
      <div style="position:relative;width:180px;height:180px;margin:0 auto 32px;">
        <svg viewBox="0 0 180 180" style="width:180px;height:180px;transform:rotate(-90deg);">
          <circle cx="90" cy="90" r="78" fill="none" stroke="#334155" stroke-width="10"/>
          <circle cx="90" cy="90" r="78" fill="none" stroke="${ring}" stroke-width="10"
            stroke-dasharray="${(data.pmfScore / 100) * 490} 490"
            stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:52px;font-weight:700;line-height:1;color:white;">${data.pmfScore}</div>
          <div style="font-size:13px;color:#64748b;margin-top:2px;">out of 100</div>
        </div>
      </div>

      <!-- Stage badge -->
      <div style="display:inline-block;background:${stage.bg};color:${stage.color};padding:8px 24px;border-radius:100px;font-size:14px;font-weight:600;margin-bottom:20px;">${stage.text}</div>

      ${verdict ? `<p style="font-size:16px;color:#cbd5e1;max-width:520px;line-height:1.7;margin:0 auto;">${esc(verdict)}</p>` : ''}

      ${category ? `<div style="margin-top:24px;font-size:12px;color:#475569;">${esc(category)}${subCategory ? ` / ${esc(subCategory)}` : ''}</div>` : ''}
    </div>

    <!-- Bottom accent -->
    <div style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa);"></div>
  </div>`;
}

// ── Executive Summary (Reality Check + Score Overview) ───────────────────────

function renderExecutiveSummary(data: ReportPdfData): string {
  const content = data.content || {};
  const rc = content.reality_check;
  const scores = data.scores || [];

  const summary = rc
    ? typeof rc === 'string' ? rc : rc.summary || rc.analysis || ''
    : '';
  const strengths: string[] = rc?.strengths || [];
  const concerns: string[] = rc?.concerns || [];

  // Build mini bar chart for dimensions
  const dimensionBars = scores.map((s) => {
    const color = scoreColor(s.score);
    const pct = (s.score / 10) * 100;
    return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
      <div style="width:120px;font-size:12px;font-weight:500;color:#475569;text-align:right;flex-shrink:0;">${esc(s.name)}</div>
      <div style="flex:1;">
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color};"></div>
        </div>
      </div>
      <div style="width:32px;font-size:13px;font-weight:700;color:${color};text-align:right;">${s.score}</div>
    </div>`;
  }).join('');

  return `
  <div class="page">
    ${pageHeader('Executive Summary')}

    <div class="section-title">Executive Summary</div>

    ${summary ? `<div class="card" style="margin-bottom:24px;">
      <p style="font-size:14px;line-height:1.8;color:#334155;">${esc(summary)}</p>
    </div>` : ''}

    <div class="grid-2" style="margin-bottom:24px;">
      <div class="card" style="border-left:3px solid #10b981;">
        <div style="font-size:12px;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Strengths</div>
        ${strengths.length > 0 ? strengths.map((s) => `
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
            <div style="width:6px;height:6px;border-radius:50%;background:#10b981;margin-top:7px;flex-shrink:0;"></div>
            <p style="font-size:13px;color:#334155;line-height:1.6;margin:0;">${esc(s)}</p>
          </div>`).join('') : '<p style="font-size:13px;color:#94a3b8;">No specific strengths identified</p>'}
      </div>
      <div class="card" style="border-left:3px solid #ef4444;">
        <div style="font-size:12px;font-weight:600;color:#ef4444;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Concerns</div>
        ${concerns.length > 0 ? concerns.map((c) => `
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
            <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;margin-top:7px;flex-shrink:0;"></div>
            <p style="font-size:13px;color:#334155;line-height:1.6;margin:0;">${esc(c)}</p>
          </div>`).join('') : '<p style="font-size:13px;color:#94a3b8;">No specific concerns identified</p>'}
      </div>
    </div>

    <!-- Dimension scores bar chart -->
    <div class="card-muted">
      <div style="font-size:13px;font-weight:600;color:#475569;margin-bottom:16px;">Score Breakdown</div>
      ${dimensionBars}
    </div>

    ${pageFooter()}
  </div>`;
}

// ── Scorecard Detail Page ────────────────────────────────────────────────────

function renderScorecardDetail(data: ReportPdfData): string {
  const content = data.content || {};
  const scorecard: any[] = content.scorecard || [];

  if (scorecard.length === 0 && (!data.scores || data.scores.length === 0)) return '';

  // Use content.scorecard for rich data (dimension, score, label, insight)
  const items = scorecard.length > 0 ? scorecard : data.scores.map((s) => ({
    dimension: s.name,
    score: s.score,
    label: s.score <= 3 ? 'critical' : s.score <= 5 ? 'weak' : s.score <= 7 ? 'moderate' : 'strong',
    insight: s.verdict,
  }));

  const cards = items.map((item: any) => {
    const color = scoreColor(item.score);
    const pct = (item.score / 10) * 100;
    return `
    <div class="card" style="padding:16px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:600;color:#0f172a;">${esc(item.dimension)}</div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${labelBadge(item.label)}
          <div style="font-size:18px;font-weight:700;color:${color};">${item.score}<span style="font-size:12px;color:#94a3b8;font-weight:400;">/10</span></div>
        </div>
      </div>
      <div class="bar-track" style="margin-bottom:10px;">
        <div class="bar-fill" style="width:${pct}%;background:${color};"></div>
      </div>
      ${item.insight ? `<p style="font-size:12px;line-height:1.7;color:#64748b;margin:0;">${esc(item.insight)}</p>` : ''}
    </div>`;
  }).join('');

  return `
  <div class="page">
    ${pageHeader('Scorecard')}
    <div class="section-title">Dimension Scorecard</div>
    ${cards}
    ${pageFooter()}
  </div>`;
}

// ── Market Analysis ──────────────────────────────────────────────────────────

function renderMarketAnalysis(content: Record<string, any>): string {
  const market = content.market;
  if (!market) return '';

  const growthRate = market.growth_rate || market.growthRate;
  const tam = market.tam;
  const sam = market.sam;
  const positioning = market.positioning;
  const opportunity = market.opportunity;

  return `
  <div class="page">
    ${pageHeader('Market Analysis')}
    <div class="section-title">Market Analysis</div>

    <!-- Market metrics row -->
    <div class="grid-3" style="margin-bottom:24px;">
      <div class="metric-card">
        <div class="metric-label">TAM</div>
        <div class="metric-value" style="font-size:18px;">${tam ? esc(String(tam)) : '<span style="color:#94a3b8;font-size:13px;font-weight:400;">Not available</span>'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">SAM</div>
        <div class="metric-value" style="font-size:18px;">${sam ? esc(String(sam)) : '<span style="color:#94a3b8;font-size:13px;font-weight:400;">Not available</span>'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Growth Rate</div>
        <div class="metric-value" style="font-size:18px;color:${growthRate ? '#10b981' : '#94a3b8'};">${growthRate ? esc(String(growthRate)) : '<span style="font-size:13px;font-weight:400;">Not available</span>'}</div>
      </div>
    </div>

    <div class="grid-2">
      ${positioning ? `
      <div class="card">
        <div style="font-size:12px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Market Positioning</div>
        <p style="font-size:13px;line-height:1.7;color:#334155;">${esc(String(positioning))}</p>
      </div>` : ''}
      ${opportunity ? `
      <div class="card" style="border-left:3px solid #6366f1;">
        <div style="font-size:12px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Key Opportunity</div>
        <p style="font-size:13px;line-height:1.7;color:#334155;">${esc(String(opportunity))}</p>
      </div>` : ''}
    </div>

    ${pageFooter()}
  </div>`;
}

// ── Competitive Landscape ────────────────────────────────────────────────────

function renderCompetitors(content: Record<string, any>): string {
  const competitors: any[] = content.competitors || [];
  if (!Array.isArray(competitors) || competitors.length === 0) return '';

  const cards = competitors.map((c: any) => `
    <div class="card" style="display:flex;gap:16px;align-items:flex-start;">
      <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span style="color:white;font-size:16px;font-weight:700;">${esc((c.name || '?')[0].toUpperCase())}</span>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-size:14px;font-weight:600;color:#0f172a;">${esc(c.name || '')}</div>
          ${c.threatLevel ? threatBadge(c.threatLevel) : ''}
        </div>
        ${c.comparison ? `<p style="font-size:12px;line-height:1.7;color:#64748b;margin:0;">${esc(c.comparison)}</p>` : ''}
      </div>
    </div>`).join('');

  return `
  <div class="page">
    ${pageHeader('Competitive Landscape')}
    <div class="section-title">Competitive Landscape</div>
    ${cards}
    ${pageFooter()}
  </div>`;
}

// ── Sales & Positioning (combined, 2-column) ─────────────────────────────────

function renderSalesAndPositioning(content: Record<string, any>): string {
  const sales = content.sales_model;
  const pos = content.positioning;
  if (!sales && !pos) return '';

  return `
  <div class="page">
    ${pageHeader('Strategy')}

    ${sales ? `
    <div class="section-title">Sales Model</div>
    <div class="grid-2" style="margin-bottom:32px;">
      <div class="card">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Current</div>
        <div style="font-size:15px;font-weight:600;color:#0f172a;margin-bottom:12px;">${esc(typeof sales === 'string' ? sales : sales.current || '')}</div>
        ${sales.reasoning ? `<p style="font-size:12px;line-height:1.7;color:#64748b;">${esc(sales.reasoning)}</p>` : ''}
      </div>
      <div class="card" style="background:#f0f9ff;border-color:#bae6fd;">
        <div style="font-size:11px;font-weight:600;color:#0284c7;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Recommended</div>
        <div style="font-size:15px;font-weight:600;color:#0f172a;">${esc(typeof sales === 'string' ? '' : sales.recommended || '')}</div>
      </div>
    </div>` : ''}

    ${pos ? `
    <div class="section-title">Positioning</div>
    <div style="display:grid;grid-template-columns:1fr 40px 1fr;gap:0;align-items:stretch;margin-bottom:16px;">
      <div class="card" style="margin:0;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Current</div>
        <p style="font-size:13px;line-height:1.7;color:#334155;">${esc(typeof pos === 'string' ? pos : pos.current || '')}</p>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;">
        <div style="font-size:18px;color:#94a3b8;">→</div>
      </div>
      <div class="card" style="margin:0;background:#f0f9ff;border-color:#bae6fd;">
        <div style="font-size:11px;font-weight:600;color:#0284c7;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Recommended</div>
        <p style="font-size:13px;line-height:1.7;color:#334155;">${esc(typeof pos === 'string' ? '' : pos.recommended || '')}</p>
      </div>
    </div>
    ${pos.gap ? `
    <div class="card-muted" style="border-left:3px solid #f59e0b;">
      <div style="font-size:11px;font-weight:600;color:#d97706;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Gap Identified</div>
      <p style="font-size:13px;line-height:1.7;color:#334155;">${esc(pos.gap)}</p>
    </div>` : ''}
    ` : ''}

    ${pageFooter()}
  </div>`;
}

// ── Recommendations ──────────────────────────────────────────────────────────

function renderRecommendations(content: Record<string, any>): string {
  const recs: any[] = content.recommendations || [];
  if (!Array.isArray(recs) || recs.length === 0) return '';

  const items = recs.map((r: any, i: number) => `
    <div class="card" style="display:flex;gap:16px;align-items:flex-start;">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span style="color:white;font-size:14px;font-weight:700;">${i + 1}</span>
      </div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div style="font-size:14px;font-weight:600;color:#0f172a;">${esc(r.title || '')}</div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${r.priority ? priorityBadge(r.priority) : ''}
            ${r.timeframe ? `<span style="font-size:10px;color:#94a3b8;background:#f1f5f9;padding:2px 8px;border-radius:100px;">${esc(r.timeframe)}</span>` : ''}
          </div>
        </div>
        ${r.description ? `<p style="font-size:12px;line-height:1.7;color:#64748b;margin:0;">${esc(r.description)}</p>` : ''}
      </div>
    </div>`).join('');

  return `
  <div class="page">
    ${pageHeader('Recommendations')}
    <div class="section-title">Recommendations</div>
    ${items}
    ${pageFooter()}
  </div>`;
}

// ── Bottom Line + Next Steps ─────────────────────────────────────────────────

function renderBottomLine(data: ReportPdfData): string {
  const content = data.content || {};
  const bl = content.bottom_line;
  if (!bl) return '';

  const summary = typeof bl === 'string' ? bl : bl.summary || bl.analysis || bl.content || '';
  const primaryBreak = typeof bl === 'object' ? bl.primaryBreak : '';
  const nextSteps: string[] = (typeof bl === 'object' ? bl.nextSteps : null) || [];
  const stage = stageLabel(data.pmfStage);
  const sources = content.sources;

  return `
  <div class="page">
    ${pageHeader('Conclusion')}
    <div class="section-title">Bottom Line</div>

    <!-- Verdict card -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px;padding:28px 32px;margin-bottom:24px;color:white;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="font-size:32px;font-weight:700;">${data.pmfScore}<span style="font-size:16px;font-weight:400;color:#94a3b8;">/100</span></div>
        <div style="display:inline-block;background:${stage.bg};color:${stage.color};padding:4px 14px;border-radius:100px;font-size:12px;font-weight:600;">${stage.text}</div>
      </div>
      ${summary ? `<p style="font-size:14px;line-height:1.8;color:#cbd5e1;margin:0;">${esc(summary)}</p>` : ''}
    </div>

    <div class="grid-2" style="margin-bottom:24px;">
      <!-- Primary Break -->
      ${primaryBreak ? `
      <div class="card" style="border-left:3px solid #ef4444;">
        <div style="font-size:11px;font-weight:600;color:#ef4444;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Primary Break</div>
        <p style="font-size:13px;line-height:1.7;color:#334155;">${esc(primaryBreak)}</p>
      </div>` : '<div></div>'}

      <!-- Next Steps -->
      ${nextSteps.length > 0 ? `
      <div class="card" style="border-left:3px solid #6366f1;">
        <div style="font-size:11px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Next Steps</div>
        ${nextSteps.map((step, i) => `
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;">
            <div style="width:20px;height:20px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <span style="font-size:11px;font-weight:600;color:#6366f1;">${i + 1}</span>
            </div>
            <p style="font-size:12px;line-height:1.6;color:#334155;margin:0;">${esc(step)}</p>
          </div>`).join('')}
      </div>` : '<div></div>'}
    </div>

    <!-- Sources -->
    ${sources ? renderSourcesInline(sources) : ''}

    ${pageFooter()}
  </div>`;
}

function renderSourcesInline(sources: any): string {
  let items: string[] = [];
  if (Array.isArray(sources)) {
    items = sources.map((s: any) => typeof s === 'string' ? s : s.url || s.title || JSON.stringify(s));
  } else if (typeof sources === 'object' && sources.items) {
    items = sources.items.map((s: any) => typeof s === 'string' ? s : s.url || s.title || JSON.stringify(s));
  } else {
    items = [String(sources)];
  }
  if (items.length === 0) return '';

  return `
  <div class="card-muted" style="margin-top:8px;">
    <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Sources & References</div>
    <div style="columns:2;column-gap:24px;">
      ${items.map((s) => `<div style="font-size:11px;color:#64748b;line-height:1.8;break-inside:avoid;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s)}</div>`).join('')}
    </div>
  </div>`;
}

// ── Main Build Function ──────────────────────────────────────────────────────

export function buildReportHtml(report: ReportPdfData): string {
  const content = report.content || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${STYLES}
</head>
<body>
  ${renderCover(report)}
  ${renderExecutiveSummary(report)}
  ${renderScorecardDetail(report)}
  ${renderMarketAnalysis(content)}
  ${renderCompetitors(content)}
  ${renderSalesAndPositioning(content)}
  ${renderRecommendations(content)}
  ${renderBottomLine(report)}
</body>
</html>`;
}
