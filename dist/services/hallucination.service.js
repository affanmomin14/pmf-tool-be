"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkNumbers = checkNumbers;
exports.checkCompanyNames = checkCompanyNames;
exports.checkScoreTextConsistency = checkScoreTextConsistency;
exports.checkVerdictLength = checkVerdictLength;
exports.truncateVerdicts = truncateVerdicts;
exports.checkGibberish = checkGibberish;
exports.checkAndReplaceBannedWords = checkAndReplaceBannedWords;
exports.validateReport = validateReport;
const report_service_1 = require("./report.service");
// ============================================================================
// Check 1 -- Number verification (HVAL-01)
// ============================================================================
function extractNumbers(text) {
    const matches = text.match(/\$?[\d,]+\.?\d*[BMK%]?(?:\/\d+)?/g);
    if (!matches)
        return [];
    const seen = {};
    return matches.filter((m) => {
        if (seen[m])
            return false;
        seen[m] = true;
        return true;
    });
}
function buildNumberAllowlist(research, scores, founderAnswers) {
    const allowlist = new Set();
    // Extract numbers from research and founder answers
    const sourceNumbers = extractNumbers(JSON.stringify(research) + ' ' + JSON.stringify(founderAnswers));
    for (const n of sourceNumbers) {
        allowlist.add(n);
    }
    // Add scores 1-10 (for ratings and dimension scores)
    for (let i = 1; i <= 10; i++) {
        allowlist.add(String(i));
    }
    // Add score-derived numbers
    allowlist.add(String(scores.pmfScore));
    allowlist.add(String(scores.benchmark));
    for (const dim of scores.dimensions) {
        allowlist.add(String(dim.score));
        allowlist.add(String(dim.weight));
    }
    // Skip common year numbers (dates)
    for (let year = 2020; year <= 2030; year++) {
        allowlist.add(String(year));
    }
    return allowlist;
}
function checkNumbers(report, research, scores, founderAnswers) {
    const flags = [];
    const allowlist = buildNumberAllowlist(research, scores, founderAnswers);
    const reportNumbers = extractNumbers(JSON.stringify(report));
    for (const num of reportNumbers) {
        if (!allowlist.has(num)) {
            flags.push({
                check: 'number_verification',
                field: 'report_text',
                expected: 'Number from research/answers/scores',
                found: num,
                severity: 'error',
            });
        }
    }
    return flags;
}
// ============================================================================
// Check 2 -- Company name verification (HVAL-02)
// ============================================================================
const COMMON_SKIP_TERMS = new Set([
    'product market fit', 'pmf', 'tam', 'sam', 'saas', 'b2b', 'b2c', 'ai',
    'series a', 'series b', 'series c', 'mrr', 'arr', 'api', 'roi', 'kpi',
    'cac', 'ltv', 'nps', 'seo', 'crm', 'erp', 'mvp', 'ux', 'ui',
    'data not available', 'not available', 'sprint',
    'the', 'this', 'we', 'they', 'our', 'their', 'it', 'he', 'she',
    'however', 'therefore', 'first', 'second', 'next', 'finally', 'yes', 'no',
    'for', 'in', 'on', 'at', 'to', 'with', 'from', 'by', 'as', 'an', 'a',
]);
function checkCompanyNames(report, research) {
    const flags = [];
    // Build known company names set
    const knownCompanies = new Set();
    for (const c of research.competitors) {
        knownCompanies.add(c.name.toLowerCase());
    }
    // Add the founder's company name from report header
    knownCompanies.add(report.header.product_name.toLowerCase());
    // Extract capitalized multi-word phrases from report text
    const reportStr = JSON.stringify(report);
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const extractedNames = reportStr.match(namePattern) || [];
    const seen = {};
    const uniqueNames = extractedNames.filter((n) => {
        if (seen[n])
            return false;
        seen[n] = true;
        return true;
    });
    for (const name of uniqueNames) {
        const lower = name.toLowerCase();
        if (knownCompanies.has(lower))
            continue;
        if (COMMON_SKIP_TERMS.has(lower))
            continue;
        // Skip single-letter capitalizations
        if (name.length === 1)
            continue;
        flags.push({
            check: 'company_names',
            field: 'report_text',
            expected: 'Known company from research.competitors',
            found: name,
            severity: 'warning',
        });
    }
    return flags;
}
// ============================================================================
// Check 3 -- Score-text consistency (HVAL-03)
// ============================================================================
const POSITIVE_WORDS = ['strong', 'excellent', 'impressive', 'outstanding', 'exceptional'];
const NEGATIVE_WORDS = ['weak', 'poor', 'critical', 'concerning', 'lacking', 'insufficient'];
function textContainsWord(text, words) {
    const lower = text.toLowerCase();
    for (const word of words) {
        if (lower.includes(word))
            return word;
    }
    return null;
}
function checkScoreTextConsistency(report, scores) {
    const flags = [];
    // Check each scorecard dimension
    for (const item of report.scorecard.dimensions) {
        if (item.score <= 3) {
            const found = textContainsWord(item.evidence, POSITIVE_WORDS);
            if (found) {
                flags.push({
                    check: 'score_text_consistency',
                    field: `scorecard.${item.name}.evidence`,
                    expected: `Negative/neutral tone for score ${item.score}`,
                    found: `Positive word "${found}" with score ${item.score}`,
                    severity: 'error',
                });
            }
        }
        if (item.score >= 8) {
            const found = textContainsWord(item.evidence, NEGATIVE_WORDS);
            if (found) {
                flags.push({
                    check: 'score_text_consistency',
                    field: `scorecard.${item.name}.evidence`,
                    expected: `Positive/neutral tone for score ${item.score}`,
                    found: `Negative word "${found}" with score ${item.score}`,
                    severity: 'error',
                });
            }
        }
    }
    // Check overall PMF score consistency
    const overallTexts = [
        { text: report.bottom_line.verdict, field: 'bottom_line.verdict' },
        { text: report.bottom_line.verdict_detail, field: 'bottom_line.verdict_detail' },
    ];
    for (const { text, field } of overallTexts) {
        if (scores.pmfScore <= 35) {
            const found = textContainsWord(text, POSITIVE_WORDS);
            if (found) {
                flags.push({
                    check: 'score_text_consistency',
                    field,
                    expected: `Cautious tone for PMF score ${scores.pmfScore}`,
                    found: `Positive word "${found}" with PMF score ${scores.pmfScore}`,
                    severity: 'warning',
                });
            }
        }
        if (scores.pmfScore >= 80) {
            const found = textContainsWord(text, NEGATIVE_WORDS);
            if (found) {
                flags.push({
                    check: 'score_text_consistency',
                    field,
                    expected: `Positive tone for PMF score ${scores.pmfScore}`,
                    found: `Negative word "${found}" with PMF score ${scores.pmfScore}`,
                    severity: 'warning',
                });
            }
        }
    }
    // Check specific semantic contradictions for key dimensions
    const demandScore = scores.dimensions.find(d => d.dimension.toLowerCase() === 'demand')?.score;
    if (demandScore && demandScore >= 8) {
        const demandTexts = [report.header.verdict, report.bottom_line.verdict].join(' ');
        const found = textContainsWord(demandTexts, ['no demand', 'low demand', 'no validated demand', 'lack of demand']);
        if (found) {
            flags.push({ check: 'semantic_consistency', field: 'verdict', expected: 'Acknowledges strong demand (score >= 8)', found: `Contradictory phrase "${found}"`, severity: 'error' });
        }
    }
    const diffScore = scores.dimensions.find(d => d.dimension.toLowerCase() === 'differentiation')?.score;
    if (diffScore && diffScore >= 8) {
        const diffTexts = [report.header.verdict, report.bottom_line.verdict].join(' ');
        const found = textContainsWord(diffTexts, ['no differentiation', 'undifferentiated', 'commodity', 'looks like everyone else']);
        if (found) {
            flags.push({ check: 'semantic_consistency', field: 'verdict', expected: 'Acknowledges strong differentiation (score >= 8)', found: `Contradictory phrase "${found}"`, severity: 'error' });
        }
    }
    return flags;
}
// ============================================================================
// Check 4 -- Verdict length (HVAL-04)
// ============================================================================
function checkVerdictLength(report) {
    const flags = [];
    for (const [field, text] of [
        ['header.verdict', report.header.verdict],
        ['bottom_line.verdict', report.bottom_line.verdict],
    ]) {
        const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
        if (sentences.length > 1) {
            flags.push({
                check: 'verdict_length',
                field,
                expected: 'Single sentence verdict',
                found: `${sentences.length} sentences: "${text}"`,
                severity: 'warning',
            });
        }
    }
    return flags;
}
function truncateVerdicts(report) {
    const truncate = (text) => {
        const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
        return sentences.length <= 1 ? text : sentences[0];
    };
    return {
        ...report,
        header: { ...report.header, verdict: truncate(report.header.verdict) },
        bottom_line: { ...report.bottom_line, verdict: truncate(report.bottom_line.verdict) },
    };
}
// ============================================================================
// Check 5 -- Gibberish / garbled text detection (HVAL-05)
// Known OpenAI API bug: gpt-4o sometimes returns consonant-heavy nonsense
// e.g. "hprducssrugggwhdmd" instead of "the product is struggling with demand"
// ============================================================================
const VOWELS = /[aeiouAEIOU]/g;
function isGibberish(text) {
    if (!text || text.length < 12)
        return false;
    const words = text.split(/[\s,;:.()\[\]{}"/]+/).filter(w => {
        if (w.length < 5)
            return false;
        if (/^\d/.test(w))
            return false;
        if (/^[A-Z]{2,}$/.test(w))
            return false;
        if (/^https?:/.test(w))
            return false;
        if (/^[A-Z][a-z]+$/.test(w) && w.length <= 8)
            return false;
        return true;
    });
    if (words.length === 0)
        return false;
    let garbledCount = 0;
    for (const word of words) {
        const vowelCount = (word.match(VOWELS) || []).length;
        if (vowelCount / word.length < 0.15)
            garbledCount++;
    }
    return garbledCount / words.length > 0.4;
}
function checkGibberish(report) {
    const flags = [];
    const fieldsToCheck = [
        { path: 'header.verdict', text: report.header.verdict },
        { path: 'reality_check.root_cause', text: report.reality_check.root_cause },
        { path: 'bottom_line.verdict', text: report.bottom_line.verdict },
        { path: 'bottom_line.verdict_detail', text: report.bottom_line.verdict_detail },
        { path: 'market.real_number_analysis', text: report.market.real_number_analysis },
        { path: 'sales_model.diagnosis', text: report.sales_model.diagnosis },
    ];
    for (const comp of report.reality_check.comparisons) {
        fieldsToCheck.push({ path: `reality_check.research_shows(${comp.question_ref})`, text: comp.research_shows });
    }
    for (const dim of report.scorecard.dimensions) {
        fieldsToCheck.push({ path: `scorecard.${dim.name}.evidence`, text: dim.evidence });
    }
    for (const rec of report.recommendations) {
        fieldsToCheck.push({ path: `recommendation.${rec.rank}.evidence`, text: rec.evidence });
    }
    for (const item of report.bottom_line.not_working) {
        fieldsToCheck.push({ path: 'bottom_line.not_working', text: item });
    }
    for (const { path, text } of fieldsToCheck) {
        if (isGibberish(text)) {
            flags.push({
                check: 'gibberish_detection',
                field: path,
                expected: 'Readable English text',
                found: `Garbled text: "${text.slice(0, 80)}..."`,
                severity: 'error',
            });
        }
    }
    return flags;
}
// ============================================================================
// Check 6 -- Banned word detection and replacement (HVAL-06)
// ============================================================================
const BANNED_WORD_MAP = {
    'revolutionary': 'notable',
    'game-changing': 'significant',
    'game-changer': 'significant development',
    'synergy': 'alignment',
    'disruptive': 'differentiated',
    'paradigm shift': 'major change',
    'best-in-class': 'strong',
    'cutting-edge': 'modern',
    'world-class': 'high-quality',
    'groundbreaking': 'notable',
    'unprecedented': 'unusual',
    'leverage': 'use',
    'holistic': 'comprehensive',
    'ecosystem': 'market',
    'streamline': 'simplify',
    'navigate': 'address',
    'landscape': 'competitive set',
    'empower': 'enable',
    'robust': 'strong',
    'scalable': 'growth-ready',
    'innovative': 'differentiated',
};
function checkAndReplaceBannedWords(report) {
    const flags = [];
    let reportStr = JSON.stringify(report);
    for (const [banned, replacement] of Object.entries(BANNED_WORD_MAP)) {
        const regex = new RegExp(banned, 'gi');
        const matches = reportStr.match(regex);
        if (matches) {
            for (const match of matches) {
                flags.push({
                    check: 'banned_words',
                    field: 'report_text',
                    expected: `"${replacement}" (neutral alternative)`,
                    found: `"${match}" (banned word)`,
                    severity: 'warning',
                });
            }
            reportStr = reportStr.replace(regex, replacement);
        }
    }
    return {
        flags,
        cleaned: flags.length > 0 ? JSON.parse(reportStr) : report,
    };
}
// ============================================================================
// Orchestration -- validateReport (HVAL-06)
// ============================================================================
function runAllChecks(report, research, scores, founderAnswers) {
    const gibberishFlags = checkGibberish(report);
    if (gibberishFlags.length > 0) {
        return {
            allFlags: gibberishFlags,
            fixedReport: report,
            errorCount: gibberishFlags.length,
        };
    }
    const numberFlags = checkNumbers(report, research, scores, founderAnswers);
    const companyFlags = checkCompanyNames(report, research);
    const consistencyFlags = checkScoreTextConsistency(report, scores);
    const verdictFlags = checkVerdictLength(report);
    const { flags: bannedFlags, cleaned } = checkAndReplaceBannedWords(report);
    let fixedReport = cleaned;
    if (verdictFlags.length > 0) {
        fixedReport = truncateVerdicts(fixedReport);
    }
    const allFlags = [
        ...numberFlags,
        ...companyFlags,
        ...consistencyFlags,
        ...verdictFlags,
        ...bannedFlags,
    ];
    const errorCount = allFlags.filter((f) => f.severity === 'error').length;
    return { allFlags, fixedReport, errorCount };
}
async function validateReport(params) {
    const maxRetries = params.maxRetries ?? 2;
    // First pass
    let { allFlags, fixedReport, errorCount } = runAllChecks(params.report, params.research, params.scores, params.founderAnswers);
    if (errorCount <= 3) {
        return { report: fixedReport, flags: allFlags, needsReview: false, attempts: 1 };
    }
    // Track best attempt
    let bestReport = fixedReport;
    let bestFlags = allFlags;
    let bestErrorCount = errorCount;
    // Retry loop
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.warn(`[hallucination] Retry ${attempt}/${maxRetries} -- ${errorCount} error flags exceed threshold of 3`);
        const errorFlagDescriptions = allFlags
            .filter((f) => f.severity === 'error')
            .map((f) => `[${f.check}] ${f.field}: expected ${f.expected}, found ${f.found}`);
        const newReport = await (0, report_service_1.generateReportWithCorrections)({
            assessmentId: params.assessmentId,
            founderAnswers: params.founderAnswers,
            research: params.research,
            scores: params.scores,
            classificationData: params.classificationData,
        }, errorFlagDescriptions);
        const result = runAllChecks(newReport, params.research, params.scores, params.founderAnswers);
        allFlags = result.allFlags;
        fixedReport = result.fixedReport;
        errorCount = result.errorCount;
        if (errorCount < bestErrorCount) {
            bestReport = fixedReport;
            bestFlags = allFlags;
            bestErrorCount = errorCount;
        }
        if (errorCount <= 3) {
            return { report: fixedReport, flags: allFlags, needsReview: false, attempts: attempt + 1 };
        }
    }
    console.warn(`[hallucination] All ${maxRetries} retries exhausted. Using best attempt with ${bestErrorCount} error flags. Flagging needsReview.`);
    return {
        report: bestReport,
        flags: bestFlags,
        needsReview: true,
        attempts: maxRetries + 1,
    };
}
