# Project Research Summary

**Project:** PMF Insights Tool Backend
**Domain:** AI-powered PMF diagnostic/assessment tool (lead-gen SaaS backend)
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is an AI-powered backend that takes 5 founder inputs, runs real-time market research via OpenAI web search, computes a deterministic 7-dimension PMF score, and generates a 9-section consulting-style report. The architecture is a monolithic Express 5 + Prisma 7 + PostgreSQL server with a linear AI pipeline (classify, research, score, generate, validate). The product is a top-of-funnel lead magnet -- free report gated behind email capture -- not a SaaS platform, which means no user accounts, no auth, and zero friction to start. The stack is largely locked in (Express 5, Prisma 7, Zod 4, Pino, TypeScript) with key additions needed: OpenAI SDK (Responses API), Puppeteer for PDF, Resend for email, express-rate-limit, nanoid v3 (CommonJS constraint), and node-cache for research TTL.

The recommended approach is a strict pipeline architecture where deterministic scoring in TypeScript is separated from LLM narrative generation. This is the single most important architectural decision: scores are computed in code (testable, reproducible), and the LLM writes prose around immutable score inputs. A post-generation hallucination validation layer acts as a hard gate before any report reaches a user. The research pipeline uses OpenAI's built-in web search tool with aggressive 7-day category-keyed caching, which serves as both a cost control and a reliability layer.

The three highest risks are: (1) OpenAI structured output hallucination -- the model will fill required schema fields with plausible but fabricated data, requiring multi-check validation; (2) API cost runaway -- each assessment triggers 5+ LLM calls, and without a daily spend tracker with hard stop, a traffic spike or retry loop can generate four-figure invoices overnight; (3) OpenAI web search unreliability -- the API-level web search is documented to be lower quality than the ChatGPT UI and sometimes fails to activate at all, requiring annotation verification and fallback strategies. All three risks are mitigable with specific patterns documented in the research, but they must be addressed during initial implementation, not as afterthoughts.

## Key Findings

### Recommended Stack

The core framework is locked in (Express 5.2, Prisma 7.4, Zod 4, Pino, TypeScript 5.9). The complementary stack is lean and deliberately avoids external infrastructure dependencies -- no Redis, no message queue, no separate search API.

**Core technologies to add:**
- **OpenAI SDK (^6.25):** Use the Responses API (not Chat Completions) -- built-in web search tool, better structured output support, OpenAI's investment path forward
- **Puppeteer (^24.37):** HTML-to-PDF with full CSS control for consulting-quality reports. Heavy resource footprint (280MB Chromium download, 50MB per page) requires careful concurrency management
- **Resend (^6.9):** Transactional email with PDF attachment. Simple API, 3K/month free tier, requires verified sending domain with SPF/DKIM/DMARC
- **express-rate-limit (^8.2):** Per-endpoint IP-based rate limiting with in-memory store. No Redis needed for single-server
- **nanoid v3 (^3.3):** URL-friendly unique IDs for report tokens. MUST use v3 -- v4/v5 are ESM-only and this project is CommonJS
- **node-cache (^5.1):** In-process TTL cache for research results. Cache lost on restart is acceptable for 7-day TTL research data

**Critical version constraints:** nanoid must be v3 (CommonJS), Zod 4 + OpenAI SDK `zodResponseFormat` compatibility needs early verification (fallback: manual JSON Schema conversion).

### Expected Features

**Must have (table stakes) -- the complete assessment-to-gated-report pipeline:**
- Assessment session CRUD (create, store responses, restore)
- System content API (questions, categories, facts, micro-insights)
- AI classification of founder answers (GPT-4o structured output)
- Research pipeline with category-keyed 7-day cache (competitors, market size, complaints)
- 7-dimension deterministic scoring algorithm (pure TypeScript, no LLM)
- AI report generation (9-section structured JSON via GPT-4o)
- Hallucination validation (number, company, score-text, banned word checks)
- Report token system (nanoid URLs, 90-day expiry, preview vs full)
- Email gate (lead capture, MX validation, report unlock)
- Rate limiting, analytics events, LLM cost logging, request validation

**Should have (add after core validation):**
- PDF generation (Puppeteer) -- defer until email gate proves conversion
- Email delivery with PDF attachment (Resend) -- pair with PDF
- Micro-insights API -- enhances engagement but not blocking
- Graceful degradation messaging for thin research data

**Defer (v2+):**
- URL scraping for founder websites, CRM/webhook integrations, historical benchmarking, A/B testing framework

**Anti-features (deliberately excluded):**
- User accounts/auth (zero friction is a feature), admin panel (seed scripts suffice), WebSocket progress (fake FE progress during single HTTP call), payments (this is a lead magnet, not a product), white-labeling

### Architecture Approach

Layered monolith: Routes -> Controllers -> Services -> Infrastructure. The pipeline orchestrator is the central coordination point, running classify -> research + partial scoring (parallel) -> full scoring -> report generation -> validation -> token creation. Controllers are thin (extract input, call service, format response). Services never touch req/res. OpenAI calls go through a centralized wrapper with retry, exponential backoff, and cost tracking. Research cache is DB-backed (Prisma `research_cache` table with `expires_at` column), not Redis.

**Major components:**
1. **Pipeline Orchestrator** -- coordinates the 5-step AI pipeline with parallelism where dependencies allow, targeting sub-15-second total execution
2. **Centralized OpenAI Client** -- single wrapper for all LLM calls with retry (3 attempts, exponential backoff), circuit breaker (60s pause after 3 failures), per-call cost tracking, and daily spend limit enforcement
3. **Scoring Service** -- pure TypeScript functions computing 7 PMF dimensions deterministically. No LLM involvement. Fully unit-testable
4. **Validation Service** -- post-generation hallucination checks (number extraction, company name verification, score-text consistency, banned words). Hard gate with up to 2 retries
5. **Report Service** -- token management (nanoid), preview vs full access control, 90-day expiry enforcement

### Critical Pitfalls

1. **OpenAI structured output hallucination** -- Model fills required JSON fields with fabricated data that passes schema validation. Prevent with multi-layered post-generation validation: extract and verify all numbers against research input, cross-reference company names against research results, check score-text consistency, scan for banned superlatives. Auto-retry up to 2x on failure.

2. **API cost runaway** -- Each assessment triggers 5+ LLM calls. Without controls, a retry loop or traffic spike burns through budget in hours. Prevent with: application-level daily spend tracker with hard stop (env var), tight per-call `max_tokens` limits (classify=200, research=1500, report=4000), circuit breaker after 3 consecutive failures, research cache as day-1 requirement.

3. **OpenAI web search unreliability** -- API web search is lower quality than the ChatGPT UI and sometimes silently fails to activate. Prevent by verifying response annotations contain URL citations, retrying with simplified prompts when absent, and falling back to stale cache data rather than serving ungrounded reports.

4. **Pipeline race conditions** -- 15-second pipeline duration creates a large window for duplicate submissions from frontend retry. Prevent with optimistic database locking (status transition from PENDING to PROCESSING with WHERE clause), idempotency keys, and returning 202 for in-progress pipelines.

5. **Puppeteer memory crashes** -- Each Chromium instance uses 200-500MB. Without concurrency limits and cleanup, 10+ concurrent PDFs will OOM the server. Prevent with single browser instance at startup, incognito contexts per request, 2-3 max concurrency queue, mandatory cleanup in finally blocks, and 30-second hard timeout.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Database
**Rationale:** Everything depends on schema, config, and error handling. Prisma 7 has breaking changes (driver adapters, no auto-dotenv, new generator name) that must be resolved first. Express 5 error handling has callback-based gaps that need process-level handlers from day one.
**Delivers:** Prisma schema (3 domains: assessment, system config, analytics), env validation with Zod, Pino logger, centralized error handling middleware, custom error classes, Prisma client singleton
**Addresses:** Request validation (Zod), error handling, structured error responses
**Avoids:** Prisma 7 migration footguns (Pitfall 7), Express 5 error handling gaps (Pitfall 6)

### Phase 2: System Content and Assessment CRUD
**Rationale:** Gets data flowing and enables FE development in parallel. Low risk, well-understood patterns. Assessment CRUD establishes the session model that the pipeline will operate on.
**Delivers:** System content seed data + read-only API (questions, categories, facts, social proof, micro-insights), assessment session creation/response storage/restoration, Zod request validation middleware
**Addresses:** Question retrieval, session persistence, system content API, micro-insights data
**Avoids:** N/A -- standard CRUD, low risk

### Phase 3: AI Infrastructure and Classification
**Rationale:** AI integration is the highest-risk work. Start it early to surface Zod 4 + OpenAI SDK compatibility issues, validate Responses API patterns, and establish the centralized client wrapper that all subsequent AI work depends on. Classification is the first pipeline step and produces the category/sub-category that research depends on.
**Delivers:** Centralized OpenAI client (retry, backoff, cost tracking, daily spend limit), prompt builder architecture, Zod schemas for AI responses, classification service (GPT-4o structured output), LLM call logging
**Addresses:** AI classification, LLM cost logging, daily spend tracking
**Avoids:** Cost runaway (Pitfall 2), scattered OpenAI calls (Anti-pattern 5)

### Phase 4: Research Pipeline and Scoring
**Rationale:** Research is the most expensive and most unreliable AI step. Building it with caching and verification from day one is non-negotiable. Scoring depends on both classification and research outputs. These two services complete the data pipeline that feeds report generation.
**Delivers:** Research service with OpenAI web search (4 parallel queries: competitors, market size, complaints, patterns), DB-backed research cache with 7-day TTL, web search verification (annotation checks), research fallback strategy, 7-dimension scoring algorithm (pure TypeScript), weighted PMF score + stage calculation
**Addresses:** Research pipeline + caching, 7-dimension scoring, deterministic scoring (differentiator)
**Avoids:** Web search unreliability (Pitfall 4), missing cache (performance trap), LLM deciding scores (Anti-pattern 1)

### Phase 5: Report Generation, Validation, and Pipeline Orchestration
**Rationale:** Report generation is the "money feature" and needs all prior pipeline steps working. The orchestrator ties everything together with parallelism. Validation is a hard gate -- no report reaches a user without passing hallucination checks.
**Delivers:** Report generation service (9-section structured JSON via GPT-4o), hallucination validation service (5 checks + retry logic), pipeline orchestrator (classify -> research+partial scoring parallel -> full scoring -> generate -> validate -> store), sub-15-second target
**Addresses:** AI report generation, hallucination validation, sub-15-second pipeline (differentiator), graceful degradation
**Avoids:** Hallucination (Pitfall 1), race conditions (Pitfall 5), sequential execution (Anti-pattern 4)

### Phase 6: Report Access, Email Gate, and Lead Capture
**Rationale:** The business model layer. Requires a working pipeline producing stored reports. Token system, preview/full access control, and email gate are tightly coupled and should be built together.
**Delivers:** Report token system (nanoid, 90-day expiry), report endpoints (preview vs full), email gate (lead capture, MX validation, report unlock), rate limiting (per-endpoint IP-based with hashed IPs)
**Addresses:** Report token system, email gate, rate limiting, IP anonymization
**Avoids:** Token expiry bypass (security mistake), unbounded AI endpoint access (security mistake)

### Phase 7: PDF, Email Delivery, and Analytics
**Rationale:** These are enhancement and operational features that do not block the core pipeline. PDF and email delivery should only be built after email gate conversion is validated. Analytics can be wired in at any point.
**Delivers:** PDF generation (Puppeteer with concurrency limits), email delivery with PDF attachment (Resend), analytics event tracking (fire-and-forget, batch endpoint), end-to-end pipeline testing
**Addresses:** PDF export (differentiator), email delivery (differentiator), analytics events
**Avoids:** Puppeteer memory crashes (Pitfall 3), email deliverability issues (DNS auth)

### Phase Ordering Rationale

- **Foundation first** because Prisma 7 has breaking changes and Express 5 error handling has non-obvious gaps. Getting these wrong costs days of debugging later.
- **Content and CRUD before AI** because they unblock FE development and establish the data model the pipeline operates on.
- **AI infrastructure before specific AI features** because the centralized OpenAI client, cost tracking, and prompt architecture are shared dependencies. Building classification first validates the entire AI integration pattern.
- **Research before report generation** because research output is a required input to both scoring and report generation. Research is also the highest-risk step (web search unreliability) and benefits from early exposure.
- **Pipeline orchestration with report generation** because the orchestrator cannot be tested without all pipeline steps available.
- **Business model layer (tokens, email gate) after pipeline** because these features wrap the pipeline output and require stored reports to function.
- **PDF and email delivery last** because they are high-complexity, non-blocking enhancements. PDF generation (Puppeteer) has the highest operational risk of any feature and should not be on the critical path.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (AI Infrastructure):** Zod 4 + OpenAI SDK `zodResponseFormat` compatibility is untested. May need manual JSON Schema conversion. Responses API patterns are newer and less documented than Chat Completions.
- **Phase 4 (Research Pipeline):** OpenAI web search reliability via API is a known issue. May need to pivot to a dedicated search API (Serper, Tavily) if web search proves insufficient during development.
- **Phase 5 (Report Generation):** Prompt engineering for 9-section structured output is domain-specific and will require iteration. Hallucination validation thresholds need tuning against real outputs.
- **Phase 7 (PDF Generation):** Puppeteer resource management patterns need validation in the target deployment environment (Docker, cloud VM, etc.).

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Well-documented Express 5 + Prisma 7 setup. Prisma 7 migration guide covers all breaking changes.
- **Phase 2 (Content + CRUD):** Standard REST CRUD with Zod validation. No novel patterns.
- **Phase 6 (Report Access + Email Gate):** Standard token-based access control, MX validation, and rate limiting. Well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified against npm registry with current versions. Core stack already installed. Only concern: Zod 4 + OpenAI SDK interop (MEDIUM) |
| Features | HIGH | Feature set derived from project PRD + competitive analysis of 6 comparable tools. Clear table stakes vs differentiator separation. Dependency graph well-mapped |
| Architecture | HIGH | Layered monolith with pipeline orchestrator is the standard pattern for this type of backend. Build order validated against component dependencies. Patterns from official OpenAI and Express docs |
| Pitfalls | HIGH | Multi-source verified (official docs, community reports, production post-mortems). Pitfalls are specific, actionable, and mapped to phases. OpenAI web search reliability is the least certain area (MEDIUM) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Zod 4 + OpenAI `zodResponseFormat` compatibility:** Untested with Zod 4 (SDK was built for Zod 3). Must verify in Phase 3. Fallback: manual JSON Schema conversion via `zod-to-json-schema`.
- **OpenAI web search API reliability:** Documented quality gap vs ChatGPT UI. Must validate during Phase 4 development. Fallback: dedicated search API (Serper/Tavily) or expanded caching strategy.
- **Deployment environment for Puppeteer:** Chromium binary management differs between local dev, Docker, and cloud platforms. Must validate in Phase 7 for the target deployment target.
- **OpenAI Responses API maturity:** Newer API than Chat Completions. Edge cases with structured output + web search combined are less documented. Phase 3 should validate this early.
- **Email deliverability:** Resend requires verified domain with proper DNS records (SPF, DKIM, DMARC). Domain setup is a non-code dependency that should be initiated early even though email delivery is Phase 7.

## Sources

### Primary (HIGH confidence)
- [OpenAI Structured Outputs documentation](https://platform.openai.com/docs/guides/structured-outputs)
- [OpenAI Responses API migration guide](https://platform.openai.com/docs/guides/migrate-to-responses)
- [OpenAI Rate Limits guide](https://platform.openai.com/docs/guides/rate-limits)
- [Express.js error handling guide](https://expressjs.com/en/guide/error-handling.html)
- [Prisma v7 migration guide](https://www.prisma.io/docs/ai/prompts/prisma-7)
- [Prisma Migrate limitations](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues)
- [Puppeteer PDF generation guide](https://pptr.dev/guides/pdf-generation)
- [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Resend Node.js docs](https://resend.com/docs/send-with-nodejs)

### Secondary (MEDIUM confidence)
- [OpenAI community: malformed JSON responses](https://community.openai.com/t/chat-completion-responses-suddenly-returning-malformed-or-inconsistent-json/1368077)
- [OpenAI community: web search API quality](https://community.openai.com/t/chatgpts-api-returns-worse-web-search-results-than-its-web-ui-and-it-cant-explain-to-me-why/1234542)
- [Puppeteer memory leak production journey](https://medium.com/@matveev.dina/the-hidden-cost-of-headless-browsers-a-puppeteer-memory-leak-journey-027e41291367)
- [Express.js layered architecture patterns](https://codearchitecture.in/stories/layered-architecture-in-nodejs-and-express-class-based-design-dependency-injection-and-best-practices)
- [OpenAI community: Zod 4 compatibility](https://community.openai.com/t/structured-outputs-example-broken-node-js-triggering-zod-version-discovered/1338894)

### Tertiary (LOW confidence)
- [HN: OpenAI removed budget limits](https://news.ycombinator.com/item?id=45589628) -- needs validation, single source

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
