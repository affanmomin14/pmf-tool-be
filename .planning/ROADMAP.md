# Roadmap: PMF Insights Tool Backend

## Overview

This roadmap delivers a production-ready backend that powers a 5-question PMF diagnostic for founders. The journey starts with database schema and infrastructure, builds up system content and assessment CRUD, then tackles the AI pipeline in stages (classification, research, scoring, report generation, validation), wires the pipeline together with orchestration, adds the business model layer (report access, email gate), and finishes with PDF generation and email delivery. Each phase delivers a complete, testable capability that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Middleware** - Database schema, env validation, error handling, utilities, and request middleware
- [ ] **Phase 2: System Content & Seed Data** - Read-only content API and seed data for questions, categories, facts, social proof, micro-insights
- [ ] **Phase 3: Assessment Flow** - Assessment session CRUD with response storage, session restore, and status lifecycle
- [ ] **Phase 4: AI Infrastructure & Classification** - Centralized OpenAI client, GPT-4o classification with structured output, cost tracking
- [ ] **Phase 5: Research Pipeline** - OpenAI web search for competitors, market data, complaints, patterns with 7-day category cache
- [ ] **Phase 6: Scoring Engine** - 7-dimension deterministic scoring algorithm in pure TypeScript with weighted PMF score
- [ ] **Phase 7: Report Generation & Validation** - GPT-4o 9-section structured report with hallucination validation gate
- [ ] **Phase 8: Pipeline Orchestration & Report Access** - End-to-end pipeline under 15s, report token system, email gate, lead capture
- [ ] **Phase 9: PDF Generation & Email Delivery** - Puppeteer PDF, Resend email with attachment, analytics events

## Phase Details

### Phase 1: Foundation & Middleware
**Goal**: The server boots with a validated environment, connects to a fully-schemaed database, and handles all requests through structured error handling and validation middleware
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, MIDW-01, MIDW-03, MIDW-04
**Success Criteria** (what must be TRUE):
  1. Server starts and validates all required environment variables, failing fast with clear messages on missing config
  2. Prisma schema defines all tables across 3 domains (assessment pipeline, system config, analytics/audit) and migrations run cleanly
  3. Invalid API requests return structured JSON error responses with appropriate HTTP status codes, never stack traces
  4. Request logging captures every HTTP call with unique request IDs via Pino
  5. Utility functions exist for nanoid token generation, input sanitization (HTML strip + 500-char truncation), and SHA-256 IP hashing
**Plans**: 3 plans

Plans:
- [x] 01-01: Prisma schema and database migrations
- [x] 01-02: Environment validation, client singletons, and utility functions
- [ ] 01-03: Middleware stack (error handler, Zod validation factory, request logger)

### Phase 2: System Content & Seed Data
**Goal**: The frontend can fetch all system content (questions, categories, facts, social proof, micro-insights) from live API endpoints backed by seeded database data
**Depends on**: Phase 1
**Requirements**: SYS-01, SYS-02, SYS-03, SYS-04, SYS-05, SYS-06
**Success Criteria** (what must be TRUE):
  1. GET /api/system/questions returns 5 active questions in display order with type, placeholder, and options
  2. GET /api/system/categories returns active problem categories with usage counts
  3. GET /api/system/facts, /social-proof, and /micro-insights endpoints return seeded content filtered by location and question
  4. Seed script populates all system tables (5 categories, 5 questions, 15+ micro-insights, 6 facts, 6 testimonials) and is idempotent
**Plans**: TBD

Plans:
- [ ] 02-01: System content service and API endpoints
- [ ] 02-02: Seed data script with all system tables populated

### Phase 3: Assessment Flow
**Goal**: A founder can start an assessment, submit responses to each question, restore a session, and receive micro-insights -- establishing the session model the AI pipeline operates on
**Depends on**: Phase 2
**Requirements**: ASSMT-01, ASSMT-02, ASSMT-03, ASSMT-04, ASSMT-05, ASSMT-06
**Success Criteria** (what must be TRUE):
  1. POST /api/assessments creates a new assessment with problem type, UTM tracking, hashed IP, and status "started"
  2. POST /api/assessments/:id/responses stores a response and returns a matching micro-insight
  3. GET /api/assessments/:id returns the assessment with all responses for session restore
  4. Assessment status transitions correctly through lifecycle: started -> in_progress -> completed -> report_generated -> unlocked
  5. Creating an assessment atomically increments the selected problem category's usage count
**Plans**: TBD

Plans:
- [ ] 03-01: Assessment CRUD service and endpoints
- [ ] 03-02: Response storage with micro-insight matching and status lifecycle

### Phase 4: AI Infrastructure & Classification
**Goal**: The centralized OpenAI client is operational with retry, cost tracking, and daily spend limits, and GPT-4o can classify founder answers into product category, sub-category, search queries, and confidence scores
**Depends on**: Phase 3
**Requirements**: AICL-01, AICL-02, AICL-03, AICL-04, AICL-05
**Success Criteria** (what must be TRUE):
  1. POST /api/assessments/:id/complete triggers classification that extracts product category, sub-category, confidence levels, search queries, likely competitors, ICP details, and product signals
  2. Classification uses GPT-4o with JSON mode, temperature 0.2, chain-of-thought reasoning, and 3 few-shot examples
  3. Classification output is validated with a Zod schema and returns a structured error for garbage/empty input
  4. Every LLM call is logged with model, token counts, cost, and latency; call is wrapped with a 10-second timeout
  5. OpenAI client enforces daily spend limits and uses exponential backoff on failures
**Plans**: TBD

Plans:
- [ ] 04-01: Centralized OpenAI client wrapper with retry, backoff, cost tracking, and spend limits
- [ ] 04-02: Classification service with prompt engineering, Zod validation, and LLM logging

### Phase 5: Research Pipeline
**Goal**: Given a classified category, the system finds real competitors, market size data, category complaints, and sales patterns via OpenAI web search, with 7-day caching to control cost and latency
**Depends on**: Phase 4
**Requirements**: RES-01, RES-02, RES-03, RES-04, RES-05, RES-06
**Success Criteria** (what must be TRUE):
  1. Research service returns competitors with name, G2 rating, review count, funding, pricing model, free tier, and tagline
  2. Research service returns market size data (TAM, SAM, growth rate, regional splits) and category complaints (top 4-6 themes with approximate percentages)
  3. Research service returns category patterns (top 3 companies' sales models, positioning language, gaps)
  4. Research results are cached in the database keyed by category + sub_category with 7-day TTL; cache hits skip API calls entirely
  5. When research is thin (<3 competitors or no market data), a research_quality: "limited" flag is set and no data is fabricated
**Plans**: TBD

Plans:
- [ ] 05-01: Research service with OpenAI web search queries (competitors, market, complaints, patterns)
- [ ] 05-02: Research cache layer with 7-day TTL and thin-data handling

### Phase 6: Scoring Engine
**Goal**: Given classification and research data, the system computes a deterministic 7-dimension PMF score entirely in TypeScript code, with no LLM involvement in scoring decisions
**Depends on**: Phase 4
**Requirements**: SCOR-01, SCOR-02, SCOR-03, SCOR-04, SCOR-05, SCOR-06
**Success Criteria** (what must be TRUE):
  1. Each of 7 dimensions (Demand, ICP Focus, Differentiation, Distribution Fit, Problem Severity, Competitive Position, Trust & Proof) is scored 1-10 using exact rules from the AI-LLM PRD
  2. Final PMF score = round(weighted sum x 10), range 0-100, with correct weights per dimension
  3. PMF stage is derived from score: 0-35 pre_pmf, 36-60 approaching, 61-80 early_pmf, 81-100 strong
  4. Primary break is identified as the lowest scoring dimension, with Q4 cross-reference flagging
  5. Benchmark defaults to 70 and uses category average from past assessments when available
**Plans**: TBD

Plans:
- [ ] 06-01: Dimension scoring functions with exact PRD rules and weights
- [ ] 06-02: PMF score calculation, stage derivation, primary break, and benchmarking

### Phase 7: Report Generation & Validation
**Goal**: GPT-4o generates a 9-section structured JSON report anchored to research data and pre-computed scores, and a hallucination validation gate ensures no fabricated data reaches users
**Depends on**: Phase 5, Phase 6
**Requirements**: RGEN-01, RGEN-02, RGEN-03, RGEN-04, RGEN-05, HVAL-01, HVAL-02, HVAL-03, HVAL-04, HVAL-05, HVAL-06
**Success Criteria** (what must be TRUE):
  1. Report generation receives founder answers, research findings, and pre-computed scores as immutable inputs and produces a 9-section JSON matching the exact PRD schema
  2. Report prompt enforces data anchoring (statistics from research only), score injection constraints, tone, banned words, and length limits
  3. Report output is validated with Zod checking both structure and content (verdict is single sentence, 5 recommendations, 7 scorecard dimensions, scores match input)
  4. Hallucination checks verify numbers against research, company names against competitor list, score-text consistency, verdict length, and banned words
  5. If validation finds >3 flags, the report is regenerated with a correction prompt (max 2 retries); after that the best attempt is used and flagged for review
**Plans**: TBD

Plans:
- [ ] 07-01: Report generation service with 9-section prompt engineering and Zod validation
- [ ] 07-02: Hallucination validation service with 5 checks and retry logic

### Phase 8: Pipeline Orchestration & Report Access
**Goal**: The complete AI pipeline runs end-to-end in under 15 seconds, stores reports with token-based access, gates full reports behind email capture, and handles rate limiting
**Depends on**: Phase 7
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, RPT-01, RPT-02, RPT-03, RPT-04, LEAD-01, LEAD-02, LEAD-03
**Success Criteria** (what must be TRUE):
  1. POST /api/assessments/:id/complete runs the full pipeline (classify -> research -> score -> generate -> validate) and returns { reportToken, previewContent, pmfScore, pmfStage }
  2. Full pipeline completes in under 15 seconds with maximum parallelism where data dependencies allow
  3. GET /api/reports/:token returns full report if unlocked, preview-only with blurred placeholder if locked, and checks 90-day expiry
  4. POST /api/leads accepts email with MX validation, creates lead, marks assessment unlocked, and returns { leadId, isUnlocked, reportToken }
  5. Rate limiting is enforced per-endpoint with IP-based limits using hashed IPs
**Plans**: TBD

Plans:
- [ ] 08-01: Pipeline orchestrator with parallelism and report storage
- [ ] 08-02: Report access endpoints (token lookup, preview vs full, expiry)
- [ ] 08-03: Email gate, lead capture, and rate limiting

### Phase 9: PDF Generation & Email Delivery
**Goal**: Users receive a consulting-quality PDF report via email after unlocking, with analytics tracking across the entire application
**Depends on**: Phase 8
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, EMAIL-01, EMAIL-02, EMAIL-03
**Success Criteria** (what must be TRUE):
  1. PDF service generates a consulting-quality PDF with cover page, sections with severity badges, data tables, and branded footer
  2. PDF uses a shared Puppeteer browser instance (singleton) to manage memory, with proper cleanup
  3. POST /api/reports/:token/email sends a report delivery email via Resend with HTML summary, link to full report, and PDF attachment
  4. PDF file is named PMF-Insight-Report-[YYYY-MM-DD].pdf
**Plans**: TBD

Plans:
- [ ] 09-01: Puppeteer PDF generation with HTML template and singleton browser
- [ ] 09-02: Resend email delivery with PDF attachment
- [ ] 09-03: Analytics event tracking (fire-and-forget storage, batch endpoint)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9
Note: Phases 5 and 6 can execute in parallel (both depend on Phase 4, neither depends on the other).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Middleware | 2/3 | In progress | - |
| 2. System Content & Seed Data | 0/2 | Not started | - |
| 3. Assessment Flow | 0/2 | Not started | - |
| 4. AI Infrastructure & Classification | 0/2 | Not started | - |
| 5. Research Pipeline | 0/2 | Not started | - |
| 6. Scoring Engine | 0/2 | Not started | - |
| 7. Report Generation & Validation | 0/2 | Not started | - |
| 8. Pipeline Orchestration & Report Access | 0/3 | Not started | - |
| 9. PDF Generation & Email Delivery | 0/3 | Not started | - |
