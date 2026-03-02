# Feature Research

**Domain:** AI-powered PMF diagnostic/assessment tool backend
**Researched:** 2026-03-02
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Assessment session creation and persistence | Users expect to resume if they refresh or navigate away mid-assessment. Every quiz/assessment tool (Interact, involve.me, Marquiz) does this. | LOW | Create session on first interaction, store responses incrementally, restore via session ID in URL or cookie. Use UUID session IDs. |
| Question retrieval from system config | Questions must come from the backend, not hardcoded in the frontend. Enables A/B testing questions and updating without FE deploys. | LOW | `system_questions` table with ordering, type, placeholder text, options. FE fetches on load. |
| AI classification of founder answers | The core value proposition starts here. Without structured classification, no scoring or research is possible. Every AI assessment tool has a "parse input" step before analysis. | MEDIUM | GPT-4o structured output with JSON mode. Parse product category, sub-category, ICP details, problem type, search queries, likely competitors. Zod validation on output. |
| Research pipeline (competitors + market data) | Reports without real data are worthless. Users will immediately distrust generic output. Competitor tools like PMFsurvey and SatisMeter at least reference benchmarks. This tool promises data-backed insights. | HIGH | OpenAI web search for competitors, market size, category complaints, category patterns. Multiple parallel search calls. Cache results by category+sub_category with 7-day TTL. |
| 7-dimension scoring algorithm | The PMF score IS the product. Without deterministic scoring, the entire report loses credibility. Scoring in code (not LLM) is a critical design decision already made. | MEDIUM | Pure TypeScript function. Inputs: classified answers + research data. Outputs: 7 dimension scores + weighted total + PMF stage + primary break. Fully unit-testable. |
| AI report generation (9-section structured JSON) | The report is what users came for. Must match exact JSON schema the FE expects. This is the money feature. | HIGH | GPT-4o with structured output. 9 sections matching the AI-LLM PRD schema exactly. Feed it founder answers, research findings, and pre-computed scores. LLM writes narrative around fixed scores. |
| Hallucination validation | Users (founders) will fact-check claims about their market. A single invented statistic destroys all trust. Every serious AI pipeline needs output validation. | MEDIUM | Post-generation checks: extract numbers and verify against research input, extract company names and verify against competitor list, check score-text consistency, check verdict length, run banned word regex. Auto-retry up to 2x if >3 flags. |
| Report token system (shareable URLs) | Users need to access their report later and share it. Every report/assessment tool provides a unique URL. | LOW | Generate nanoid-based token on report creation. 90-day expiry. Token resolves to full report. No auth required -- anonymous access by design. |
| Email gate (preview vs full access) | This is the business model. Preview shows 2-3 insights + blurred full report. Email unlocks everything. involve.me, Interact, and every lead-gen quiz tool gates results behind email. | MEDIUM | Preview endpoint returns partial report (header + reality_check only). Full endpoint requires email association. MX validation on email to reduce garbage submissions. Store lead with report association. |
| Rate limiting | Without it, a single bad actor or bot can burn through the entire OpenAI budget in minutes. Table stakes for any API with expensive downstream calls. | LOW | Per-endpoint IP-based limits. Aggressive on AI pipeline endpoints (e.g., 5/hour per IP). Lenient on read endpoints (e.g., 100/min). IP addresses SHA-256 hashed before any storage. |
| Analytics event tracking | Cannot improve what you cannot measure. Funnel analytics (drop-off per question, time per step, conversion at email gate) are essential for a lead-gen tool. | LOW | Fire-and-forget event storage. Event types: page_view, tool_started, question_answered, loading_started, report_preview_viewed, email_submitted, report_unlocked, pdf_downloaded, cta_clicked. Batch endpoint for FE to send multiple events at once. |
| System content API (questions, categories, facts, social proof, micro-insights) | FE needs dynamic content from backend. Categories with usage counts, rotating facts during loading, micro-insights after each answer. All defined in PRD. | LOW | Read-only endpoints serving from `system_*` tables. Seed data from PRD constants. No admin UI -- managed via DB seeds. |
| Error handling and structured error responses | FE needs consistent error format to display meaningful messages. Broken error handling = broken UX. | LOW | Consistent JSON error shape: `{ error: string, code: string, details?: any }`. Express 5 async error handling. Zod validation errors formatted consistently. |
| Request validation (Zod) | Garbage in = garbage out. Every endpoint must validate inputs before hitting expensive AI calls. | LOW | Zod schemas for all request bodies. Validate early, fail fast. Already in dependencies. |
| LLM call logging with token counts and cost | Cost control is a hard constraint. Without logging, you cannot monitor spend or detect runaway costs. | LOW | Log every OpenAI call: model, prompt tokens, completion tokens, calculated cost, latency_ms, endpoint that triggered it. Daily spend limit configurable via env var. |

### Differentiators (Competitive Advantage)

Features that set this product apart from existing PMF tools and generic assessment platforms.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Real competitor and market research (not just survey benchmarks) | Existing PMF tools (PMFsurvey, SatisMeter, Pendo PMF) ask the Sean Ellis question and give a percentage. This tool runs actual market research -- finding real competitors, real G2 ratings, real market sizes, real complaint data. That is a fundamentally different value proposition. | HIGH | This is the hardest and most valuable part of the pipeline. OpenAI web search for 4 research dimensions: competitors, market size, category complaints, category patterns. Parallel execution where possible. |
| Research caching by category | Prevents redundant expensive API calls. Also enables future analytics on category distribution. Most assessment tools do not need this because they do not do real-time research. | MEDIUM | Cache key: `category + sub_category`. TTL: 7 days. On cache hit, skip research entirely. Saves 5-10 seconds of pipeline time and significant API cost. |
| Consulting-quality PDF export | Most free tools give a web page. A downloadable PDF that looks like it came from McKinsey creates a "wow" moment and gets shared with co-founders and investors. PDF as a deliverable elevates perceived value. | HIGH | Puppeteer HTML-to-PDF. Custom consulting template with branded header, charts rendered as static images, proper typography. Not a raw HTML dump -- actual designed document. |
| Email delivery with PDF attachment | Report arrives in inbox with the PDF attached. Creates a touchpoint, enables re-engagement, and the PDF lives beyond the 90-day token expiry. | MEDIUM | Resend integration. Triggered after email gate completion. Email contains: brief summary, link to web report, PDF attachment. Clean HTML email template. |
| Micro-insights between questions | After each answer, show a contextual data point. This keeps engagement high during the 5-question flow and demonstrates domain expertise before the report even generates. Most quiz tools show nothing between questions. | LOW | `system_micro_insights` table with question_id + pattern matching. FE fetches after each answer submission. Pre-seeded from PRD data. |
| Deterministic scoring with LLM narrative | Scores computed in code (deterministic, testable, no hallucination risk). LLM writes narrative AROUND pre-computed scores. This is architecturally unusual and superior -- most AI tools let the LLM decide everything, leading to inconsistent outputs. | MEDIUM | Clear separation: scoring service (pure functions) vs report generation service (LLM). LLM receives scores as immutable input. Hallucination check verifies LLM did not contradict scores. |
| Sub-15-second full pipeline | Classify + research + score + generate + validate in under 15 seconds. Users see a loading screen with rotating facts. Speed creates a "magic" feeling. Competing tools either take much longer or skip the research step entirely. | HIGH | Parallel execution: classify and research can overlap (classify first for category, then research uses that category). Pipeline orchestration with Promise.allSettled where possible. Streaming not needed -- batch response is fine at <15s. |
| Graceful degradation on thin research | When a niche category yields sparse data, the report says so honestly rather than hallucinating. This builds more trust than fake confidence. | LOW | Check research result counts. If <3 competitors or no market size: widen score ranges, shorten comparison sections, add "Limited competitive data" disclaimer. Never fill gaps with invented data. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but should be deliberately excluded from this product.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User accounts and authentication | "Let users save multiple assessments" | Adds massive complexity (auth, sessions, password reset, GDPR). This is a single-use diagnostic tool, not a SaaS platform. Anonymous access is a feature -- zero friction to start. | Token-based report access (nanoid URLs). No accounts needed. Users bookmark or receive email with link. |
| Admin panel for content management | "Let non-devs update questions and facts" | Premature optimization. Content changes rarely. Building an admin UI is weeks of work for something that happens monthly at most. | DB seed scripts. Update seeds, run migration. If content changes become frequent later, add admin panel in v2. |
| Real-time WebSocket updates during pipeline | "Show live progress as each AI step completes" | SSE/WebSocket adds infrastructure complexity (connection management, reconnection, state sync). The pipeline is <15 seconds. | Fake progress steps on FE during the single HTTP request. FE shows "Analyzing answers... Researching competitors... Computing scores..." on timers while the backend processes. |
| Multi-language support | "Reach international founders" | Translation of AI prompts, report templates, system content, and validation logic is a massive undertaking. English-speaking founder market is large enough for v1. | English only. Add i18n infrastructure later if international demand is validated. |
| Payment processing | "Charge for premium reports" | This tool is a top-of-funnel lead magnet for consulting engagements. Adding payments changes the entire value proposition and creates friction before the email gate. | Free tool with consulting CTA. The report creates the gap; the consulting call fills it. |
| Custom branding / white-label | "Let agencies use this for their clients" | Scope explosion. Multi-tenant architecture, custom domains, brand assets per tenant. Completely different product. | Single-brand tool. If agency demand emerges, that is a separate product decision. |
| Historical trend tracking | "Let founders re-take the assessment and see progress" | Requires user accounts, data association over time, comparison logic. The tool is designed for a single diagnostic moment, not ongoing monitoring. | Each assessment is standalone. If a founder retakes it, they get a new report. No comparison to previous runs. |
| URL scraping for founder's website | "Auto-analyze the founder's homepage for positioning" | Scraping is unreliable (SPAs, Cloudflare protection, dynamic content). Adds latency and failure modes to the pipeline. PRD mentions it as optional. | Skip in v1. Founder's Q1 answer provides their positioning language. If scraping is added later, make it a non-blocking enhancement that falls back gracefully. |
| Webhook/CRM integrations | "Push leads to HubSpot/Salesforce automatically" | Integration maintenance burden. Each CRM has different APIs, auth flows, field mappings. Not needed at launch scale. | CSV export of leads from DB. Add Zapier webhook or native CRM integration when lead volume justifies it. |
| A/B testing framework for questions | "Test different question wordings" | Premature optimization. Need baseline data first. A/B testing infrastructure (variant assignment, statistical significance tracking) is complex. | System content table supports versioning. Change questions via seed data. Analyze conversion manually until volume justifies automated A/B. |

## Feature Dependencies

```
[System Content Seeding]
    |
    +--requires--> [Prisma Schema (3 domains)]
    |
    +--enables--> [Question Retrieval API]
    |               +--enables--> [Assessment Session Creation]
    |                               +--enables--> [Response Storage]
    |                                               +--enables--> [AI Classification Pipeline]
    |                                                               +--enables--> [Research Pipeline]
    |                                                               |               +--enables--> [Research Caching]
    |                                                               +--enables--> [7-Dimension Scoring]
    |                                                               |
    |                                                               +--together--> [AI Report Generation]
    |                                                                               +--enables--> [Hallucination Validation]
    |                                                                               +--enables--> [Report Token System]
    |                                                                                               +--enables--> [Email Gate]
    |                                                                                               |               +--enables--> [Email Delivery + PDF]
    |                                                                                               +--enables--> [PDF Generation]

[Analytics Event Tracking] -- independent, can be built in parallel
[Rate Limiting] -- independent, applied as middleware
[LLM Cost Logging] -- independent, wraps OpenAI client
[Micro-Insights API] -- depends on [System Content Seeding] only
```

### Dependency Notes

- **AI Classification requires Response Storage:** Cannot classify without stored answers to classify.
- **Research Pipeline requires AI Classification:** Classification output (category, sub_category, search queries) feeds directly into research queries.
- **7-Dimension Scoring requires both Classification AND Research:** Scoring algorithm uses classified ICP data + research findings (CAGR, competitor count, funding totals).
- **Report Generation requires Scoring + Research + Classification:** All three feed into the report generation prompt as structured inputs.
- **Email Gate requires Report Token System:** Must have a token-based access system before you can gate part of it behind email.
- **PDF Generation and Email Delivery require completed Report:** Cannot generate PDF or send email without a finished, validated report.
- **Analytics, Rate Limiting, and LLM Logging are independent:** Can be built at any point, applied as middleware/wrappers.

## MVP Definition

### Launch With (v1)

Minimum viable product -- the complete pipeline from question to gated report.

- [x] Prisma schema (3 domains: assessment, system config, analytics) -- foundation for everything
- [x] System content seeding (questions, categories, facts, social proof, micro-insights) -- FE needs data
- [x] System content API (read-only endpoints) -- FE consumes on load
- [x] Assessment CRUD (create session, store responses, restore session) -- core flow
- [x] AI classification pipeline (GPT-4o parse + classify) -- pipeline step 1
- [x] Research pipeline with caching (competitors, market, complaints) -- pipeline step 2
- [x] 7-dimension scoring algorithm (pure code) -- pipeline step 3
- [x] AI report generation (9-section structured JSON) -- pipeline step 4
- [x] Hallucination validation (number, company, score-text, banned word checks) -- quality gate
- [x] Report token system (nanoid URLs, 90-day expiry, preview vs full) -- access layer
- [x] Email gate (lead capture, MX validation, report unlock) -- business model
- [x] Rate limiting (per-endpoint IP-based) -- protection
- [x] Analytics event tracking (fire-and-forget, batch endpoint) -- measurement
- [x] LLM call logging with cost tracking -- cost control
- [x] Request validation (Zod on all endpoints) -- data integrity

### Add After Validation (v1.x)

Features to add once the core pipeline is working and initial users are flowing through.

- [ ] PDF generation (Puppeteer HTML-to-PDF) -- add when email gate conversion proves users want the report enough to give their email. High complexity, defer until core works.
- [ ] Email delivery with PDF attachment (Resend) -- add alongside PDF generation. No point sending emails without the PDF.
- [ ] Micro-insights API (contextual data after each question) -- enhances engagement but not required for the core diagnostic. Can use FE-side hardcoded insights initially.
- [ ] Graceful degradation messaging for thin research -- add after seeing which categories produce sparse results in production.

### Future Consideration (v2+)

Features to defer until product-market fit for the tool itself is established.

- [ ] URL scraping for founder's website -- only if positioning analysis needs more signal than Q1 provides
- [ ] Webhook/CRM integration for leads -- only when lead volume justifies the integration effort
- [ ] Category benchmarking from historical assessments -- only when assessment volume provides statistically meaningful data
- [ ] A/B testing framework for questions -- only when conversion data warrants optimization

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Prisma schema (3 domains) | HIGH | LOW | P1 |
| System content seeding | HIGH | LOW | P1 |
| System content API | HIGH | LOW | P1 |
| Assessment CRUD | HIGH | LOW | P1 |
| AI classification pipeline | HIGH | MEDIUM | P1 |
| Research pipeline + caching | HIGH | HIGH | P1 |
| 7-dimension scoring | HIGH | MEDIUM | P1 |
| AI report generation | HIGH | HIGH | P1 |
| Hallucination validation | HIGH | MEDIUM | P1 |
| Report token system | HIGH | LOW | P1 |
| Email gate + MX validation | HIGH | MEDIUM | P1 |
| Rate limiting | MEDIUM | LOW | P1 |
| Analytics event tracking | MEDIUM | LOW | P1 |
| LLM cost logging | MEDIUM | LOW | P1 |
| Request validation (Zod) | MEDIUM | LOW | P1 |
| PDF generation (Puppeteer) | MEDIUM | HIGH | P2 |
| Email delivery (Resend) | MEDIUM | MEDIUM | P2 |
| Micro-insights API | LOW | LOW | P2 |
| Graceful degradation messaging | LOW | LOW | P2 |
| URL scraping | LOW | HIGH | P3 |
| CRM/webhook integrations | LOW | HIGH | P3 |
| Historical benchmarking | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- the complete assessment-to-gated-report pipeline
- P2: Should have, add after core pipeline validation
- P3: Nice to have, future consideration based on user demand

## Competitor Feature Analysis

| Feature | PMFsurvey (Sean Ellis) | SatisMeter PMF | Pendo PMF | involve.me (quiz builder) | Our Approach |
|---------|------------------------|----------------|-----------|---------------------------|--------------|
| Input method | Single question ("How disappointed...") | Single question survey | In-app survey | Multi-question quiz builder | 5 structured questions covering product, ICP, distribution, pain, traction |
| Analysis depth | Percentage calculation only | Percentage + segment breakdown | Percentage + user segments | Score/outcome mapping | 7-dimension scoring + real market research + 9-section AI report |
| Market research | None | None | None | None | Real-time competitor, market size, and complaint data via OpenAI web search |
| Report format | Bar chart + percentage | Dashboard widget | Dashboard widget | Custom result pages | Structured 9-section report with data-backed insights |
| Email gating | Not applicable (in-product) | Not applicable | Not applicable | Optional email gate on results | Preview with blurred full report, email unlocks everything |
| PDF export | None | CSV export | Dashboard export | None | Consulting-quality branded PDF |
| Lead generation focus | None (measurement tool) | None (measurement tool) | None (measurement tool) | Primary purpose | Primary purpose -- funnel to consulting CTA |
| AI involvement | None | None | None | None | GPT-4o for classification, research, and report narrative generation |
| Scoring approach | User self-report | User self-report | User self-report | Rule-based outcomes | Deterministic algorithm from founder inputs + external research data |

**Key competitive insight:** Existing PMF tools measure PMF from the user's perspective (the Sean Ellis question). This tool diagnoses PMF from an external market-data perspective. They answer "do your users love you?" while this answers "does your market positioning, competition, and distribution strategy support growth?" These are complementary, not competing, but the market-data approach is what makes this tool novel.

## Sources

- [PMFsurvey.com](https://pmfsurvey.com/) -- Sean Ellis PMF survey tool, free, single-question format
- [SatisMeter PMF](https://www.satismeter.com/pmf/) -- In-app PMF survey widget
- [Pendo PMF surveys](https://support.pendo.io/hc/en-us/articles/43942701779739-Product-Market-Fit-PMF-surveys) -- PMF survey in product analytics platform
- [OpinionX PMF tools comparison](https://www.opinionx.co/blog/12-best-tools-for-creating-productmarket-fit-surveys-pmf) -- Comparison of 12 PMF survey tools
- [involve.me lead generation quiz](https://www.involve.me/lead-generation-quiz) -- Quiz builder with email gating
- [Interact quiz builder](https://www.tryinteract.com/blog/8-best-lead-generation-quiz-software-for-2025/) -- Lead gen quiz software comparison
- [Insivia interactive assessment guide](https://www.insivia.com/how-to-build-an-interactive-assessment-for-my-website-lead-generation/) -- Best practices for assessment-based lead gen
- [Zuplo rate limiting best practices](https://zuplo.com/learning-center/10-best-practices-for-api-rate-limiting-in-2025) -- API rate limiting patterns
- [Orq.ai API rate limits](https://orq.ai/blog/api-rate-limit) -- AI API rate limiting strategies
- [First Round Levels of PMF](https://www.firstround.com/levels) -- PMF framework from First Round Capital
- Project PRD at `prd-trd/prd.md` and AI-LLM PRD at `prd-trd/ai-llm-prd.md` -- primary requirements source

---
*Feature research for: AI-powered PMF diagnostic tool backend*
*Researched: 2026-03-02*
