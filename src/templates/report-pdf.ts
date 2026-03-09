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

function severityConfig(score: number): { accent: string; bg: string; label: string } {
  if (score <= 3) return { accent: '#EF4444', bg: 'rgba(239,68,68,0.06)', label: 'Critical' };
  if (score <= 5) return { accent: '#F59E0B', bg: 'rgba(245,158,11,0.06)', label: 'Needs Attention' };
  if (score <= 8) return { accent: '#6366F1', bg: 'rgba(99,102,241,0.06)', label: 'Info' };
  return { accent: '#10B981', bg: 'rgba(16,185,129,0.06)', label: 'Strong' };
}

function stageLabel(stage: string): { text: string; color: string; bg: string } {
  const s = (stage || '').toLowerCase();
  if (s.includes('strong')) return { text: 'Strong PMF', color: '#059669', bg: '#ecfdf5' };
  if (s.includes('early')) return { text: 'Early PMF', color: '#0891b2', bg: '#ecfeff' };
  if (s.includes('approach')) return { text: 'Approaching PMF', color: '#d97706', bg: '#fffbeb' };
  return { text: 'Pre-PMF', color: '#dc2626', bg: '#fef2f2' };
}

// ── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: #1e293b;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background: #fafbfc;
  }
  h2, h3 { page-break-after: avoid; }
  table { page-break-inside: avoid; }

  .page {
    page-break-before: always;
    padding: 44px 48px;
    min-height: 100vh;
    position: relative;
    background: #fafbfc;
  }
  .page:first-child { page-break-before: auto; }

  /* Page header — matches FE "Live Report" style */
  .page-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
    padding-bottom: 14px;
    border-bottom: 1px solid #e2e8f0;
  }
  .page-nav-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .page-nav-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px rgba(16,185,129,0.5);
  }
  .page-nav-label {
    font-size: 10px;
    font-weight: 600;
    color: #10b981;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
  .page-nav-logo {
    font-size: 10px;
    font-weight: 700;
    color: #818cf8;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  /* Section title — FE style with accent bar */
  .section-heading {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 26px;
    font-weight: 400;
    color: #0f172a;
    margin-bottom: 6px;
    letter-spacing: -0.3px;
  }
  .section-subtitle {
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 24px;
  }
  .section-divider {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 32px 0 24px;
  }
  .section-divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
  }
  .section-divider-text {
    font-size: 10px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    white-space: nowrap;
  }

  /* Spotlight-style card — matches FE InsightCard */
  .spotlight-card {
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.06);
    border-radius: 16px;
    padding: 20px 24px;
    margin-bottom: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.03);
    position: relative;
    overflow: hidden;
  }
  .spotlight-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 0 3px 3px 0;
  }

  /* Score bar — matches FE breakdown bars */
  .score-bar-track {
    width: 100%;
    height: 6px;
    background: #f1f5f9;
    border-radius: 100px;
    overflow: hidden;
  }
  .score-bar-fill {
    height: 100%;
    border-radius: 100px;
  }

  /* Badge — matches FE severity badges */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 3px 10px;
    border-radius: 100px;
  }
  .badge-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  /* Metric pill — matches FE metric tags */
  .metric-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    padding: 5px 12px;
    border-radius: 100px;
    background: #f8fafc;
    border: 1px solid #f1f5f9;
  }
  .metric-pill-label { color: #94a3b8; font-weight: 500; }
  .metric-pill-value { color: #334155; font-weight: 600; }

  /* Grid */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

  /* Footer */
  .page-footer {
    position: absolute;
    bottom: 20px;
    left: 48px;
    right: 48px;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #cbd5e1;
  }
</style>`;

// ── Page nav & footer ────────────────────────────────────────────────────────

function pageNav(section: string): string {
  return `<div class="page-nav">
    <div class="page-nav-left">
      <div class="page-nav-dot"></div>
      <span class="page-nav-label">${esc(section)}</span>
    </div>
    <span class="page-nav-logo">PMF Insights</span>
  </div>`;
}

function pageFooter(): string {
  return `<div class="page-footer">
    <span>Confidential</span>
    <span>${formatDate()}</span>
  </div>`;
}

// ── Cover Page (kept as-is — user likes it) ──────────────────────────────────

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
    <div style="position:absolute;inset:0;opacity:0.03;background-image:radial-gradient(circle at 1px 1px, white 1px, transparent 0);background-size:40px 40px;"></div>

    <div style="padding:40px 52px 0;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1;">
      <div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#818cf8;text-transform:uppercase;">PMF Insights</div>
      <div style="font-size:12px;color:#64748b;">${formatDate()}</div>
    </div>

    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 52px;position:relative;z-index:1;">
      ${companyName ? `<div style="font-size:14px;font-weight:500;color:#94a3b8;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;">${esc(companyName)}</div>` : ''}
      <h1 style="font-size:44px;font-weight:200;letter-spacing:-0.5px;margin-bottom:40px;color:#f1f5f9;font-family:'Instrument Serif',Georgia,serif;">Product-Market Fit<br><span style="font-weight:400;font-style:italic;">Assessment Report</span></h1>

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

      <div style="display:inline-block;background:${stage.bg};color:${stage.color};padding:8px 24px;border-radius:100px;font-size:14px;font-weight:600;margin-bottom:20px;">${stage.text}</div>

      ${verdict ? `<p style="font-size:16px;color:#cbd5e1;max-width:520px;line-height:1.7;margin:0 auto;">${esc(verdict)}</p>` : ''}

      ${category ? `<div style="margin-top:24px;font-size:12px;color:#475569;">${esc(category)}${subCategory ? ` / ${esc(subCategory)}` : ''}</div>` : ''}
    </div>

    <div style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa);"></div>
  </div>`;
}

// ── Score Hero + Breakdown (matches FE bento grid top section) ───────────────

function renderScoreOverview(data: ReportPdfData): string {
  const content = data.content || {};
  const rc = content.reality_check;
  const scores = data.scores || [];
  const stage = stageLabel(data.pmfStage);
  const color = scoreColor(data.pmfScore, 100);

  const summary = rc
    ? typeof rc === 'string' ? rc : rc.summary || ''
    : '';

  // Dimension pills (like FE mini pills in hero)
  const dimensionPills = scores.map((s) => {
    const c = scoreColor(s.score);
    return `<div style="display:inline-flex;align-items:center;gap:5px;font-size:9px;padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);margin:2px;">
      <span style="width:5px;height:5px;border-radius:50%;background:${c};box-shadow:0 0 4px ${c}60;"></span>
      <span style="color:#94a3b8;">${esc(s.name)}</span>
      <span style="font-weight:700;color:${c};">${Math.round(s.score * 10)}</span>
    </div>`;
  }).join('');

  // Score breakdown bars (matches FE right-column breakdown)
  const breakdownBars = scores.map((s) => {
    const c = scoreColor(s.score);
    const pct = (s.score / 10) * 100;
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <span style="width:80px;font-size:10px;color:#94a3b8;font-weight:500;text-align:right;flex-shrink:0;">${esc(s.name)}</span>
      <div style="flex:1;height:7px;background:#f1f5f9;border-radius:100px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;border-radius:100px;background:linear-gradient(90deg,${c}30,${c});"></div>
      </div>
      <span style="width:24px;font-size:10px;font-weight:700;color:${c};text-align:right;">${Math.round(s.score * 10)}</span>
    </div>`;
  }).join('');

  return `
  <div class="page">
    ${pageNav('Score Overview')}

    <!-- Hero card (dark, matches FE report-hero) -->
    <div style="background:linear-gradient(135deg,#0F172A 0%,#1E293B 60%,#334155 100%);border-radius:20px;padding:32px;margin-bottom:18px;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;opacity:0.03;background-image:radial-gradient(circle at 1px 1px, white 1px, transparent 0);background-size:24px 24px;"></div>
      <div style="position:relative;z-index:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
          <span style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">Overall Score</span>
          <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;background:${color}20;color:${color};border:1px solid ${color}40;">${stage.text}</span>
        </div>

        <div style="display:flex;align-items:center;gap:28px;">
          <!-- Score ring -->
          <div style="position:relative;width:140px;height:140px;flex-shrink:0;">
            <svg viewBox="0 0 140 140" width="140" height="140" style="filter:drop-shadow(0 0 12px ${color}40);">
              <circle cx="70" cy="70" r="56" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="10"/>
              <circle cx="70" cy="70" r="56" fill="none" stroke="${color}" stroke-width="10"
                stroke-dasharray="${(data.pmfScore / 100) * 352} 352"
                stroke-linecap="round" transform="rotate(-90 70 70)"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
              <span style="font-size:36px;font-weight:700;color:white;line-height:1;">${data.pmfScore}</span>
              <span style="font-size:11px;color:#64748b;">/100</span>
            </div>
          </div>

          <div style="flex:1;">
            ${summary ? `<p style="font-size:13px;color:#94a3b8;line-height:1.7;margin-bottom:16px;">${esc(summary)}</p>` : ''}
            <div style="display:flex;flex-wrap:wrap;gap:0;">${dimensionPills}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Score Breakdown card (matches FE right-column bars) -->
    <div class="spotlight-card" style="padding:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Score Breakdown</span>
      </div>
      ${breakdownBars}
    </div>

    ${pageFooter()}
  </div>`;
}

// ── Strengths & Concerns (matches FE Reality Check insight card) ─────────────

function renderRealityCheck(data: ReportPdfData): string {
  const content = data.content || {};
  const rc = content.reality_check;
  if (!rc) return '';

  const strengths: string[] = rc.strengths || [];
  const concerns: string[] = rc.concerns || [];

  return `
  <div class="page">
    ${pageNav('Reality Check')}

    <div class="section-heading">Reality Check</div>
    <div class="section-subtitle">Key strengths and concerns identified in your assessment</div>

    <div class="grid-2">
      <!-- Strengths card -->
      <div class="spotlight-card" style="border-left:3px solid #10b981;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div style="width:32px;height:32px;border-radius:10px;background:rgba(16,185,129,0.08);display:flex;align-items:center;justify-content:center;font-size:16px;">&#9989;</div>
          <span style="font-size:13px;font-weight:600;color:#0f172a;">Strengths</span>
          <span class="badge" style="background:rgba(16,185,129,0.08);color:#10b981;border:1px solid rgba(16,185,129,0.15);">
            <span class="badge-dot" style="background:#10b981;box-shadow:0 0 4px rgba(16,185,129,0.6);"></span>
            Strong
          </span>
        </div>
        ${strengths.length > 0 ? strengths.map((s) => `
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
            <div style="width:5px;height:5px;border-radius:50%;background:#10b981;margin-top:7px;flex-shrink:0;"></div>
            <p style="font-size:12px;color:#475569;line-height:1.6;">${esc(s)}</p>
          </div>`).join('') : '<p style="font-size:12px;color:#94a3b8;">None identified</p>'}
      </div>

      <!-- Concerns card -->
      <div class="spotlight-card" style="border-left:3px solid #ef4444;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div style="width:32px;height:32px;border-radius:10px;background:rgba(239,68,68,0.08);display:flex;align-items:center;justify-content:center;font-size:16px;">&#9888;&#65039;</div>
          <span style="font-size:13px;font-weight:600;color:#0f172a;">Concerns</span>
          <span class="badge" style="background:rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.15);">
            <span class="badge-dot" style="background:#ef4444;box-shadow:0 0 4px rgba(239,68,68,0.6);"></span>
            Critical
          </span>
        </div>
        ${concerns.length > 0 ? concerns.map((c) => `
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
            <div style="width:5px;height:5px;border-radius:50%;background:#ef4444;margin-top:7px;flex-shrink:0;"></div>
            <p style="font-size:12px;color:#475569;line-height:1.6;">${esc(c)}</p>
          </div>`).join('') : '<p style="font-size:12px;color:#94a3b8;">None identified</p>'}
      </div>
    </div>

    ${pageFooter()}
  </div>`;
}

// ── Dimension Scorecard (matches FE InsightCard style) ───────────────────────

function renderScorecardDetail(data: ReportPdfData): string {
  const content = data.content || {};
  const scorecard: any[] = content.scorecard || [];

  const items = scorecard.length > 0 ? scorecard : data.scores.map((s) => ({
    dimension: s.name,
    score: s.score,
    label: s.score <= 3 ? 'critical' : s.score <= 5 ? 'weak' : s.score <= 7 ? 'moderate' : 'strong',
    insight: s.verdict,
  }));

  if (items.length === 0) return '';

  const cards = items.map((item: any) => {
    const color = scoreColor(item.score);
    const pct = (item.score / 10) * 100;
    const sev = severityConfig(item.score);

    return `
    <div class="spotlight-card" style="border-left:3px solid ${sev.accent};">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:32px;height:32px;border-radius:10px;background:${sev.bg};border:1px solid ${sev.accent}15;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:16px;font-weight:700;color:${sev.accent};">${item.score}</span>
        </div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:13px;font-weight:600;color:#0f172a;">${esc(item.dimension)}</span>
            <span class="badge" style="background:${sev.accent}10;color:${sev.accent};border:1px solid ${sev.accent}20;">
              <span class="badge-dot" style="background:${sev.accent};box-shadow:0 0 4px ${sev.accent}60;"></span>
              ${sev.label}
            </span>
          </div>
        </div>
      </div>
      <div class="score-bar-track" style="margin-bottom:10px;">
        <div class="score-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${color}40,${color});"></div>
      </div>
      ${item.insight ? `<p style="font-size:11px;line-height:1.7;color:#64748b;">${esc(item.insight)}</p>` : ''}
    </div>`;
  }).join('');

  return `
  <div class="page">
    ${pageNav('Scorecard')}
    <div class="section-heading">Dimension Scorecard</div>
    <div class="section-subtitle">Detailed scoring across all assessment dimensions</div>
    ${cards}
    ${pageFooter()}
  </div>`;
}

// ── Market Analysis (spotlight card style) ───────────────────────────────────

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
    ${pageNav('Market Analysis')}
    <div class="section-heading">Market Analysis</div>
    <div class="section-subtitle">Market sizing, positioning, and opportunity assessment</div>

    <!-- Metrics row -->
    <div class="grid-3" style="margin-bottom:18px;">
      <div class="spotlight-card" style="text-align:center;padding:18px;">
        <div style="font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">TAM</div>
        <div style="font-size:18px;font-weight:700;color:#0f172a;">${tam ? esc(String(tam)) : '<span style="color:#cbd5e1;font-size:12px;font-weight:400;">N/A</span>'}</div>
      </div>
      <div class="spotlight-card" style="text-align:center;padding:18px;">
        <div style="font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">SAM</div>
        <div style="font-size:18px;font-weight:700;color:#0f172a;">${sam ? esc(String(sam)) : '<span style="color:#cbd5e1;font-size:12px;font-weight:400;">N/A</span>'}</div>
      </div>
      <div class="spotlight-card" style="text-align:center;padding:18px;">
        <div style="font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Growth Rate</div>
        <div style="font-size:18px;font-weight:700;color:${growthRate ? '#10b981' : '#cbd5e1'};">${growthRate ? esc(String(growthRate)) : '<span style="font-size:12px;font-weight:400;">N/A</span>'}</div>
      </div>
    </div>

    <div class="grid-2">
      ${positioning ? `
      <div class="spotlight-card" style="border-left:3px solid #6366f1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:14px;">&#127919;</span>
          <span style="font-size:12px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:0.5px;">Positioning</span>
        </div>
        <p style="font-size:12px;line-height:1.7;color:#475569;">${esc(String(positioning))}</p>
      </div>` : ''}
      ${opportunity ? `
      <div class="spotlight-card" style="border-left:3px solid #10b981;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:14px;">&#128161;</span>
          <span style="font-size:12px;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:0.5px;">Opportunity</span>
        </div>
        <p style="font-size:12px;line-height:1.7;color:#475569;">${esc(String(opportunity))}</p>
      </div>` : ''}
    </div>

    ${pageFooter()}
  </div>`;
}

// ── Competitors ──────────────────────────────────────────────────────────────

function renderCompetitors(content: Record<string, any>): string {
  const competitors: any[] = content.competitors || [];
  if (!Array.isArray(competitors) || competitors.length === 0) return '';

  const threatConfig: Record<string, { accent: string; label: string }> = {
    high: { accent: '#ef4444', label: 'High Threat' },
    medium: { accent: '#f59e0b', label: 'Medium' },
    low: { accent: '#10b981', label: 'Low Threat' },
  };

  const cards = competitors.map((c: any) => {
    const t = threatConfig[(c.threatLevel || '').toLowerCase()] || threatConfig.medium;
    return `
    <div class="spotlight-card" style="border-left:3px solid ${t.accent};">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="color:white;font-size:15px;font-weight:700;">${esc((c.name || '?')[0].toUpperCase())}</span>
        </div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:13px;font-weight:600;color:#0f172a;">${esc(c.name || '')}</span>
            <span class="badge" style="background:${t.accent}10;color:${t.accent};border:1px solid ${t.accent}20;">
              <span class="badge-dot" style="background:${t.accent};"></span>
              ${t.label}
            </span>
          </div>
        </div>
      </div>
      ${c.comparison ? `<p style="font-size:11px;line-height:1.7;color:#64748b;">${esc(c.comparison)}</p>` : ''}
    </div>`;
  }).join('');

  return `
  <div class="page">
    ${pageNav('Competitive Landscape')}
    <div class="section-heading">Competitive Moat</div>
    <div class="section-subtitle">How you stack up against key competitors</div>
    ${cards}
    ${pageFooter()}
  </div>`;
}

// ── Sales Model & Positioning (combined) ─────────────────────────────────────

function renderStrategy(content: Record<string, any>): string {
  const sales = content.sales_model;
  const pos = content.positioning;
  if (!sales && !pos) return '';

  return `
  <div class="page">
    ${pageNav('Strategy')}

    ${sales ? `
    <div class="section-heading">Distribution Strategy</div>
    <div class="section-subtitle">Current and recommended go-to-market approach</div>

    <div class="grid-2" style="margin-bottom:28px;">
      <div class="spotlight-card">
        <div style="font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Current Model</div>
        <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:10px;">${esc(typeof sales === 'string' ? sales : sales.current || '')}</div>
        ${sales.reasoning ? `<p style="font-size:11px;line-height:1.7;color:#64748b;">${esc(sales.reasoning)}</p>` : ''}
      </div>
      <div class="spotlight-card" style="background:#f0fdf4;border-color:#bbf7d0;">
        <div style="font-size:9px;font-weight:600;color:#059669;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Recommended</div>
        <div style="font-size:14px;font-weight:600;color:#0f172a;">${esc(typeof sales === 'string' ? '' : sales.recommended || '')}</div>
      </div>
    </div>` : ''}

    ${pos ? `
    <div class="section-heading">Positioning Audit</div>
    <div class="section-subtitle">Current vs. recommended market positioning</div>

    <div class="grid-2" style="margin-bottom:14px;">
      <div class="spotlight-card">
        <div style="font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Current</div>
        <p style="font-size:12px;line-height:1.7;color:#475569;">${esc(typeof pos === 'string' ? pos : pos.current || '')}</p>
      </div>
      <div class="spotlight-card" style="background:#eff6ff;border-color:#bfdbfe;">
        <div style="font-size:9px;font-weight:600;color:#2563eb;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Recommended</div>
        <p style="font-size:12px;line-height:1.7;color:#475569;">${esc(typeof pos === 'string' ? '' : pos.recommended || '')}</p>
      </div>
    </div>

    ${pos.gap ? `
    <div class="spotlight-card" style="border-left:3px solid #f59e0b;background:rgba(245,158,11,0.03);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:14px;">&#9888;&#65039;</span>
        <span style="font-size:11px;font-weight:600;color:#d97706;text-transform:uppercase;letter-spacing:0.5px;">Gap Identified</span>
      </div>
      <p style="font-size:12px;line-height:1.7;color:#475569;">${esc(pos.gap)}</p>
    </div>` : ''}
    ` : ''}

    ${pageFooter()}
  </div>`;
}

// ── Recommendations (matches FE Sprint 0 Action Plan) ────────────────────────

function renderRecommendations(content: Record<string, any>): string {
  const recs: any[] = content.recommendations || [];
  if (!Array.isArray(recs) || recs.length === 0) return '';

  const priorityConfig: Record<string, { accent: string }> = {
    high: { accent: '#ef4444' },
    medium: { accent: '#f59e0b' },
    low: { accent: '#3b82f6' },
  };

  const items = recs.map((r: any, i: number) => {
    const p = priorityConfig[(r.priority || '').toLowerCase()] || priorityConfig.medium;
    return `
    <div class="spotlight-card" style="border-left:3px solid ${p.accent};">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="color:white;font-size:12px;font-weight:700;">${i + 1}</span>
        </div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:13px;font-weight:600;color:#0f172a;">${esc(r.title || '')}</span>
            <div style="display:flex;gap:6px;">
              ${r.priority ? `<span class="badge" style="background:${p.accent}10;color:${p.accent};border:1px solid ${p.accent}20;">${esc(r.priority)}</span>` : ''}
              ${r.timeframe ? `<span class="metric-pill"><span class="metric-pill-value">${esc(r.timeframe)}</span></span>` : ''}
            </div>
          </div>
        </div>
      </div>
      ${r.description ? `<p style="font-size:11px;line-height:1.7;color:#64748b;margin-left:40px;">${esc(r.description)}</p>` : ''}
    </div>`;
  }).join('');

  return `
  <div class="page">
    ${pageNav('Action Plan')}
    <div class="section-heading">Sprint 0 Action Plan</div>
    <div class="section-subtitle">Prioritized recommendations to improve your PMF score</div>
    ${items}
    ${pageFooter()}
  </div>`;
}

// ── Bottom Line (matches FE dark CTA section style) ──────────────────────────

function renderBottomLine(data: ReportPdfData): string {
  const content = data.content || {};
  const bl = content.bottom_line;
  if (!bl) return '';

  const summary = typeof bl === 'string' ? bl : bl.summary || '';
  const primaryBreak = typeof bl === 'object' ? bl.primaryBreak : '';
  const nextSteps: string[] = (typeof bl === 'object' ? bl.nextSteps : null) || [];
  const stage = stageLabel(data.pmfStage);
  const color = scoreColor(data.pmfScore, 100);
  const sources = content.sources;

  return `
  <div class="page">
    ${pageNav('Conclusion')}
    <div class="section-heading">Bottom Line</div>
    <div class="section-subtitle">Final assessment and recommended next steps</div>

    <!-- Dark verdict card (matches FE CTA section) -->
    <div style="background:linear-gradient(135deg,#0F172A 0%,#1E293B 60%,#334155 100%);border-radius:20px;padding:28px 32px;margin-bottom:18px;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
      <div style="position:absolute;inset:0;opacity:0.03;background-image:radial-gradient(circle at 1px 1px, white 1px, transparent 0);background-size:20px 20px;"></div>
      <div style="position:relative;z-index:1;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <div style="font-size:28px;font-weight:700;color:white;">${data.pmfScore}<span style="font-size:14px;font-weight:400;color:#64748b;">/100</span></div>
          <span style="display:inline-block;background:${stage.bg};color:${stage.color};padding:4px 14px;border-radius:100px;font-size:11px;font-weight:600;">${stage.text}</span>
        </div>
        ${summary ? `<p style="font-size:13px;line-height:1.8;color:#94a3b8;">${esc(summary)}</p>` : ''}
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:18px;">
      ${primaryBreak ? `
      <div class="spotlight-card" style="border-left:3px solid #ef4444;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:14px;">&#128680;</span>
          <span style="font-size:11px;font-weight:600;color:#ef4444;text-transform:uppercase;letter-spacing:0.5px;">Primary Break</span>
        </div>
        <p style="font-size:12px;line-height:1.7;color:#475569;">${esc(primaryBreak)}</p>
      </div>` : '<div></div>'}

      ${nextSteps.length > 0 ? `
      <div class="spotlight-card" style="border-left:3px solid #6366f1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:14px;">&#128640;</span>
          <span style="font-size:11px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:0.5px;">Next Steps</span>
        </div>
        ${nextSteps.map((step, i) => `
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;">
            <div style="width:18px;height:18px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">
              <span style="font-size:9px;font-weight:700;color:#6366f1;">${i + 1}</span>
            </div>
            <p style="font-size:11px;line-height:1.6;color:#475569;">${esc(step)}</p>
          </div>`).join('')}
      </div>` : '<div></div>'}
    </div>

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
  <div class="spotlight-card" style="background:#f8fafc;">
    <div style="font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Sources & References</div>
    <div style="columns:2;column-gap:20px;">
      ${items.map((s) => `<div style="font-size:10px;color:#64748b;line-height:1.8;break-inside:avoid;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s)}</div>`).join('')}
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
  ${renderScoreOverview(report)}
  ${renderRealityCheck(report)}
  ${renderScorecardDetail(report)}
  ${renderMarketAnalysis(content)}
  ${renderCompetitors(content)}
  ${renderStrategy(content)}
  ${renderRecommendations(content)}
  ${renderBottomLine(report)}
</body>
</html>`;
}
