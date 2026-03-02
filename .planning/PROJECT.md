# PMF Insights Tool — Backend

## What This Is

A production-ready Node.js + Express + Prisma + PostgreSQL + OpenAI backend for the PMF Insights Tool. It powers a 5-question PMF diagnostic that classifies founder answers via AI, runs competitor/market research, computes a 7-dimension PMF score in code, generates a structured 9-section report via GPT-4o, and gates the full report behind email capture. The Next.js frontend already exists with hardcoded mock data — this backend replaces all mocks with real API-driven data.

## Core Value

Founders answer 5 questions and receive a data-backed, AI-generated PMF diagnostic report in under 15 seconds — specific enough to act on, backed by real competitor and market research.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Complete Prisma schema (3 domains: assessment pipeline, system config, analytics/audit)
- [ ] Assessment CRUD: create session, store responses, restore session
- [ ] AI classify pipeline: GPT-4o parse & classify founder answers with confidence scoring
- [ ] Research pipeline: OpenAI web search for competitors, market data, category complaints
- [ ] Research caching: category-keyed cache with 7-day TTL
- [ ] 7-dimension scoring algorithm computed entirely in code (not LLM)
- [ ] AI report generation: GPT-4o structured 9-section JSON report
- [ ] Hallucination validation: number extraction, company name verification, score-text consistency, banned word scan
- [ ] Report token system: nanoid URLs, 90-day expiry, preview vs full access
- [ ] Email gate: lead capture, MX validation, report unlock
- [ ] System content API: questions, categories, facts, social proof, micro-insights from DB
- [ ] Analytics events: fire-and-forget event storage, batch endpoint
- [ ] Rate limiting: per-endpoint IP-based limits
- [ ] PDF generation: Puppeteer HTML-to-PDF with consulting template
- [ ] Email delivery: Resend integration for report delivery with PDF attachment
- [ ] Seed data: all system tables populated from frontend constants
- [ ] Full pipeline under 15 seconds (classify → research → score → generate → validate)

### Out of Scope

- User authentication / login system — no user accounts, anonymous assessments only
- Admin panel — system content managed via DB seeds, not a UI
- Frontend modifications — FE integration done separately
- Real-time features (WebSockets) — HTTP request/response only
- Multi-language support — English only
- Payment processing — free tool, consulting CTA only

## Context

- **Frontend**: Next.js app at `../FE/` is fully built with hardcoded mock data in `FE/src/lib/constants.ts`. Backend API must return data structures the FE can consume directly.
- **BE skeleton exists**: Express 5, Prisma 7, Helmet, CORS, Zod, Pino logger, ts-node-dev already configured. Prisma schema is empty. Entry point, server, and app shell exist.
- **AI-LLM PRD**: Detailed prompt specs, scoring algorithm, and report JSON schema defined in `prd-trd/ai-llm-prd.md`. Prompts need production hardening (chain-of-thought, few-shot, guardrails) beyond the PRD outlines.
- **FE question structure**: 5 questions — Q1 textarea (product description), Q2 textarea (ICP), Q3 select (distribution channel with 8 options), Q4 textarea (stuck point), Q5 textarea (traction). Note: FE questions differ slightly from PRD seed data — backend should use the PRD-specified questions as system content, FE will fetch dynamically.
- **Report JSON**: AI-LLM PRD defines exact 9-section JSON schema (header, reality_check, scorecard, market, sales_model, competitors, positioning, bottom_line, recommendations, sources). Must match exactly.

## Constraints

- **Tech stack**: Node.js + Express 5 + Prisma 7 + PostgreSQL + OpenAI GPT-4o — already chosen, no changes
- **Performance**: Full AI pipeline must complete in under 15 seconds. Classify + research can run in parallel where possible.
- **Cost control**: Research cache (7-day TTL) prevents redundant API calls. AI daily spend limit configurable via env var. Every LLM call logged with token counts and cost.
- **No raw IPs**: All IPs SHA-256 hashed before storage. Never store raw IP addresses.
- **Scoring integrity**: 7-dimension scoring is pure code — LLM writes text around pre-computed scores, never decides them.
- **Data integrity**: Report JSON validated with Zod post-generation. Hallucination checks run before storage.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenAI web search for research (not Serper) | Simpler single-vendor setup, built-in to GPT-4o | — Pending |
| Resend for email delivery | Modern API, good DX, simple setup | — Pending |
| Puppeteer for PDF generation | Full HTML/CSS control for consulting-quality layout | — Pending |
| Scoring in code, not LLM | Deterministic, testable, no hallucination risk on scores | — Pending |
| UUID PKs on app tables, auto-increment on system tables | UUIDs for external-facing IDs, auto-increment for internal config | — Pending |
| Research cache keyed by category + sub_category | Prevents redundant expensive research API calls, 7-day TTL | — Pending |
| Express 5 (already installed) | Native async error handling, modern routing | — Pending |

---
*Last updated: 2026-03-02 after initialization*
