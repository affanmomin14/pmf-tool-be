# Requirements: PMF Insights Tool Backend

**Defined:** 2026-03-02
**Core Value:** Founders answer 5 questions and receive a data-backed, AI-generated PMF diagnostic report in under 15 seconds

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [x] **FOUND-01**: Prisma schema covers all 3 data domains (assessment pipeline, system config, analytics/audit) with proper indexes, enums, cascading deletes, and UUID primary keys on app tables
- [x] **FOUND-02**: Environment variables validated with Zod on startup (DATABASE_URL, OPENAI_API_KEY, PORT, CORS_ORIGINS, etc.)
- [x] **FOUND-03**: OpenAI client singleton configured with model, max tokens, and API key from env
- [x] **FOUND-04**: Prisma client singleton with connection pooling and graceful shutdown
- [x] **FOUND-05**: Custom error classes (AppError, NotFoundError, ValidationError, RateLimitError, AIError) with HTTP status codes
- [x] **FOUND-06**: Token generation utility using nanoid (21 chars, URL-safe)
- [x] **FOUND-07**: Input sanitization utility (HTML stripping, 500-char length truncation)
- [x] **FOUND-08**: IP hashing utility using SHA-256 (never store raw IPs)

### Middleware

- [x] **MIDW-01**: Global error handler returns structured JSON errors, never stack traces in production
- [x] **MIDW-03**: Zod validation middleware factory for request body/params/query validation
- [x] **MIDW-04**: Pino HTTP request logger with request ID tracking

### System Content

- [x] **SYS-01**: GET /api/system/questions returns active questions in display order with type, placeholder, and options
- [x] **SYS-02**: GET /api/system/categories returns active problem categories with usage counts and display order
- [x] **SYS-03**: GET /api/system/facts?location= returns active PMF facts filtered by display location
- [x] **SYS-04**: GET /api/system/social-proof returns active social proof items in display order
- [x] **SYS-05**: GET /api/system/micro-insights/:questionId returns insights for a specific question
- [x] **SYS-06**: Seed data populates all system tables (5 categories, 5 questions, 15+ micro-insights, 6 facts, 6 testimonials)

### Assessment Flow

- [x] **ASSMT-01**: POST /api/assessments creates assessment with problem type, UTM tracking, hashed IP, and status "started"
- [x] **ASSMT-02**: POST /api/assessments creates atomically increments the selected problem category's usage count
- [x] **ASSMT-03**: GET /api/assessments/:id returns assessment with all responses for session restore
- [x] **ASSMT-04**: POST /api/assessments/:id/responses stores individual response with questionId, answer text, answer value, time spent, and question order
- [x] **ASSMT-05**: POST /api/assessments/:id/responses returns a matching micro-insight (text + source) from system content
- [x] **ASSMT-06**: Assessment status transitions through lifecycle: started -> in_progress -> completed -> report_generated -> unlocked

### AI Classification

- [x] **AICL-01**: POST /api/assessments/:id/complete triggers Prompt 1 (Parse & Classify) using GPT-4o with JSON mode, temperature 0.2
- [x] **AICL-02**: Classification extracts: product category, sub-category, confidence levels, search queries, likely competitors, problem type, ICP specificity (1-5), ICP details, product signals
- [x] **AICL-03**: Classification prompt includes chain-of-thought reasoning, few-shot examples (3 cases), and defensive guardrails for garbage input
- [x] **AICL-04**: Classification output validated with Zod schema; returns error object if Q1 is empty/nonsensical
- [x] **AICL-05**: Classification call wrapped with 10-second timeout, logged to AI logs with tokens and cost

### Research Pipeline

- [ ] **RES-01**: Research service uses OpenAI web search to find competitors (name, G2 rating, review count, funding, pricing model, free tier, tagline) for classified category
- [ ] **RES-02**: Research service finds market size data (TAM, SAM, growth rate/CAGR, regional splits)
- [ ] **RES-03**: Research service finds category complaints (top 4-6 complaint themes with approximate % mentions)
- [ ] **RES-04**: Research service finds category patterns (top 3 companies' sales models, positioning language, gaps)
- [ ] **RES-05**: Research results cached in research_cache table keyed by category + sub_category with 7-day TTL; cache hit skips API calls entirely
- [ ] **RES-06**: When research is thin (<3 competitors or no market data), set research_quality: "limited" flag and never fabricate data

### Scoring

- [ ] **SCOR-01**: 7-dimension scoring algorithm implemented as pure functions in TypeScript (no LLM involvement)
- [ ] **SCOR-02**: Each dimension scored 1-10 using exact rules from AI-LLM PRD: Demand (0.18), ICP Focus (0.15), Differentiation (0.15), Distribution Fit (0.16), Problem Severity (0.14), Competitive Position (0.14), Trust & Proof (0.08)
- [ ] **SCOR-03**: Final PMF score = round(weighted sum x 10), range 0-100
- [ ] **SCOR-04**: PMF stage derived from score: 0-35 pre_pmf, 36-60 approaching, 61-80 early_pmf, 81-100 strong
- [ ] **SCOR-05**: Primary break = lowest scoring dimension; if Q4 maps to different dimension, flag both
- [ ] **SCOR-06**: Benchmark defaults to 70; uses category average from past assessments if available

### Report Generation

- [ ] **RGEN-01**: POST /api/assessments/:id/complete triggers Prompt 2 (Generate Report) using GPT-4o with JSON mode, temperature 0.35, max_tokens 6000
- [ ] **RGEN-02**: Report prompt receives founder_answers + research_findings + pre-computed scores as immutable inputs
- [ ] **RGEN-03**: Report output is a 9-section structured JSON matching exact schema from AI-LLM PRD (header, reality_check, scorecard, market, sales_model, competitors, positioning, bottom_line, recommendations, sources)
- [ ] **RGEN-04**: Report prompt includes explicit data anchoring ("every statistic MUST come from research_findings"), score injection constraints, section-by-section reasoning, tone enforcement, banned words list, and length constraints
- [ ] **RGEN-05**: Report output validated with Zod schema checking structure AND content (verdict is single sentence, 5 recommendations, 7 scorecard dimensions, scores match input)

### Hallucination Validation

- [ ] **HVAL-01**: Extract all numbers from report text and verify against research_findings and founder_answers; flag unmatched numbers (allowlist: dimension scores and PMF score)
- [ ] **HVAL-02**: Extract company names from report and verify against research_findings.competitors list; flag unknown companies
- [ ] **HVAL-03**: Check score-text consistency (text says "strong" for score <=3 or "weak" for score >=8 = contradiction)
- [ ] **HVAL-04**: Verify verdict is single sentence; truncate if multi-sentence
- [ ] **HVAL-05**: Run banned word regex against all text fields; auto-replace with neutral alternatives
- [ ] **HVAL-06**: If >3 flags, regenerate report with correction prompt; max 2 retries; after that use best attempt and flag for review

### Pipeline Orchestration

- [ ] **PIPE-01**: Full pipeline (classify -> research -> score -> generate -> validate) completes in under 15 seconds
- [ ] **PIPE-02**: Classification and research run with maximum parallelism where data dependencies allow
- [ ] **PIPE-03**: Pipeline stores report with: full JSON content, 7-dimension scores, preview content (2-3 insights), intermediate artifacts, PDF URL placeholder, PMF score, PMF stage, primary break, AI metadata (model, tokens, cost, latency), unique URL token, 90-day expiry
- [ ] **PIPE-04**: POST /api/assessments/:id/complete returns { reportToken, previewContent, pmfScore, pmfStage }

### Report Access

- [ ] **RPT-01**: GET /api/reports/:token returns full report if lead.isUnlocked = true
- [ ] **RPT-02**: GET /api/reports/:token returns previewContent only + blurred placeholder if not unlocked
- [ ] **RPT-03**: GET /api/reports/:token checks 90-day expiry and returns isExpired flag
- [ ] **RPT-04**: Report tokens are nanoid (21 chars, URL-safe), unique indexed

### Email Gate & Lead

- [ ] **LEAD-01**: POST /api/leads accepts { assessmentId, email }, validates email with Zod + MX record check
- [ ] **LEAD-02**: POST /api/leads creates lead record, marks assessment as "unlocked", returns { leadId, isUnlocked: true, reportToken }
- [ ] **LEAD-03**: Lead email is indexed for lookups; UTM attribution stored on lead separately from assessment

### PDF Generation

- [ ] **PDF-01**: PDF service generates consulting-quality PDF from report data using Puppeteer
- [ ] **PDF-02**: PDF template includes cover page, sections with severity badges, data tables, footer with branding
- [ ] **PDF-03**: PDF file named PMF-Insight-Report-[YYYY-MM-DD].pdf
- [ ] **PDF-04**: Puppeteer uses shared browser instance (singleton) to manage memory (~300MB per Chromium)

### Email Delivery

- [ ] **EMAIL-01**: POST /api/reports/:token/email sends report delivery email via Resend
- [ ] **EMAIL-02**: Email subject "Your PMF Insights Report is Ready", HTML body with report summary + link to full report
- [ ] **EMAIL-03**: Email attaches PDF if available

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Research

- **ERES-01**: URL scraping for founder's website (homepage text, pricing page)
- **ERES-02**: Category benchmarking from historical assessment data
- **ERES-03**: A/B testing framework for question wording

### Integrations

- **INTG-01**: Webhook/CRM integration for lead push (HubSpot, Salesforce)
- **INTG-02**: CSV export of leads from database

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / authentication | Anonymous assessments only -- zero friction. Token-based report access sufficient. |
| Admin panel | Content changes via DB seeds. Monthly at most -- doesn't justify building a UI. |
| Real-time WebSocket updates | Pipeline is <15s. FE shows fake progress on timers during single HTTP request. |
| Multi-language support | English-speaking founder market is large enough for v1. |
| Payment processing | Free lead-gen tool with consulting CTA. Payments change the value proposition. |
| White-label / multi-tenant | Completely different product. Defer until agency demand emerges. |
| Historical trend tracking | Each assessment is standalone. Requires user accounts for comparison. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 1 | Complete |
| FOUND-07 | Phase 1 | Complete |
| FOUND-08 | Phase 1 | Complete |
| MIDW-01 | Phase 1 | Complete |
| MIDW-03 | Phase 1 | Complete |
| MIDW-04 | Phase 1 | Complete |
| SYS-01 | Phase 2 | Complete |
| SYS-02 | Phase 2 | Complete |
| SYS-03 | Phase 2 | Complete |
| SYS-04 | Phase 2 | Complete |
| SYS-05 | Phase 2 | Complete |
| SYS-06 | Phase 2 | Complete |
| ASSMT-01 | Phase 3 | Complete |
| ASSMT-02 | Phase 3 | Complete |
| ASSMT-03 | Phase 3 | Complete |
| ASSMT-04 | Phase 3 | Complete |
| ASSMT-05 | Phase 3 | Complete |
| ASSMT-06 | Phase 3 | Complete |
| AICL-01 | Phase 4 | Complete |
| AICL-02 | Phase 4 | Complete |
| AICL-03 | Phase 4 | Complete |
| AICL-04 | Phase 4 | Complete |
| AICL-05 | Phase 4 | Complete |
| RES-01 | Phase 5 | Pending |
| RES-02 | Phase 5 | Pending |
| RES-03 | Phase 5 | Pending |
| RES-04 | Phase 5 | Pending |
| RES-05 | Phase 5 | Pending |
| RES-06 | Phase 5 | Pending |
| SCOR-01 | Phase 6 | Pending |
| SCOR-02 | Phase 6 | Pending |
| SCOR-03 | Phase 6 | Pending |
| SCOR-04 | Phase 6 | Pending |
| SCOR-05 | Phase 6 | Pending |
| SCOR-06 | Phase 6 | Pending |
| RGEN-01 | Phase 7 | Pending |
| RGEN-02 | Phase 7 | Pending |
| RGEN-03 | Phase 7 | Pending |
| RGEN-04 | Phase 7 | Pending |
| RGEN-05 | Phase 7 | Pending |
| HVAL-01 | Phase 7 | Pending |
| HVAL-02 | Phase 7 | Pending |
| HVAL-03 | Phase 7 | Pending |
| HVAL-04 | Phase 7 | Pending |
| HVAL-05 | Phase 7 | Pending |
| HVAL-06 | Phase 7 | Pending |
| PIPE-01 | Phase 8 | Pending |
| PIPE-02 | Phase 8 | Pending |
| PIPE-03 | Phase 8 | Pending |
| PIPE-04 | Phase 8 | Pending |
| RPT-01 | Phase 8 | Pending |
| RPT-02 | Phase 8 | Pending |
| RPT-03 | Phase 8 | Pending |
| RPT-04 | Phase 8 | Pending |
| LEAD-01 | Phase 8 | Pending |
| LEAD-02 | Phase 8 | Pending |
| LEAD-03 | Phase 8 | Pending |
| PDF-01 | Phase 9 | Pending |
| PDF-02 | Phase 9 | Pending |
| PDF-03 | Phase 9 | Pending |
| PDF-04 | Phase 9 | Pending |
| EMAIL-01 | Phase 9 | Pending |
| EMAIL-02 | Phase 9 | Pending |
| EMAIL-03 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 69 total
- Mapped to phases: 69
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation*
