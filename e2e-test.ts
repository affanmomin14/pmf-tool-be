/**
 * PMF Tool — End-to-End Test
 *
 * Tests the full lifecycle: assessment → questions → pipeline → report → unlock → email → PDF
 * Validates quality at every step.
 *
 * Usage:  npx tsx e2e-test.ts
 * Requires: server running on PORT (default 3001)
 */

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const TEST_EMAIL = 'affan.momin@wednesday.is';

const PRODUCT_ANSWERS = {
  q1: {
    questionId: 1,
    questionOrder: 1,
    answerText:
      'No code end to end Enterprise BI and Analytics Platform Powered By AI Agents',
    timeSpentMs: 30000,
  },
  q2: {
    questionId: 2,
    questionOrder: 2,
    answerText:
      'Startups, enterprise, Data analyst, CXOs',
    timeSpentMs: 20000,
  },
  q3: {
    questionId: 3,
    questionOrder: 3,
    answerText:
      'Paid email ads, linkedin ads',
    timeSpentMs: 15000,
  },
  q4: {
    questionId: 4,
    questionOrder: 4,
    answerText:
      'Usage, adoption, retention',
    timeSpentMs: 15000,
  },
  q5: {
    questionId: 5,
    questionOrder: 5,
    answerText:
      '1000+ users but 99% of them are inactive, few big enterprise project long term contract but usage in less than 10%',
    timeSpentMs: 35000,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

let totalChecks = 0;
let passedChecks = 0;
let failedChecks: string[] = [];

function check(label: string, condition: boolean, detail = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ ${label}`);
  } else {
    failedChecks.push(label);
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function api<T = any>(
  method: string,
  path: string,
  body?: Record<string, any>,
): Promise<{ status: number; data: T; raw: any }> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const raw = await res.json();
  return { status: res.status, data: raw.data, raw };
}

function sectionTitle(title: string) {
  console.log('');
  console.log(`${'─'.repeat(64)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(64)}`);
}

function elapsed(start: number): string {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

// ─── Test Steps ─────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  console.log(`\n  PMF TOOL — END-TO-END TEST`);
  console.log(`  Target: ${BASE}`);
  console.log(`  Email:  ${TEST_EMAIL}`);
  console.log(`  Time:   ${new Date().toLocaleString()}\n`);

  // ── 0. Health Check ────────────────────────────────────────────────────
  sectionTitle('0. Health Check');
  const health = await api('GET', '/health');
  check('Server is reachable', health.status === 200);
  check('Health status is ok', health.data?.status === 'ok');

  // ── 1. Fetch Questions ─────────────────────────────────────────────────
  sectionTitle('1. Fetch System Questions');
  const qs = await api('GET', '/api/system/questions');
  check('Questions endpoint returns 200', qs.status === 200);
  check('At least 5 questions returned', Array.isArray(qs.data) && qs.data.length >= 5);
  if (Array.isArray(qs.data)) {
    qs.data.forEach((q: any) => {
      console.log(`     Q${q.displayOrder}: ${q.questionText?.substring(0, 80)}…`);
    });
  }

  // ── 2. Create Assessment ───────────────────────────────────────────────
  sectionTitle('2. Create Assessment');
  const t2 = Date.now();
  const assess = await api('POST', '/api/assessments', {
    problemType: 'market_fit',
    utmSource: 'e2e-test',
    utmMedium: 'script',
    utmCampaign: 'quality-check',
  });
  check('Assessment created (201)', assess.status === 201);
  check('Assessment has UUID id', typeof assess.data?.id === 'string' && assess.data.id.length > 10);
  check('Status is "started"', assess.data?.status === 'started');
  const assessmentId = assess.data?.id;
  console.log(`     Assessment ID: ${assessmentId}`);
  console.log(`     Created in ${elapsed(t2)}`);

  if (!assessmentId) {
    console.error('\n  ⛔ Cannot proceed without assessment ID. Aborting.\n');
    process.exit(1);
  }

  // ── 3. Submit 5 Responses ──────────────────────────────────────────────
  sectionTitle('3. Submit Answers (Q1–Q5)');
  const answers = [PRODUCT_ANSWERS.q1, PRODUCT_ANSWERS.q2, PRODUCT_ANSWERS.q3, PRODUCT_ANSWERS.q4, PRODUCT_ANSWERS.q5];

  for (const ans of answers) {
    const t3 = Date.now();
    const resp = await api('POST', `/api/assessments/${assessmentId}/responses`, ans);
    check(`Q${ans.questionOrder} submitted (201)`, resp.status === 201);
    check(`Q${ans.questionOrder} response has ID`, typeof resp.data?.response?.id === 'string');
    const hasMicro = !!resp.data?.microInsight;
    console.log(`     Q${ans.questionOrder} — micro-insight: ${hasMicro ? 'yes' : 'no'} (${elapsed(t3)})`);
  }

  // Verify assessment state
  const assessState = await api('GET', `/api/assessments/${assessmentId}`);
  check('Assessment has 5 responses', assessState.data?.responses?.length === 5);
  check('Status is "in_progress"', assessState.data?.status === 'in_progress');

  // ── 4. Run Full Pipeline (complete) ────────────────────────────────────
  sectionTitle('4. Run Full Pipeline (Classification → Research → Scoring → Report → Validation)');
  console.log('     ⏳ This will take 1-3 minutes...\n');
  const t4 = Date.now();
  const pipeline = await api('POST', `/api/assessments/${assessmentId}/complete`);
  const pipelineTime = elapsed(t4);

  check('Pipeline completed (200)', pipeline.status === 200);
  check('Report token returned', typeof pipeline.data?.reportToken === 'string' && pipeline.data.reportToken.length > 0);
  check('PMF score is 0-100', typeof pipeline.data?.pmfScore === 'number' && pipeline.data.pmfScore >= 0 && pipeline.data.pmfScore <= 100);
  check('PMF stage returned', ['pre_pmf', 'approaching', 'early_pmf', 'strong'].includes(pipeline.data?.pmfStage));
  check('Preview content exists', !!pipeline.data?.previewContent);

  const reportToken = pipeline.data?.reportToken;
  const pmfScore = pipeline.data?.pmfScore;
  const pmfStage = pipeline.data?.pmfStage;

  console.log(`\n     📊 PMF Score:  ${pmfScore}/100`);
  console.log(`     📊 PMF Stage:  ${pmfStage}`);
  console.log(`     📊 Break:      ${pipeline.data?.previewContent?.primaryBreak || 'N/A'}`);
  console.log(`     📊 Token:      ${reportToken}`);
  console.log(`     ⏱  Pipeline:   ${pipelineTime}`);

  if (!reportToken) {
    console.error('\n  ⛔ No report token. Aborting.\n');
    process.exit(1);
  }

  // ── 5. Get Report (Locked) ─────────────────────────────────────────────
  sectionTitle('5. Get Report (Locked — before email unlock)');
  const lockedReport = await api('GET', `/api/reports/${reportToken}`);
  check('Report endpoint returns 200', lockedReport.status === 200);
  check('Report is NOT unlocked', lockedReport.data?.isUnlocked === false);
  check('Report is NOT expired', lockedReport.data?.isExpired === false);
  check('Preview content available', !!lockedReport.data?.previewContent);
  check('Full report NOT available (locked)', !lockedReport.data?.report);
  console.log(`     Preview score: ${lockedReport.data?.pmfScore}, stage: ${lockedReport.data?.pmfStage}`);

  // ── 6. Create Lead (Unlock) ────────────────────────────────────────────
  sectionTitle('6. Create Lead & Unlock Report');
  const lead = await api('POST', '/api/leads', {
    assessmentId,
    email: TEST_EMAIL,
  });
  check('Lead created (201 or 200)', lead.status === 201 || lead.status === 200);
  check('Lead is unlocked', lead.data?.isUnlocked === true);
  check('Lead returns report token', typeof lead.data?.reportToken === 'string');
  console.log(`     Lead ID: ${lead.data?.leadId || 'N/A'}`);

  // ── 7. Get Full Report (Unlocked) ──────────────────────────────────────
  sectionTitle('7. Get Full Report (Unlocked)');
  const fullReport = await api('GET', `/api/reports/${reportToken}`);
  check('Report returns 200', fullReport.status === 200);
  check('Report IS unlocked', fullReport.data?.isUnlocked === true);
  check('Full report object exists', !!fullReport.data?.report);

  const report = fullReport.data?.report;
  if (report) {
    validateReportQuality(report);
  } else {
    console.log('     ⚠️  No report data to validate');
  }

  // ── 8. Send Email ──────────────────────────────────────────────────────
  sectionTitle('8. Send Report Email');
  const t8 = Date.now();
  const emailResult = await api('POST', `/api/reports/${reportToken}/email`, {
    email: TEST_EMAIL,
  });
  check('Email endpoint returns 200', emailResult.status === 200);
  check('Email sent successfully', emailResult.data?.sent === true);
  console.log(`     📧 Email sent to ${TEST_EMAIL} in ${elapsed(t8)}`);

  // ── 9. Idempotency Check ───────────────────────────────────────────────
  sectionTitle('9. Idempotency — Re-run pipeline returns cached result');
  const t9 = Date.now();
  const retry = await api('POST', `/api/assessments/${assessmentId}/complete`);
  check('Re-run returns 200 (cached)', retry.status === 200);
  check('Same report token', retry.data?.reportToken === reportToken);
  check('Same score', retry.data?.pmfScore === pmfScore);
  console.log(`     Returned cached in ${elapsed(t9)} (should be fast)`);

  // ── Final Summary ──────────────────────────────────────────────────────
  sectionTitle('RESULTS');
  console.log(`\n  Total checks: ${totalChecks}`);
  console.log(`  Passed:       ${passedChecks} ✅`);
  console.log(`  Failed:       ${failedChecks.length} ❌`);
  console.log(`  Total time:   ${elapsed(t0)}`);

  if (failedChecks.length > 0) {
    console.log(`\n  Failed checks:`);
    failedChecks.forEach((f) => console.log(`    • ${f}`));
  }

  console.log(`\n  Pipeline Details:`);
  console.log(`    Product:    No-code Enterprise BI & Analytics (AI Agents)`);
  console.log(`    Score:      ${pmfScore}/100`);
  console.log(`    Stage:      ${pmfStage}`);
  console.log(`    Report:     ${BASE}/api/reports/${reportToken}`);
  console.log(`    Email:      ${TEST_EMAIL}`);
  console.log('');

  process.exit(failedChecks.length > 0 ? 1 : 0);
}

// ─── Report Quality Validation ──────────────────────────────────────────────

function validateReportQuality(r: any) {
  console.log('\n  ── Report Quality Checks ──\n');

  // Header
  check('Header: product_name exists', !!r.header?.product_name);
  check('Header: category exists', !!r.header?.category);
  check('Header: pmf_score is 0-100', r.header?.pmf_score >= 0 && r.header?.pmf_score <= 100);
  check('Header: benchmark_score is 0-100', r.header?.benchmark_score >= 0 && r.header?.benchmark_score <= 100);
  check('Header: pmf_stage valid', ['pre_pmf', 'approaching', 'early_pmf', 'strong'].includes(r.header?.pmf_stage));
  check('Header: verdict is substantive (>50 chars)', r.header?.verdict?.length > 50);
  check('Header: verdict is NOT "Data not available"', !r.header?.verdict?.includes('Data not available'));

  // Reality Check
  const rc = r.reality_check;
  check('Reality Check: has 5 comparisons', rc?.comparisons?.length === 5);
  check('Reality Check: root_cause exists', !!rc?.root_cause && rc.root_cause.length > 30);
  if (rc?.comparisons) {
    let allHaveResearch = true;
    let allHaveSeverity = true;
    for (const comp of rc.comparisons) {
      if (!comp.research_shows || comp.research_shows.length < 20 || comp.research_shows === 'Data not available') allHaveResearch = false;
      if (!['critical', 'warning', 'aligned'].includes(comp.severity)) allHaveSeverity = false;
    }
    check('Reality Check: ALL comparisons have substantive research', allHaveResearch);
    check('Reality Check: all severities valid', allHaveSeverity);
  }

  // Scorecard
  const sc = r.scorecard;
  check('Scorecard: has 7 dimensions', sc?.dimensions?.length === 7);
  if (sc?.dimensions) {
    const dimNames = sc.dimensions.map((d: any) => d.name);
    check('Scorecard: has Demand dimension', dimNames.some((n: string) => n.toLowerCase().includes('demand')));
    check('Scorecard: has Differentiation', dimNames.some((n: string) => n.toLowerCase().includes('differentiation')));

    let allValid = true;
    let allHaveEvidence = true;
    for (const d of sc.dimensions) {
      if (d.score < 1 || d.score > 10) allValid = false;
      if (!d.evidence || d.evidence.length < 20 || d.evidence === 'Data not available') allHaveEvidence = false;
    }
    check('Scorecard: all scores 1-10', allValid);
    check('Scorecard: all dimensions have substantive evidence', allHaveEvidence);
  }

  // Market
  const mkt = r.market;
  check('Market: TAM value exists', !!mkt?.tam?.value);
  check('Market: SAM value exists', !!mkt?.sam?.value);
  check('Market: growth_rate exists', !!mkt?.growth_rate?.value);
  check('Market: has regions', mkt?.regions?.length >= 1);
  check('Market: TAM is NOT "Data not available"', mkt?.tam?.value !== 'Data not available');
  check('Market: real_number_analysis exists', !!mkt?.real_number_analysis && mkt.real_number_analysis.length > 30);

  // Sales Model
  const sm = r.sales_model;
  check('Sales Model: comparison exists', !!sm?.comparison);
  check('Sales Model: has 2+ models in table', sm?.models_table?.length >= 2);
  check('Sales Model: diagnosis exists', !!sm?.diagnosis && sm.diagnosis.length > 20);
  check('Sales Model: has 2+ options', sm?.options?.length >= 2);
  if (sm?.options) {
    const allHaveTimeline = sm.options.every((o: any) => !!o.timeline);
    const allHavePros = sm.options.every((o: any) => o.pros?.length > 0);
    check('Sales Model: all options have timelines', allHaveTimeline);
    check('Sales Model: all options have pros', allHavePros);
  }

  // Competitors
  const comp = r.competitors;
  check('Competitors: has 3+ competitors', comp?.competitor_list?.length >= 3);
  check('Competitors: has tier breakdown', comp?.tiers?.length >= 2);
  check('Competitors: has complaint gaps', comp?.complaints?.length >= 2);
  if (comp?.competitor_list) {
    const hasRatings = comp.competitor_list.some((c: any) => c.rating > 0);
    const hasFunding = comp.competitor_list.some((c: any) => !!c.funding && c.funding !== 'Data not available');
    const hasNames = comp.competitor_list.every((c: any) => !!c.name && c.name !== 'Data not available');
    check('Competitors: at least one has rating', hasRatings);
    check('Competitors: at least one has funding data', hasFunding);
    check('Competitors: all have real names', hasNames);
  }

  // Positioning
  const pos = r.positioning;
  check('Positioning: current text exists', !!pos?.current?.text && pos.current.text.length > 10);
  check('Positioning: has critique points', pos?.current?.critique?.length >= 2);
  check('Positioning: recommended text exists', !!pos?.recommended?.text && pos.recommended.text.length > 10);
  check('Positioning: has improvement points', pos?.recommended?.improvements?.length >= 2);

  // Bottom Line
  const bl = r.bottom_line;
  check('Bottom Line: verdict exists (>50 chars)', bl?.verdict?.length > 50);
  check('Bottom Line: verdict_detail exists', !!bl?.verdict_detail && bl.verdict_detail.length > 30);
  check('Bottom Line: has working items', bl?.working?.length >= 1);
  check('Bottom Line: has not_working items', bl?.not_working?.length >= 1);
  check('Bottom Line: has score_progression', bl?.score_progression?.length >= 2);
  check('Bottom Line: one_thing has title', !!bl?.one_thing?.title && bl.one_thing.title.length > 10);
  check('Bottom Line: one_thing has explanation', !!bl?.one_thing?.explanation && bl.one_thing.explanation.length > 30);
  check('Bottom Line: has research_stats', bl?.research_stats?.length >= 1);

  // Recommendations
  const recs = r.recommendations;
  check('Recommendations: has 5 items', recs?.length === 5);
  if (recs) {
    const allHaveAction = recs.every((rec: any) => rec.action?.length > 20);
    const allHaveEvidence = recs.every((rec: any) => rec.evidence?.length > 20);
    const allHaveEffort = recs.every((rec: any) => ['low', 'medium', 'high'].includes(rec.effort));
    const ranksCorrect = recs.map((rec: any) => rec.rank).join(',') === '1,2,3,4,5';
    check('Recommendations: all have substantive actions', allHaveAction);
    check('Recommendations: all have evidence', allHaveEvidence);
    check('Recommendations: all have valid effort levels', allHaveEffort);
    check('Recommendations: ranks are 1-5 in order', ranksCorrect);
  }

  // Sources
  const src = r.sources;
  check('Sources: has 1+ sources', src?.length >= 1);
  if (src) {
    const allHaveNames = src.every((s: any) => !!s.name && s.name !== 'Data not available');
    const allHaveYear = src.every((s: any) => !!s.year);
    check('Sources: all have real names', allHaveNames);
    check('Sources: all have year', allHaveYear);
  }

  // Coherence checks
  console.log('\n  ── Coherence & Intelligence Checks ──\n');

  const allText = JSON.stringify(r).toLowerCase();
  check('Coherence: report mentions BI/analytics', allText.includes('bi') || allText.includes('analytics') || allText.includes('business intelligence'));
  check('Coherence: report mentions competitors by name', allText.includes('tableau') || allText.includes('power bi') || allText.includes('looker') || allText.includes('metabase') || allText.includes('thoughtspot'));
  check('Coherence: no "Data not available" in key fields', !allText.includes('"data not available"'));

  const dnaCount = (allText.match(/data not available/g) || []).length;
  console.log(`     "Data not available" occurrences: ${dnaCount}`);

  const headerScore = r.header?.pmf_score;
  const blScore = r.bottom_line?.score_progression?.[0]?.score;
  if (headerScore && blScore) {
    check(
      'Coherence: header score matches progression "Now"',
      String(headerScore) === String(blScore),
      `header=${headerScore}, progression=${blScore}`,
    );
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('\n  ⛔ Unhandled error:', err.message || err);
  process.exit(1);
});
