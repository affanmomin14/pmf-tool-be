import PDFDocument from 'pdfkit';
import type { ReportOutput } from '../schemas/report.schema';

const C = {
  dark: '#0F172A', darkAlt: '#1E293B',
  text: '#1E293B', textLight: '#475569', textMuted: '#94A3B8', textFaint: '#CBD5E1',
  border: '#E2E8F0', borderLight: '#F1F5F9', bg: '#FAFBFC', white: '#FFFFFF',
  indigo: '#6366F1', indigoLight: '#EEF2FF',
  emerald: '#10B981', emeraldLight: '#ECFDF5',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  red: '#EF4444', redLight: '#FEF2F2',
  purple: '#8B5CF6',
};

const F = { r: 'Helvetica', b: 'Helvetica-Bold', i: 'Helvetica-Oblique' };
const PG = { w: 595.28, h: 841.89 };
const M = { t: 50, r: 45, b: 55, l: 45 };
const W = PG.w - M.l - M.r;

function scoreColor(s: number, max = 100): string {
  const p = s / max;
  return p >= 0.7 ? C.emerald : p >= 0.4 ? C.amber : C.red;
}
function statusColor(s: string): string {
  return s === 'critical' ? C.red : s === 'at_risk' ? C.amber : s === 'on_track' ? C.indigo : s === 'strong' ? C.emerald : C.textMuted;
}
function tierColor(t: string): string {
  return t === 'direct' ? C.red : t === 'incumbent' ? C.amber : t === 'adjacent' ? C.indigo : C.textMuted;
}
function effortColor(e: string): string {
  return e === 'low' ? C.emerald : e === 'medium' ? C.amber : e === 'high' ? C.red : C.textMuted;
}
function severityColor(s: string): string {
  return s === 'critical' ? C.red : s === 'warning' ? C.amber : s === 'aligned' ? C.emerald : C.textMuted;
}
function stageLabel(s: string): string {
  return s === 'pre_pmf' ? 'Pre-PMF' : s === 'approaching' ? 'Emerging' : s === 'early_pmf' ? 'Early PMF' : s === 'strong' ? 'Strong PMF' : s;
}
function fmtDate(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Measure how tall a block of text will be when rendered
function textH(doc: PDFKit.PDFDocument, str: string, font: string, size: number, w: number, lineGap = 0): number {
  doc.font(font).fontSize(size);
  return doc.heightOfString(str, { width: w, lineGap });
}

// ============================================================================
// Page management
// ============================================================================

function drawFooter(doc: PDFKit.PDFDocument) {
  const y = PG.h - 32;
  doc.save();
  doc.font(F.r).fontSize(7).fillColor(C.textFaint);
  doc.text('PMF Insights Report', M.l, y, { width: W / 2, align: 'left', lineBreak: false });
  doc.text(fmtDate(), M.l + W / 2, y, { width: W / 2, align: 'right', lineBreak: false });
  doc.restore();
}

function addContentPage(doc: PDFKit.PDFDocument) {
  doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  drawFooter(doc);
  doc.y = M.t;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > PG.h - M.b) {
    addContentPage(doc);
  }
}

// ============================================================================
// Drawing primitives
// ============================================================================

function sectionHead(doc: PDFKit.PDFDocument, num: string, title: string) {
  ensureSpace(doc, 40);
  const y = doc.y;
  doc.save();
  doc.roundedRect(M.l, y, 26, 18, 4).fill(C.indigoLight);
  doc.font(F.b).fontSize(8).fillColor(C.indigo).text(num, M.l, y + 4, { width: 26, align: 'center', lineBreak: false });
  doc.restore();
  doc.font(F.b).fontSize(13).fillColor(C.text).text(title, M.l + 34, y + 2, { lineBreak: false });
  const lineY = y + 24;
  doc.moveTo(M.l, lineY).lineTo(M.l + W, lineY).strokeColor(C.borderLight).lineWidth(0.5).stroke();
  doc.y = lineY + 12;
}

function card(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number, h: number,
  opts: { accent?: string; fill?: string } = {},
) {
  doc.save();
  doc.roundedRect(x, y, w, h, 6).fill(opts.fill || C.white);
  doc.roundedRect(x, y, w, h, 6).strokeColor(C.border).lineWidth(0.5).stroke();
  if (opts.accent) doc.rect(x, y + 4, 3, h - 8).fill(opts.accent);
  doc.restore();
}

function bar(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, pct: number, color: string) {
  doc.save();
  doc.roundedRect(x, y, w, h, h / 2).fill(C.borderLight);
  if (pct > 0) doc.roundedRect(x, y, Math.max(w * (pct / 100), h), h, h / 2).fill(color);
  doc.restore();
}

function badge(doc: PDFKit.PDFDocument, label: string, x: number, y: number, color: string): number {
  const t = label.toUpperCase();
  const px = 6;
  doc.font(F.b).fontSize(6.5);
  const tw = doc.widthOfString(t);
  const bw = tw + px * 2;
  doc.save();
  doc.roundedRect(x, y, bw, 13, 6.5).fill(color + '20');
  doc.font(F.b).fontSize(6.5).fillColor(color).text(t, x + px, y + 3, { width: tw + 4, lineBreak: false });
  doc.restore();
  return bw;
}

function arcPath(cx: number, cy: number, r: number, s: number, e: number): string {
  const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${e - s > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
}

function lbl(doc: PDFKit.PDFDocument, s: string, x: number, y: number, opts: PDFKit.Mixins.TextOptions = {}) {
  doc.text(s, x, y, { lineBreak: false, ...opts });
}

// ============================================================================
// Cover page — generous spacing to prevent overlap
// ============================================================================

function renderCover(doc: PDFKit.PDFDocument, r: ReportOutput) {
  const h = r.header;
  const color = scoreColor(h.pmf_score);

  doc.rect(0, 0, PG.w, PG.h).fill(C.dark);

  doc.save().opacity(0.03);
  for (let gx = 0; gx < PG.w; gx += 30)
    for (let gy = 0; gy < PG.h; gy += 30)
      doc.circle(gx, gy, 0.5).fill(C.white);
  doc.restore();

  // Header bar
  doc.font(F.b).fontSize(10).fillColor(C.indigo);
  lbl(doc, 'PMF INSIGHTS', M.l, 45);
  doc.font(F.r).fontSize(8).fillColor(C.textMuted);
  lbl(doc, fmtDate(), 0, 47, { width: PG.w - M.r, align: 'right' });

  // Anchor – push up to leave room for all elements below
  let y = 160;

  // Product name
  if (h.product_name) {
    doc.font(F.r).fontSize(11).fillColor(C.textMuted);
    doc.text(h.product_name.toUpperCase(), 0, y, { width: PG.w, align: 'center', lineBreak: false });
    y += 28;
  }

  // Title block
  doc.font(F.b).fontSize(32).fillColor(C.borderLight);
  doc.text('Product-Market Fit', 0, y, { width: PG.w, align: 'center', lineBreak: false });
  y += 42;
  doc.font(F.i).fontSize(26).fillColor(C.borderLight);
  doc.text('Assessment Report', 0, y, { width: PG.w, align: 'center', lineBreak: false });
  y += 56;

  // Score arc
  const cx = PG.w / 2;
  const scoreY = y + 50;
  const rad = 48;
  doc.save();
  doc.circle(cx, scoreY, rad).lineWidth(7).strokeColor(C.darkAlt).stroke();
  const sa = -Math.PI / 2;
  const ea = sa + (h.pmf_score / 100) * 2 * Math.PI;
  doc.path(arcPath(cx, scoreY, rad, sa, ea)).lineWidth(7).strokeColor(color).stroke();
  doc.restore();

  doc.font(F.b).fontSize(34).fillColor(C.white);
  doc.text(String(h.pmf_score), cx - 32, scoreY - 17, { width: 64, align: 'center', lineBreak: false });
  doc.font(F.r).fontSize(9).fillColor(C.textMuted);
  doc.text('out of 100', cx - 40, scoreY + 18, { width: 80, align: 'center', lineBreak: false });
  y = scoreY + rad + 16;

  // Stage badge
  const sl = stageLabel(h.pmf_stage);
  doc.font(F.b).fontSize(10);
  const slW = doc.widthOfString(sl) + 28;
  doc.roundedRect(cx - slW / 2, y, slW, 24, 12).fill(color + '25');
  doc.font(F.b).fontSize(10).fillColor(color);
  doc.text(sl, cx - slW / 2, y + 6, { width: slW, align: 'center', lineBreak: false });
  y += 40;

  // Verdict
  if (h.verdict) {
    doc.font(F.r).fontSize(10).fillColor(C.textFaint);
    doc.text(h.verdict, 70, y, { width: PG.w - 140, align: 'center', lineGap: 4 });
    const vh = textH(doc, h.verdict, F.r, 10, PG.w - 140, 4);
    y += vh + 20;
  }

  // Category
  doc.font(F.r).fontSize(8).fillColor(C.textMuted);
  doc.text(h.category, 0, y, { width: PG.w, align: 'center', lineBreak: false });

  doc.rect(0, PG.h - 4, PG.w, 4).fill(C.indigo);
}

// ============================================================================
// Score Overview
// ============================================================================

function renderOverview(doc: PDFKit.PDFDocument, r: ReportOutput) {
  const h = r.header;
  const dims = r.scorecard.dimensions;

  doc.font(F.b).fontSize(7).fillColor(C.emerald);
  lbl(doc, 'SCORE OVERVIEW', M.l, M.t);
  doc.font(F.b).fontSize(7).fillColor(C.indigo);
  lbl(doc, 'PMF INSIGHTS', 0, M.t, { width: PG.w - M.r, align: 'right' });
  doc.moveTo(M.l, M.t + 14).lineTo(M.l + W, M.t + 14).strokeColor(C.border).lineWidth(0.5).stroke();

  let y = M.t + 28;

  const mw = (W - 24) / 4;
  const metrics = [
    { label: 'PMF SCORE', value: `${h.pmf_score}/100`, color: scoreColor(h.pmf_score) },
    { label: 'BENCHMARK', value: `${h.benchmark_score}/100`, color: C.textLight },
    { label: 'PRIMARY BREAK', value: h.primary_break, color: C.red },
    { label: 'CATEGORY RISK', value: h.category_risk, color: h.category_risk === 'high' ? C.red : h.category_risk === 'medium' ? C.amber : C.emerald },
  ];
  metrics.forEach((m, i) => {
    const mx = M.l + i * (mw + 8);
    card(doc, mx, y, mw, 50);
    doc.font(F.b).fontSize(6.5).fillColor(C.textMuted);
    lbl(doc, m.label, mx + 10, y + 10);
    doc.font(F.b).fontSize(14).fillColor(m.color);
    lbl(doc, m.value, mx + 10, y + 26);
  });
  y += 66;

  doc.font(F.b).fontSize(7).fillColor(C.textMuted);
  lbl(doc, 'DIMENSION BREAKDOWN', M.l, y);
  y += 18;

  dims.forEach((dim) => {
    const sc = statusColor(dim.status);
    doc.font(F.r).fontSize(8.5).fillColor(C.textLight);
    lbl(doc, dim.name, M.l, y);
    bar(doc, M.l + 100, y + 2, W - 240, 7, dim.score * 10, sc);
    doc.font(F.b).fontSize(9).fillColor(sc);
    lbl(doc, String(dim.score * 10), M.l + W - 130, y, { width: 30, align: 'right' });
    badge(doc, dim.status.replace('_', ' '), M.l + W - 90, y - 1, sc);
    y += 22;
  });

  doc.y = y + 6;
}

// ============================================================================
// 01 — Reality Check — dynamic card heights
// ============================================================================

function renderRealityCheck(doc: PDFKit.PDFDocument, r: ReportOutput) {
  sectionHead(doc, '01', 'Reality Check');
  const rc = r.reality_check;

  rc.comparisons.forEach((comp) => {
    const colW = (W - 36) / 2;
    const youH = textH(doc, comp.you_said, F.r, 7.5, colW, 1);
    const resH = textH(doc, comp.research_shows, F.b, 7.5, colW, 1);
    const contentH = Math.max(youH, resH);
    const cardH = 38 + contentH + 10;

    ensureSpace(doc, cardH + 6);
    const y = doc.y;
    const sc = severityColor(comp.severity);
    card(doc, M.l, y, W, cardH, { accent: sc });

    const bw = badge(doc, comp.severity, M.l + 12, y + 8, sc);
    doc.font(F.b).fontSize(6.5).fillColor(C.textMuted);
    lbl(doc, comp.question_ref.toUpperCase(), M.l + 12 + bw + 5, y + 11);

    const lx = M.l + 12;
    const rx = M.l + 12 + colW + 12;

    doc.font(F.b).fontSize(6.5).fillColor(C.textMuted);
    lbl(doc, 'YOU SAID', lx, y + 26);
    doc.font(F.r).fontSize(7.5).fillColor(C.textLight);
    doc.text(comp.you_said, lx, y + 38, { width: colW, lineGap: 1 });

    doc.font(F.b).fontSize(6.5).fillColor(C.textMuted);
    lbl(doc, 'RESEARCH SHOWS', rx, y + 26);
    doc.font(F.b).fontSize(7.5).fillColor(C.text);
    doc.text(comp.research_shows, rx, y + 38, { width: colW, lineGap: 1 });

    doc.y = y + cardH + 6;
  });

  if (rc.root_cause) {
    const rcH = textH(doc, rc.root_cause, F.r, 8, W - 20, 2);
    const cardH = rcH + 24;
    ensureSpace(doc, cardH + 8);
    const y = doc.y;
    card(doc, M.l, y, W, cardH, { fill: C.bg });
    doc.font(F.b).fontSize(6.5).fillColor(C.textMuted);
    lbl(doc, 'ROOT CAUSE', M.l + 10, y + 7);
    doc.font(F.r).fontSize(8).fillColor(C.text);
    doc.text(rc.root_cause, M.l + 10, y + 20, { width: W - 20, lineGap: 2 });
    doc.y = y + cardH + 8;
  }
}

// ============================================================================
// 02 — Scorecard — taller cards with enough room for evidence
// ============================================================================

function renderScorecard(doc: PDFKit.PDFDocument, r: ReportOutput) {
  sectionHead(doc, '02', 'Scorecard');
  const dims = r.scorecard.dimensions;
  const cw = (W - 10) / 2;
  const ch = 96;

  dims.forEach((dim, i) => {
    const col = i % 2;
    if (col === 0) ensureSpace(doc, ch + 8);
    const x = M.l + col * (cw + 10);
    const y = col === 0 ? doc.y : doc.y - (ch + 7);
    const sc = statusColor(dim.status);

    card(doc, x, y, cw, ch, { accent: sc });

    doc.font(F.b).fontSize(9.5).fillColor(C.text);
    lbl(doc, dim.name, x + 12, y + 10);
    badge(doc, dim.status.replace('_', ' '), x + cw - 72, y + 10, sc);
    if (dim.confidence === 'low') {
      doc.font(F.b).fontSize(7).fillColor(C.amber);
      lbl(doc, '?', x + cw - 82, y + 12);
    }

    doc.font(F.b).fontSize(20).fillColor(sc);
    lbl(doc, String(dim.score), x + 12, y + 28);
    doc.font(F.r).fontSize(8).fillColor(C.textMuted);
    lbl(doc, '/10', x + 32, y + 36);
    lbl(doc, `Benchmark: ${dim.benchmark}`, x + 62, y + 36);

    bar(doc, x + 12, y + 52, cw - 24, 5, dim.score * 10, sc);

    doc.font(F.r).fontSize(7).fillColor(C.textLight);
    doc.text(dim.evidence, x + 12, y + 62, { width: cw - 24, lineGap: 1 });

    if (col === 1 || i === dims.length - 1) {
      doc.y = y + ch + 7;
    }
  });
}

// ============================================================================
// 03 — Market
// ============================================================================

function renderMarket(doc: PDFKit.PDFDocument, r: ReportOutput) {
  sectionHead(doc, '03', 'Market');
  const mkt = r.market;
  const thirdW = (W - 20) / 3;
  let y = doc.y;

  const sizes = [
    { label: 'TAM', ...mkt.tam, color: C.indigo },
    { label: 'SAM', ...mkt.sam, color: C.purple },
    { label: 'GROWTH', ...mkt.growth_rate, color: '#A855F7' },
  ];
  sizes.forEach((s, i) => {
    const x = M.l + i * (thirdW + 10);
    card(doc, x, y, thirdW, 68, { accent: s.color });
    doc.font(F.b).fontSize(6.5).fillColor(C.textMuted);
    lbl(doc, s.label, x + 12, y + 10);
    doc.font(F.b).fontSize(14).fillColor(C.text);
    lbl(doc, s.value, x + 12, y + 24);
    doc.font(F.r).fontSize(6.5).fillColor(C.textLight);
    doc.text(s.description, x + 12, y + 42, { width: thirdW - 24, lineGap: 1 });
  });
  y += 80;

  if (mkt.regions.length > 0) {
    doc.font(F.b).fontSize(7).fillColor(C.textMuted);
    lbl(doc, 'REGIONAL BREAKDOWN', M.l, y);
    y += 16;
    mkt.regions.forEach((region) => {
      doc.font(F.r).fontSize(7.5).fillColor(C.textLight);
      lbl(doc, region.name, M.l, y);
      bar(doc, M.l + 100, y + 2, W - 240, 6, region.percentage, C.indigo);
      doc.font(F.b).fontSize(7.5).fillColor(C.text);
      lbl(doc, `${region.percentage}%`, M.l + W - 130, y);
      doc.font(F.r).fontSize(7.5).fillColor(C.textLight);
      lbl(doc, region.value, M.l + W - 85, y);
      y += 18;
    });
    y += 6;
  }

  if (mkt.real_number_analysis) {
    const ah = textH(doc, mkt.real_number_analysis, F.r, 7.5, W - 20, 2);
    const cardH = ah + 16;
    ensureSpace(doc, cardH + 8);
    card(doc, M.l, y, W, cardH, { fill: C.bg });
    doc.font(F.r).fontSize(7.5).fillColor(C.textLight);
    doc.text(mkt.real_number_analysis, M.l + 10, y + 8, { width: W - 20, lineGap: 2 });
    y += cardH + 8;
  }

  doc.y = y;
}

// ============================================================================
// 04 — Sales Model — dynamic heights for comparison + options
// ============================================================================

function renderSalesModel(doc: PDFKit.PDFDocument, r: ReportOutput) {
  sectionHead(doc, '04', 'Sales Model');
  const sm = r.sales_model;
  let y = doc.y;

  // Comparison card — dynamic height
  const halfW = (W - 36) / 2;
  const youH = textH(doc, sm.comparison.you_said, F.r, 7.5, halfW, 1);
  const resH = textH(doc, sm.comparison.research_shows, F.b, 7.5, halfW, 1);
  const compCardH = 22 + Math.max(youH, resH) + 10;
  const compSc = severityColor(sm.comparison.severity);

  card(doc, M.l, y, W, compCardH, { accent: compSc });
  doc.font(F.b).fontSize(6.5).fillColor(C.textMuted);
  lbl(doc, 'YOU SAID', M.l + 12, y + 10);
  doc.font(F.r).fontSize(7.5).fillColor(C.textLight);
  doc.text(sm.comparison.you_said, M.l + 12, y + 22, { width: halfW, lineGap: 1 });
  doc.font(F.b).fontSize(6.5).fillColor(C.textMuted);
  lbl(doc, 'RESEARCH SHOWS', M.l + 12 + halfW + 12, y + 10);
  doc.font(F.b).fontSize(7.5).fillColor(C.text);
  doc.text(sm.comparison.research_shows, M.l + 12 + halfW + 12, y + 22, { width: halfW, lineGap: 1 });
  y += compCardH + 10;

  // GTM table
  doc.font(F.b).fontSize(7).fillColor(C.textMuted);
  lbl(doc, 'GTM MODEL COMPARISON', M.l, y);
  y += 14;

  const cols = [85, 80, 60, 65, W - 310];
  const hdrs = ['Model', 'Who Uses', 'ACV Range', 'Conversion', 'Your Fit'];
  let tx = M.l;
  hdrs.forEach((h, i) => {
    doc.font(F.b).fontSize(6.5).fillColor(C.textMuted);
    lbl(doc, h, tx, y);
    tx += cols[i] + 5;
  });
  y += 12;
  doc.moveTo(M.l, y).lineTo(M.l + W, y).strokeColor(C.border).lineWidth(0.5).stroke();
  y += 5;

  sm.models_table.forEach((row) => {
    const fitH = textH(doc, row.your_fit || '-', F.r, 7, cols[4], 0);
    const rowH = Math.max(14, fitH + 4);
    ensureSpace(doc, rowH + 2);
    tx = M.l;
    [row.model, row.who_uses, row.acv_range, row.conversion, row.your_fit].forEach((val, i) => {
      doc.font(i === 0 ? F.b : F.r).fontSize(7).fillColor(i === 0 ? C.text : C.textLight);
      if (i === 4) {
        doc.text(val || '-', tx, y, { width: cols[i] });
      } else {
        doc.text(val || '-', tx, y, { width: cols[i], lineBreak: false });
      }
      tx += cols[i] + 5;
    });
    y += rowH + 2;
  });
  y += 8;

  // Diagnosis
  if (sm.diagnosis) {
    const dh = textH(doc, sm.diagnosis, F.r, 7.5, W - 20, 2);
    const diagH = dh + 16;
    ensureSpace(doc, diagH + 8);
    card(doc, M.l, y, W, diagH, { fill: C.bg });
    doc.font(F.r).fontSize(7.5).fillColor(C.textLight);
    doc.text(sm.diagnosis, M.l + 10, y + 8, { width: W - 20, lineGap: 2 });
    y += diagH + 8;
  }

  // Options — dynamic card heights
  sm.options.forEach((opt) => {
    const prosH = opt.pros.length * 12;
    const consH = opt.cons.length * 12;
    const bestH = textH(doc, `Best if: ${opt.best_if}`, F.r, 6.5, W - 24);
    const bodyH = Math.max(prosH, consH);
    const cardH = 38 + bodyH + bestH + 12;

    ensureSpace(doc, cardH + 8);
    card(doc, M.l, y, W, cardH, { accent: C.purple });

    doc.font(F.b).fontSize(9).fillColor(C.text);
    lbl(doc, opt.title, M.l + 12, y + 10);
    doc.font(F.b).fontSize(6.5).fillColor(C.textMuted);
    lbl(doc, `Timeline: ${opt.timeline}`, M.l + W - 120, y + 12);

    const prosX = M.l + 12;
    const consX = M.l + W / 2 + 6;
    const colW = W / 2 - 24;

    doc.font(F.b).fontSize(6.5).fillColor(C.emerald);
    lbl(doc, 'PROS', prosX, y + 26);
    doc.font(F.b).fontSize(6.5).fillColor(C.red);
    lbl(doc, 'CONS', consX, y + 26);

    let py = y + 38;
    opt.pros.forEach((p) => {
      doc.font(F.r).fontSize(7).fillColor(C.textLight);
      doc.text(`+ ${p}`, prosX, py, { width: colW, lineBreak: false });
      py += 12;
    });
    let cy2 = y + 38;
    opt.cons.forEach((c) => {
      doc.font(F.r).fontSize(7).fillColor(C.textLight);
      doc.text(`- ${c}`, consX, cy2, { width: colW, lineBreak: false });
      cy2 += 12;
    });

    const bestY = y + 38 + bodyH + 4;
    doc.font(F.r).fontSize(6.5).fillColor(C.textMuted);
    doc.text(`Best if: ${opt.best_if}`, M.l + 12, bestY, { width: W - 24, lineBreak: false });

    y += cardH + 8;
  });

  doc.y = y;
}

// ============================================================================
// 05 — Competitors
// ============================================================================

function renderCompetitors(doc: PDFKit.PDFDocument, r: ReportOutput) {
  sectionHead(doc, '05', 'Competitors');
  const comp = r.competitors;
  let y = doc.y;

  const cw = (W - 20) / 3;
  const ch = 58;
  comp.competitor_list.forEach((c, i) => {
    const col = i % 3;
    if (col === 0) {
      if (i > 0) y += ch + 8;
      ensureSpace(doc, ch + 8);
    }
    const x = M.l + col * (cw + 10);
    const tc = tierColor(c.tier);
    card(doc, x, y, cw, ch, { accent: tc });

    doc.font(F.b).fontSize(8.5).fillColor(C.text);
    lbl(doc, c.name, x + 12, y + 10);
    badge(doc, c.tier, x + cw - 62, y + 10, tc);

    if (c.rating > 0) {
      doc.font(F.r).fontSize(6.5).fillColor(C.textLight);
      lbl(doc, `Rating: ${c.rating}/5`, x + 12, y + 28);
      bar(doc, x + 12, y + 39, cw - 24, 3, (c.rating / 5) * 100, tc);
    }
    if (c.funding) {
      doc.font(F.r).fontSize(6.5).fillColor(C.textLight);
      doc.text(c.funding, x + 12, y + 45, { width: cw - 24, lineBreak: false });
    }
  });
  y += ch + 12;

  // Tiers
  ensureSpace(doc, 18 + comp.tiers.length * 30);
  doc.font(F.b).fontSize(7).fillColor(C.textMuted);
  lbl(doc, 'COMPETITIVE TIERS', M.l, y);
  y += 14;

  comp.tiers.forEach((t) => {
    const whyH = textH(doc, t.why, F.r, 6.5, W - 95, 1);
    ensureSpace(doc, 12 + whyH + 6);
    doc.font(F.b).fontSize(7.5).fillColor(C.indigo);
    lbl(doc, t.tier_name, M.l, y);
    doc.font(F.b).fontSize(7.5).fillColor(C.text);
    lbl(doc, t.companies, M.l + 95, y);
    doc.font(F.r).fontSize(6.5).fillColor(C.textLight);
    doc.text(t.why, M.l + 95, y + 12, { width: W - 95, lineGap: 1 });
    y += 12 + whyH + 8;
  });
  y += 4;

  // Complaints — dynamic heights, handle non-numeric percentages
  ensureSpace(doc, 18 + comp.complaints.length * 40);
  doc.font(F.b).fontSize(7).fillColor(C.textMuted);
  lbl(doc, 'COMPLAINT GAPS (YOUR OPPORTUNITY)', M.l, y);
  y += 14;

  comp.complaints.forEach((c) => {
    const pct = c.percentage || '';
    const isShortPct = /^\d/.test(pct) && pct.length <= 5;

    const textX = isShortPct ? M.l + 48 : M.l + 12;
    const textW = isShortPct ? W - 60 : W - 24;

    const complaintH = textH(doc, c.complaint, F.b, 7.5, textW, 1);
    const oppH = textH(doc, c.opportunity, F.r, 6.5, textW, 1);

    let innerH: number;
    if (isShortPct) {
      innerH = 8 + complaintH + 3 + oppH + 8;
    } else {
      innerH = 8 + 12 + 4 + complaintH + 3 + oppH + 8;
    }
    const cardH = Math.max(innerH, 28);

    ensureSpace(doc, cardH + 6);
    card(doc, M.l, y, W, cardH, { accent: C.amber });

    if (isShortPct) {
      doc.font(F.b).fontSize(7.5).fillColor(C.amber);
      lbl(doc, pct, M.l + 12, y + 8);
      doc.font(F.b).fontSize(7.5).fillColor(C.text);
      doc.text(c.complaint, textX, y + 8, { width: textW, lineGap: 1 });
      doc.font(F.r).fontSize(6.5).fillColor(C.textLight);
      doc.text(c.opportunity, textX, y + 8 + complaintH + 3, { width: textW, lineGap: 1 });
    } else {
      badge(doc, pct || 'N/A', M.l + 12, y + 6, C.amber);
      const contentY = y + 22;
      doc.font(F.b).fontSize(7.5).fillColor(C.text);
      doc.text(c.complaint, textX, contentY, { width: textW, lineGap: 1 });
      doc.font(F.r).fontSize(6.5).fillColor(C.textLight);
      doc.text(c.opportunity, textX, contentY + complaintH + 3, { width: textW, lineGap: 1 });
    }
    y += cardH + 6;
  });

  doc.y = y;
}

// ============================================================================
// 06 — Positioning — dynamic text heights for quotes
// ============================================================================

function renderPositioning(doc: PDFKit.PDFDocument, r: ReportOutput) {
  const pos = r.positioning;
  const halfW = (W - 10) / 2;
  const innerW = halfW - 24;

  const curQuoteH = textH(doc, `"${pos.current.text}"`, F.i, 8, innerW, 1);
  const recQuoteH = textH(doc, `"${pos.recommended.text}"`, F.i, 8, innerW, 1);

  let curItemsH = 0;
  pos.current.critique.forEach((c) => {
    curItemsH += textH(doc, `x  ${c}`, F.r, 7, innerW, 0) + 4;
  });
  let recItemsH = 0;
  pos.recommended.improvements.forEach((imp) => {
    recItemsH += textH(doc, `+  ${imp}`, F.r, 7, innerW, 0) + 4;
  });

  const curH = 24 + curQuoteH + 12 + curItemsH + 10;
  const recH = 24 + recQuoteH + 12 + recItemsH + 10;
  const maxH = Math.max(curH, recH);

  ensureSpace(doc, maxH + 44);
  sectionHead(doc, '06', 'Positioning');
  let y = doc.y;

  // Current
  card(doc, M.l, y, halfW, maxH, { accent: C.red });
  doc.font(F.b).fontSize(6.5).fillColor(C.red);
  lbl(doc, 'CURRENT POSITIONING', M.l + 12, y + 10);
  doc.font(F.i).fontSize(8).fillColor(C.text);
  doc.text(`"${pos.current.text}"`, M.l + 12, y + 24, { width: innerW, lineGap: 1 });
  let py = y + 24 + curQuoteH + 10;
  pos.current.critique.forEach((c) => {
    const ih = textH(doc, `x  ${c}`, F.r, 7, innerW, 0);
    doc.font(F.r).fontSize(7).fillColor(C.textLight);
    doc.text(`x  ${c}`, M.l + 12, py, { width: innerW });
    py += ih + 4;
  });

  // Recommended
  const rx = M.l + halfW + 10;
  card(doc, rx, y, halfW, maxH, { accent: C.emerald });
  doc.font(F.b).fontSize(6.5).fillColor(C.emerald);
  lbl(doc, 'RECOMMENDED POSITIONING', rx + 12, y + 10);
  doc.font(F.i).fontSize(8).fillColor(C.text);
  doc.text(`"${pos.recommended.text}"`, rx + 12, y + 24, { width: innerW, lineGap: 1 });
  let ry = y + 24 + recQuoteH + 10;
  pos.recommended.improvements.forEach((imp) => {
    const ih = textH(doc, `+  ${imp}`, F.r, 7, innerW, 0);
    doc.font(F.r).fontSize(7).fillColor(C.textLight);
    doc.text(`+  ${imp}`, rx + 12, ry, { width: innerW });
    ry += ih + 4;
  });

  doc.y = y + maxH + 10;
}

// ============================================================================
// 07 — The Bottom Line — dynamic verdict card + one-thing heights
// ============================================================================

function renderBottomLine(doc: PDFKit.PDFDocument, r: ReportOutput) {
  sectionHead(doc, '07', 'The Bottom Line');
  const bl = r.bottom_line;
  let y = doc.y;

  // Verdict card — dynamic height
  const verdictTH = textH(doc, bl.verdict, F.b, 10, W - 28, 2);
  const detailTH = textH(doc, bl.verdict_detail, F.r, 7.5, W - 28, 1);
  const verdictCardH = 14 + verdictTH + 8 + detailTH + 14;

  ensureSpace(doc, verdictCardH + 8);
  card(doc, M.l, y, W, verdictCardH, { fill: C.dark });
  doc.font(F.b).fontSize(10).fillColor(C.white);
  doc.text(bl.verdict, M.l + 14, y + 12, { width: W - 28, lineGap: 2 });
  doc.font(F.r).fontSize(7.5).fillColor(C.textMuted);
  doc.text(bl.verdict_detail, M.l + 14, y + 12 + verdictTH + 8, { width: W - 28, lineGap: 1 });
  y += verdictCardH + 10;

  // Working / Not Working — dynamic item heights
  const halfW = (W - 10) / 2;
  const itemW = halfW - 24;
  let workingH = 0;
  bl.working.forEach((w) => { workingH += textH(doc, `+  ${w}`, F.r, 7, itemW, 0) + 4; });
  let notWorkingH = 0;
  bl.not_working.forEach((nw) => { notWorkingH += textH(doc, `x  ${nw}`, F.r, 7, itemW, 0) + 4; });
  const workH = 24 + Math.max(workingH, notWorkingH) + 6;
  ensureSpace(doc, workH + 8);

  card(doc, M.l, y, halfW, workH, { accent: C.emerald });
  doc.font(F.b).fontSize(6.5).fillColor(C.emerald);
  lbl(doc, "WHAT'S WORKING", M.l + 12, y + 8);
  let wy = y + 22;
  bl.working.forEach((w) => {
    const ih = textH(doc, `+  ${w}`, F.r, 7, itemW, 0);
    doc.font(F.r).fontSize(7).fillColor(C.textLight);
    doc.text(`+  ${w}`, M.l + 12, wy, { width: itemW });
    wy += ih + 4;
  });

  card(doc, M.l + halfW + 10, y, halfW, workH, { accent: C.red });
  doc.font(F.b).fontSize(6.5).fillColor(C.red);
  lbl(doc, "WHAT'S NOT WORKING", M.l + halfW + 22, y + 8);
  let nwy = y + 22;
  bl.not_working.forEach((nw) => {
    const ih = textH(doc, `x  ${nw}`, F.r, 7, itemW, 0);
    doc.font(F.r).fontSize(7).fillColor(C.textLight);
    doc.text(`x  ${nw}`, M.l + halfW + 22, nwy, { width: itemW });
    nwy += ih + 4;
  });
  y += workH + 10;

  // Score progression
  ensureSpace(doc, 66);
  doc.font(F.b).fontSize(7).fillColor(C.textMuted);
  lbl(doc, 'SCORE PROGRESSION', M.l, y);
  y += 14;
  const progW = (W - (bl.score_progression.length - 1) * 8) / bl.score_progression.length;
  bl.score_progression.forEach((sp, i) => {
    const px = M.l + i * (progW + 8);
    card(doc, px, y, progW, 54, { fill: C.bg });
    doc.font(F.b).fontSize(16).fillColor(C.indigo);
    doc.text(sp.score, px, y + 6, { width: progW, align: 'center', lineBreak: false });
    doc.font(F.b).fontSize(7.5).fillColor(C.text);
    doc.text(sp.label, px + 6, y + 24, { width: progW - 12, align: 'center', lineBreak: false });
    doc.font(F.r).fontSize(6).fillColor(C.textMuted);
    doc.text(sp.detail, px + 6, y + 36, { width: progW - 12, align: 'center' });
  });
  y += 64;

  // The One Thing — dynamic height
  const titleH = textH(doc, bl.one_thing.title, F.b, 9, W - 24, 1);
  const explH = textH(doc, bl.one_thing.explanation, F.r, 7.5, W - 24, 1);
  const oneH = 22 + titleH + 6 + explH + 12;

  ensureSpace(doc, oneH + 8);
  card(doc, M.l, y, W, oneH, { accent: C.indigo, fill: C.indigoLight });
  doc.font(F.b).fontSize(6.5).fillColor(C.indigo);
  lbl(doc, 'THE ONE THING', M.l + 12, y + 8);
  doc.font(F.b).fontSize(9).fillColor(C.text);
  doc.text(bl.one_thing.title, M.l + 12, y + 22, { width: W - 24, lineGap: 1 });
  doc.font(F.r).fontSize(7.5).fillColor(C.textLight);
  doc.text(bl.one_thing.explanation, M.l + 12, y + 22 + titleH + 6, { width: W - 24, lineGap: 1 });
  y += oneH + 10;

  // Research stats
  if (bl.research_stats.length > 0) {
    ensureSpace(doc, 34);
    const statW = (W - (bl.research_stats.length - 1) * 6) / bl.research_stats.length;
    bl.research_stats.forEach((rs, i) => {
      const sx = M.l + i * (statW + 6);
      card(doc, sx, y, statW, 28, { fill: C.bg });
      doc.font(F.b).fontSize(10).fillColor(C.indigo);
      lbl(doc, rs.number, sx + 8, y + 5);
      doc.font(F.r).fontSize(6.5).fillColor(C.textMuted);
      lbl(doc, rs.label, sx + 8, y + 17);
    });
    y += 36;
  }

  doc.y = y;
}

// ============================================================================
// 08 — Recommendations — dynamic card heights
// ============================================================================

function renderRecommendations(doc: PDFKit.PDFDocument, r: ReportOutput) {
  sectionHead(doc, '08', 'Recommendations');

  r.recommendations.forEach((rec) => {
    const actionH = textH(doc, rec.action, F.r, 7.5, W - 52, 1);
    const evidenceH = textH(doc, rec.evidence, F.r, 7, W - 52, 1);
    const cardH = 26 + actionH + 6 + evidenceH + 10;
    const ec = effortColor(rec.effort);

    ensureSpace(doc, cardH + 8);
    const y = doc.y;

    card(doc, M.l, y, W, cardH, { accent: C.indigo });

    doc.save();
    doc.roundedRect(M.l + 10, y + 10, 20, 20, 4).fill(C.indigoLight);
    doc.font(F.b).fontSize(9).fillColor(C.indigo);
    doc.text(String(rec.rank), M.l + 10, y + 15, { width: 20, align: 'center', lineBreak: false });
    doc.restore();

    doc.font(F.b).fontSize(9).fillColor(C.text);
    doc.text(rec.title, M.l + 38, y + 10, { width: W - 180, lineBreak: false });
    badge(doc, `${rec.effort} effort`, M.l + W - 110, y + 10, ec);
    doc.font(F.r).fontSize(6.5).fillColor(C.textMuted);
    lbl(doc, rec.timeline, M.l + W - 46, y + 12);

    doc.font(F.r).fontSize(7.5).fillColor(C.text);
    doc.text(rec.action, M.l + 38, y + 26, { width: W - 52, lineGap: 1 });
    doc.font(F.r).fontSize(7).fillColor(C.textLight);
    doc.text(rec.evidence, M.l + 38, y + 26 + actionH + 6, { width: W - 52, lineGap: 1 });

    doc.y = y + cardH + 8;
  });
}

// ============================================================================
// 09 — Sources
// ============================================================================

function renderSources(doc: PDFKit.PDFDocument, r: ReportOutput) {
  ensureSpace(doc, 34 + r.sources.length * 15);
  sectionHead(doc, '09', 'Sources');

  let y = doc.y;
  const colW = [130, 40, W - 180];
  const hdrs = ['Source', 'Year', 'Used For'];
  let tx = M.l;
  hdrs.forEach((h, i) => {
    doc.font(F.b).fontSize(6.5).fillColor(C.textMuted);
    lbl(doc, h, tx, y);
    tx += colW[i] + 5;
  });
  y += 12;
  doc.moveTo(M.l, y).lineTo(M.l + W, y).strokeColor(C.border).lineWidth(0.5).stroke();
  y += 5;

  r.sources.forEach((s) => {
    ensureSpace(doc, 15);
    tx = M.l;
    doc.font(F.b).fontSize(7).fillColor(s.source_url ? C.indigo : C.text);
    doc.text(s.name, tx, y, { width: colW[0], link: s.source_url || undefined, lineBreak: false });
    tx += colW[0] + 5;
    doc.font(F.r).fontSize(7).fillColor(C.textMuted);
    lbl(doc, s.year, tx, y);
    tx += colW[1] + 5;
    doc.font(F.r).fontSize(7).fillColor(C.textLight);
    doc.text(s.used_for, tx, y, { width: colW[2], lineBreak: false });
    y += 14;
  });

  doc.y = y;
}

// ============================================================================
// Main export
// ============================================================================

/** Safe defaults so PDF never throws in Lambda when DB JSON shape/type differs. */
function normalizeForPdf(r: ReportOutput): ReportOutput {
  const h = r?.header ?? ({} as any);
  const header = {
    product_name: h.product_name ?? 'Product',
    category: h.category ?? 'Category',
    pmf_score: Number(h.pmf_score) || 0,
    benchmark_score: Number(h.benchmark_score) || 0,
    pmf_stage: (['pre_pmf', 'approaching', 'early_pmf', 'strong'].includes(h.pmf_stage) ? h.pmf_stage : 'pre_pmf') as ReportOutput['header']['pmf_stage'],
    primary_break: h.primary_break ?? '',
    category_risk: (['low', 'medium', 'high'].includes(h.category_risk) ? h.category_risk : 'medium') as ReportOutput['header']['category_risk'],
    verdict: h.verdict ?? '',
  };
  const dims = Array.isArray(r?.scorecard?.dimensions) ? r.scorecard.dimensions : [];
  const dimensions = dims.slice(0, 7).map((d: any) => ({
    name: d?.name ?? '',
    score: Math.min(10, Math.max(1, Number(d?.score) || 1)),
    benchmark: Math.min(10, Math.max(1, Number(d?.benchmark) || 1)),
    status: (['critical', 'at_risk', 'on_track', 'strong'].includes(d?.status) ? d.status : 'on_track') as any,
    evidence: d?.evidence ?? '',
    confidence: (['low', 'medium', 'high'].includes(d?.confidence) ? d.confidence : 'medium') as any,
  }));
  while (dimensions.length < 7) {
    dimensions.push({ name: '', score: 1, benchmark: 1, status: 'on_track', evidence: '', confidence: 'medium' });
  }
  const def = (x: any, fallback: any) => (x != null && typeof x === 'object' ? x : fallback);
  return {
    header,
    scorecard: { dimensions },
    reality_check: def(r?.reality_check, { comparisons: [], root_cause: '' }),
    market: def(r?.market, { tam: { value: '', description: '' }, sam: { value: '', description: '' }, growth_rate: { value: '', description: '' }, regions: [], real_number_analysis: '' }),
    sales_model: def(r?.sales_model, { comparison: { you_said: '', research_shows: '', severity: 'aligned' }, models_table: [], diagnosis: '', options: [] }),
    competitors: def(r?.competitors, { competitor_list: [], tiers: [], complaints: [] }),
    positioning: def(r?.positioning, { current: { text: '', critique: [] }, recommended: { text: '', improvements: [] } }),
    bottom_line: def(r?.bottom_line, { verdict: '', verdict_detail: '', working: [], not_working: [], score_progression: [], one_thing: { title: '', explanation: '' }, research_stats: [] }),
    recommendations: Array.isArray(r?.recommendations) ? r.recommendations.slice(0, 5) : [],
    sources: Array.isArray(r?.sources) ? r.sources : [],
  } as ReportOutput;
}

export async function generateReportPdf(report: ReportOutput): Promise<Buffer> {
  const safe = normalizeForPdf(report);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: M.t, bottom: M.b, left: M.l, right: M.r },
      autoFirstPage: true,
      info: {
        Title: `PMF Report - ${safe.header.product_name}`,
        Author: 'PMF Insights',
        Subject: 'Product-Market Fit Assessment',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderCover(doc, safe);

    addContentPage(doc);
    renderOverview(doc, safe);

    addContentPage(doc);
    renderRealityCheck(doc, safe);

    addContentPage(doc);
    renderScorecard(doc, safe);

    addContentPage(doc);
    renderMarket(doc, safe);

    addContentPage(doc);
    renderSalesModel(doc, safe);

    addContentPage(doc);
    renderCompetitors(doc, safe);

    renderPositioning(doc, safe);

    addContentPage(doc);
    renderBottomLine(doc, safe);

    addContentPage(doc);
    renderRecommendations(doc, safe);

    renderSources(doc, safe);

    doc.end();
  });
}

export function getReportFilename(): string {
  return `PMF-Insight-Report-${new Date().toISOString().split('T')[0]}.pdf`;
}
