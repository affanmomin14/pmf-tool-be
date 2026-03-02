# Architecture Research

**Domain:** AI-powered PMF diagnostic tool backend
**Researched:** 2026-03-02
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
                          CLIENT (Next.js FE)
                                |
                           HTTP/JSON
                                |
┌───────────────────────────────┴───────────────────────────────────┐
│                         API LAYER                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Assessment │  │  Content   │  │   Report   │  │ Analytics  │  │
│  │  Routes    │  │  Routes    │  │   Routes   │  │  Routes    │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  │
│        │               │               │               │          │
│  ┌─────┴──────┐  ┌─────┴──────┐  ┌─────┴──────┐  ┌─────┴──────┐  │
│  │ Assessment │  │  Content   │  │   Report   │  │ Analytics  │  │
│  │ Controller │  │ Controller │  │ Controller │  │ Controller │  │
│  └─────┬──────┘  └─────┴──────┘  └─────┬──────┘  └─────┴──────┘  │
├────────┴────────────────┴───────────────┴───────────────┴─────────┤
│                       SERVICE LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Assessment  │  │   Pipeline   │  │    Report    │             │
│  │   Service    │──│ Orchestrator │──│   Service    │             │
│  └──────────────┘  └──────┬───────┘  └──────────────┘             │
│                           │                                       │
│         ┌─────────────────┼─────────────────┐                     │
│         │                 │                 │                     │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐            │
│  │  Classify    │  │  Research    │  │   Scoring    │            │
│  │  Service     │  │  Service     │  │   Service    │            │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘            │
│         │                 │                                       │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────────────┐            │
│  │  Report Gen  │  │  Validation  │  │    Email     │            │
│  │  Service     │  │  Service     │  │   Service    │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
├───────────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE LAYER                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  OpenAI  │  │  Prisma  │  │  Cache   │  │  Resend  │          │
│  │  Client  │  │  Client  │  │  Layer   │  │  Client  │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│  ┌──────────┐                                                     │
│  │ Puppeteer│                                                     │
│  └──────────┘                                                     │
├───────────────────────────────────────────────────────────────────┤
│                       DATA LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Assessment   │  │   System     │  │  Analytics   │             │
│  │   Tables     │  │   Config     │  │   Tables     │             │
│  │ (UUID PKs)   │  │  (auto-inc)  │  │  (auto-inc)  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Routes** | HTTP verb + path mapping, middleware attachment (rate limiting, validation) | Express Router files, one per domain |
| **Controllers** | Parse request, call service, format HTTP response, handle HTTP-level errors | Thin functions: extract params, call service, send JSON |
| **Pipeline Orchestrator** | Coordinate the classify-research-score-generate-validate sequence | Single async function that runs steps in order with parallelism where possible |
| **Classify Service** | Send founder answers to GPT-4o, parse structured classification JSON | OpenAI chat completion with JSON mode, Zod validation on response |
| **Research Service** | Run competitor/market/complaint searches via OpenAI web search | Multiple parallel OpenAI calls, merge results, cache by category |
| **Scoring Service** | Compute 7-dimension PMF scores deterministically in code | Pure TypeScript functions, no LLM involvement, fully testable |
| **Report Gen Service** | Generate 9-section report JSON via GPT-4o using scores + research | OpenAI chat completion, large structured output, Zod validation |
| **Validation Service** | Run hallucination checks: number extraction, company name verification, banned words | Post-processing pipeline on generated JSON, flag/retry logic |
| **Report Service** | Token generation (nanoid), preview vs full access, expiry management | CRUD + business rules around access control |
| **Email Service** | Lead capture, MX validation, send report via Resend with PDF | Resend SDK integration, fire-and-forget pattern |
| **Cache Layer** | Category-keyed research cache with 7-day TTL | DB-backed cache (research_cache table in Prisma), not Redis |
| **OpenAI Client** | Centralized OpenAI API wrapper with retry, circuit breaker, cost tracking | Singleton wrapper around openai SDK with exponential backoff |
| **Analytics Service** | Fire-and-forget event storage | Async writes, never block request path |

## Recommended Project Structure

```
src/
├── index.ts                    # Entry point (import server)
├── app.ts                      # Express app setup (middleware, routes)
├── server.ts                   # HTTP server listen
│
├── config/
│   ├── env.ts                  # Zod-validated environment variables
│   └── logger.ts               # Pino logger setup
│
├── routes/
│   ├── assessment.routes.ts    # POST /assessments, GET /assessments/:id
│   ├── content.routes.ts       # GET /questions, GET /categories, GET /facts
│   ├── report.routes.ts        # GET /reports/:token, POST /reports/:token/unlock
│   └── analytics.routes.ts     # POST /events, POST /events/batch
│
├── controllers/
│   ├── assessment.controller.ts
│   ├── content.controller.ts
│   ├── report.controller.ts
│   └── analytics.controller.ts
│
├── services/
│   ├── assessment.service.ts   # Session CRUD, response storage
│   ├── pipeline.orchestrator.ts # classify → research → score → generate → validate
│   ├── classify.service.ts     # GPT-4o classification call
│   ├── research.service.ts     # OpenAI web search for market data
│   ├── scoring.service.ts      # 7-dimension scoring algorithm (pure code)
│   ├── report-gen.service.ts   # GPT-4o report generation
│   ├── validation.service.ts   # Hallucination checks + retry logic
│   ├── report.service.ts       # Token management, access control
│   ├── email.service.ts        # Resend integration, MX validation
│   ├── pdf.service.ts          # Puppeteer HTML-to-PDF
│   └── analytics.service.ts    # Event storage
│
├── ai/
│   ├── openai.client.ts        # Centralized OpenAI wrapper (retry, backoff, cost tracking)
│   ├── prompts/
│   │   ├── classify.prompt.ts  # Classification system prompt + builder
│   │   └── report.prompt.ts    # Report generation system prompt + builder
│   └── schemas/
│       ├── classify.schema.ts  # Zod schema for classification response
│       └── report.schema.ts    # Zod schema for 9-section report JSON
│
├── middlewares/
│   ├── error.middleware.ts     # Global error handler
│   ├── rate-limit.middleware.ts # IP-based rate limiting
│   └── validate.middleware.ts  # Zod request body validation
│
├── db/
│   ├── prisma.ts               # Prisma client singleton
│   └── cache.ts                # Research cache read/write helpers
│
├── utils/
│   ├── ip-hash.ts              # SHA-256 IP hashing (never store raw)
│   ├── cost-tracker.ts         # Token count + cost logging per LLM call
│   └── errors.ts               # Custom error classes (AppError, ValidationError)
│
└── types/
    ├── assessment.types.ts     # Assessment domain types
    ├── report.types.ts         # Report domain types
    └── pipeline.types.ts       # Pipeline step input/output types
```

### Structure Rationale

- **`routes/` separate from `controllers/`:** Routes define HTTP shape (verb, path, middleware chain). Controllers handle request parsing. This keeps routing declarative and controllers focused on input/output mapping.
- **`services/` is the largest layer:** All business logic lives here. Services never touch `req`/`res` objects. They accept typed inputs and return typed outputs, making them testable without HTTP.
- **`ai/` is its own concern:** OpenAI integration is complex enough to warrant isolation. Prompts are code (template builders), not string literals scattered across services. Schemas validate AI output at the boundary.
- **`db/cache.ts` not a separate Redis service:** The PRD specifies a 7-day TTL cache for research. Since there is no Redis in the stack (and adding Redis for one cache use case is overkill), use the Prisma `research_cache` table with a `expires_at` column. Simple DB read with TTL check.
- **`utils/` for cross-cutting concerns:** IP hashing and cost tracking are used across multiple services but are not business logic.

## Architectural Patterns

### Pattern 1: Pipeline Orchestrator (Sequential Steps with Parallel Where Possible)

**What:** A single orchestrator function coordinates the full AI pipeline. Each step is a discrete service call with typed input/output. Steps that can run in parallel do so.
**When to use:** Whenever the assessment pipeline runs (after all 5 questions answered).
**Trade-offs:** Simple to reason about (one function, linear flow). No job queue overhead. Downside: if the server crashes mid-pipeline, work is lost -- acceptable for a free diagnostic tool.

**Example:**
```typescript
// services/pipeline.orchestrator.ts
interface PipelineInput {
  assessmentId: string;
  answers: FounderAnswers;
}

interface PipelineResult {
  classification: Classification;
  research: ResearchFindings;
  scores: DimensionScores;
  report: ReportJSON;
  reportToken: string;
}

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  // Step 1: Classify (must complete before research)
  const classification = await classifyAnswers(input.answers);

  // Step 2: Research + partial scoring can run in parallel
  // Research needs classification. Some scoring dimensions only need answers.
  const [research, partialScores] = await Promise.all([
    runResearch(classification),           // OpenAI web search
    computeAnswerOnlyScores(input.answers), // Scores that don't need research
  ]);

  // Step 3: Complete scoring (needs research data for some dimensions)
  const scores = completeScoring(partialScores, research, classification);

  // Step 4: Generate report (needs everything)
  const report = await generateReport(input.answers, research, scores);

  // Step 5: Validate (hallucination checks)
  const validatedReport = await validateReport(report, research, scores);

  // Step 6: Store and create token
  const reportToken = await storeReport(input.assessmentId, validatedReport, scores);

  return { classification, research, scores, report: validatedReport, reportToken };
}
```

### Pattern 2: Centralized OpenAI Client with Retry and Cost Tracking

**What:** A single OpenAI wrapper that handles all API calls with exponential backoff, circuit breaking, and per-call cost logging. Every service uses this wrapper instead of the raw SDK.
**When to use:** Every OpenAI API call (classify, research, report generation).
**Trade-offs:** Adds a layer of indirection, but centralizes retry logic, rate limit handling, and cost tracking in one place. Without this, each service would reimplement error handling.

**Example:**
```typescript
// ai/openai.client.ts
import OpenAI from 'openai';

interface LLMCallOptions {
  model: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  temperature?: number;
  responseFormat?: 'json';
  maxTokens?: number;
  label: string; // For cost tracking: "classify", "research", "report-gen"
}

interface LLMCallResult<T> {
  data: T;
  usage: { promptTokens: number; completionTokens: number; totalCost: number };
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

export async function callLLM<T>(options: LLMCallOptions): Promise<LLMCallResult<T>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.3,
        response_format: options.responseFormat ? { type: 'json_object' } : undefined,
        max_tokens: options.maxTokens,
      });

      const usage = response.usage;
      const cost = calculateCost(options.model, usage);

      // Log cost (fire-and-forget to DB)
      logLLMUsage(options.label, usage, cost).catch(() => {});

      // Check daily spend limit
      await checkDailySpendLimit(cost);

      return {
        data: JSON.parse(response.choices[0].message.content!) as T,
        usage: { promptTokens: usage!.prompt_tokens, completionTokens: usage!.completion_tokens, totalCost: cost },
      };
    } catch (error: any) {
      lastError = error;
      if (error.status === 429 || error.status >= 500) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200;
        await sleep(delay);
        continue;
      }
      throw error; // Non-retryable error (400, 401, etc.)
    }
  }

  throw lastError;
}
```

### Pattern 3: Validation as a Post-Processing Pipeline

**What:** After GPT-4o generates the report JSON, run a series of validation checks in code. If too many flags, retry generation with a stricter prompt. Max 2 retries.
**When to use:** After every report generation.
**Trade-offs:** Adds latency (validation + potential retry), but prevents hallucinated data from reaching the founder. The PRD mandates this.

**Example:**
```typescript
// services/validation.service.ts
interface ValidationResult {
  isValid: boolean;
  flags: ValidationFlag[];
  report: ReportJSON;
}

export function validateReport(
  report: ReportJSON,
  research: ResearchFindings,
  scores: DimensionScores
): ValidationResult {
  const flags: ValidationFlag[] = [];

  // 1. Extract all numbers, verify against research + answers
  flags.push(...checkNumbers(report, research));

  // 2. Extract company names, verify against research competitors
  flags.push(...checkCompanyNames(report, research));

  // 3. Score-text consistency ("strong demand" but score=3 is a contradiction)
  flags.push(...checkScoreConsistency(report, scores));

  // 4. Verdict length (must be one sentence)
  flags.push(...checkVerdictLength(report));

  // 5. Banned word scan
  flags.push(...checkBannedWords(report));

  return {
    isValid: flags.length <= 3,
    flags,
    report,
  };
}
```

### Pattern 4: Controller-Service Boundary via Typed Contracts

**What:** Controllers never pass `req` or `res` to services. They extract typed data from the request, pass it to services, and format the response. Services return typed results.
**When to use:** Every endpoint.
**Trade-offs:** Slightly more typing up front. Massively easier to test and refactor.

**Example:**
```typescript
// controllers/assessment.controller.ts
import { Request, Response, NextFunction } from 'express';
import { createAssessment, submitResponse } from '../services/assessment.service';
import { runPipeline } from '../services/pipeline.orchestrator';

export async function handleSubmitFinalAnswer(req: Request, res: Response, next: NextFunction) {
  try {
    const { assessmentId } = req.params;
    const { questionId, answer } = req.body; // Already validated by Zod middleware

    // Store the response
    await submitResponse(assessmentId, questionId, answer);

    // If this is Q5, trigger the pipeline
    if (questionId === 5) {
      const result = await runPipeline({ assessmentId, answers: await getAnswers(assessmentId) });
      res.json({ reportToken: result.reportToken, previewData: buildPreview(result) });
      return;
    }

    res.json({ status: 'stored' });
  } catch (error) {
    next(error); // Express 5 async error handling
  }
}
```

## Data Flow

### Primary Data Flow: Assessment Pipeline

```
Founder submits Q5 (final answer)
    |
    v
[Controller] ── extract assessmentId + answer ──> [Assessment Service] store response
    |
    v
[Pipeline Orchestrator] starts
    |
    v
Step 1: [Classify Service]
    |── Send 5 answers to GPT-4o
    |── Receive: category, sub_category, search_queries, likely_competitors, problem_type
    |── Validate response with Zod schema
    v
Step 2 (parallel):
    |── [Research Service]
    |   |── Check research_cache (DB) for category+sub_category
    |   |── Cache HIT → use cached data
    |   |── Cache MISS → 3-4 parallel OpenAI web search calls:
    |   |   |── competitors search
    |   |   |── market size search
    |   |   |── category complaints search
    |   |   └── category patterns search
    |   |── Merge results, store in cache with 7-day TTL
    |   └── Return: ResearchFindings
    |
    |── [Scoring Service] (answer-only dimensions)
    |   |── Compute Trust & Proof from Q5
    |   |── Compute ICP Focus from Q2
    |   └── Return: partial scores
    v
Step 3: [Scoring Service] (research-dependent dimensions)
    |── Compute Demand (Q5 + market CAGR)
    |── Compute Differentiation (Q1 + competitor taglines)
    |── Compute Distribution Fit (Q3 + category sales model)
    |── Compute Problem Severity (Q4 + market pain data)
    |── Compute Competitive Position (competitor count/funding)
    |── Calculate weighted PMF score
    └── Return: DimensionScores + pmf_score + pmf_stage
    v
Step 4: [Report Gen Service]
    |── Build prompt with: answers + research + scores
    |── Send to GPT-4o (structured JSON output)
    |── Parse 9-section report JSON
    └── Validate with Zod schema
    v
Step 5: [Validation Service]
    |── Run 5 hallucination checks
    |── flags <= 3 → PASS
    |── flags > 3 → Retry generation (max 2x) with stricter prompt
    └── Return: validated ReportJSON
    v
Step 6: [Report Service]
    |── Generate nanoid token
    |── Store report JSON + scores + token in DB
    |── Set 90-day expiry
    └── Return: reportToken
    v
[Controller] ── return { reportToken, previewData } ──> Client
```

### Secondary Data Flow: Report Access

```
Founder visits /report/:token
    |
    v
[Report Controller] ── extract token ──> [Report Service]
    |── Validate token exists and not expired
    |── Check access level: preview or full
    |── preview: return header + scorecard + bottom_line only
    |── full: return complete 9-section report
    v
[Controller] ── return report JSON ──> Client

--- Email Gate (unlock full report) ---

Founder submits email on preview page
    |
    v
[Report Controller] ── extract token + email ──> [Email Service]
    |── Validate email format (Zod)
    |── MX record validation
    |── Store lead in DB
    |── Update report access to "full"
    |── Trigger async: generate PDF + send email via Resend
    v
[Controller] ── return { unlocked: true } ──> Client
```

### Key Data Flows Summary

1. **Pipeline flow:** Linear with one parallelism opportunity (research + partial scoring). Total target: under 15 seconds. Classification ~2s, research ~5-8s (cached: 0s), scoring ~10ms, generation ~3-5s, validation ~50ms.
2. **Cache flow:** Research service checks DB cache before OpenAI calls. Cache key is `category + sub_category`. TTL is 7 days. Cache hit skips the most expensive step.
3. **Analytics flow:** Fire-and-forget. Controllers emit events to analytics service which writes asynchronously. Never blocks the request path. Never fails the request.
4. **Content flow:** System content (questions, categories, facts, micro-insights) served from DB. Seeded from seed script. Read-only at runtime.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1K assessments | Monolith is correct. In-process pipeline. DB-backed cache. No queue needed. |
| 1K-10K assessments | Add connection pooling to Prisma. Consider moving PDF generation to a BullMQ queue (Puppeteer is memory-heavy). Monitor OpenAI rate limits. |
| 10K-100K assessments | Move full pipeline to BullMQ workers. Add Redis for research cache (faster reads). Horizontal scaling with multiple server instances behind a load balancer. |

### Scaling Priorities

1. **First bottleneck: OpenAI rate limits.** At scale, concurrent pipeline runs will hit OpenAI's tokens-per-minute limit. Mitigation: queue pipelines, batch research calls, expand research cache TTL. The 7-day cache already helps significantly since many founders are in the same categories.
2. **Second bottleneck: Puppeteer memory.** Each PDF generation spins up a headless Chromium instance. At 50+ concurrent PDFs, memory spikes. Mitigation: move PDF generation to a background queue, limit concurrency to 3-5 simultaneous renders.
3. **Third bottleneck: Database connections.** Prisma's connection pool defaults to `num_cpus * 2 + 1`. Under heavy load, this can exhaust. Mitigation: configure `connection_limit` in Prisma datasource, use PgBouncer in production.

## Anti-Patterns

### Anti-Pattern 1: LLM Deciding Scores

**What people do:** Pass scoring to GPT-4o alongside report generation, letting the model decide scores.
**Why it's wrong:** LLM scores are non-deterministic. Same input produces different scores on each call. Impossible to test, impossible to explain to the founder. The PRD explicitly forbids this.
**Do this instead:** Compute all 7 dimension scores in TypeScript with deterministic rules. Pass pre-computed scores to the LLM. The LLM writes prose around scores it cannot change.

### Anti-Pattern 2: Fat Controllers

**What people do:** Put business logic (scoring calculations, OpenAI calls, cache checks) directly in Express route handlers.
**Why it's wrong:** Untestable without spinning up HTTP. Cannot reuse logic. Error handling becomes tangled with HTTP concerns.
**Do this instead:** Controllers do three things: extract input, call service, format response. Everything else is a service.

### Anti-Pattern 3: Unvalidated AI Output

**What people do:** Trust GPT-4o's JSON output and pass it directly to the frontend.
**Why it's wrong:** LLMs hallucinate. They invent company names, statistics, and scores. A single hallucinated funding number destroys trust with the founder.
**Do this instead:** Every AI response goes through Zod schema validation (structural) AND hallucination checks (semantic). If validation fails, retry with a stricter prompt. Max 2 retries, then flag for review.

### Anti-Pattern 4: Synchronous Everything with No Parallelism

**What people do:** Run classify, then research, then score, then generate, then validate sequentially.
**Why it's wrong:** The 15-second budget is tight. Sequential execution could take 15-20s.
**Do this instead:** Identify which steps depend on which outputs. Research and answer-only scoring can run in parallel after classification. Research sub-queries (competitors, market, complaints) can all run in parallel. Save 3-5 seconds.

### Anti-Pattern 5: Raw OpenAI SDK Calls Scattered Across Services

**What people do:** Import `openai` directly in classify.service.ts, research.service.ts, and report-gen.service.ts, each with their own retry logic.
**Why it's wrong:** Inconsistent retry behavior, no centralized cost tracking, no single place to enforce daily spend limits.
**Do this instead:** One `openai.client.ts` wrapper. All services call `callLLM()`. Retry, backoff, cost tracking, and spend limits are handled in one place.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **OpenAI API** | Centralized client wrapper (`ai/openai.client.ts`), retry with exponential backoff (500ms base, 2x factor, 3 attempts), JSON mode for structured output | Monitor `429` responses. Log every call with token count + cost. Enforce daily spend limit via env var. |
| **Resend** | SDK call in `email.service.ts`, fire-and-forget after report unlock | Async -- do not block the unlock response. Log delivery status. Handle bounces gracefully. |
| **Puppeteer** | Spawn in `pdf.service.ts`, render HTML template with report data, convert to PDF buffer | Memory-intensive. Limit concurrent renders. Consider a pool of browser instances. Clean up after each render. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Controller <-> Service | Direct function calls with typed interfaces | Services never see `req`/`res`. Controllers never contain business logic. |
| Pipeline Orchestrator <-> AI Services | Direct async function calls | Orchestrator manages step ordering and parallelism. Each AI service is independently testable. |
| Services <-> Database | Via Prisma client singleton | All DB access goes through Prisma. No raw SQL. Cache reads/writes use helper functions in `db/cache.ts`. |
| Services <-> OpenAI | Via centralized `callLLM()` wrapper | Services build prompts and schemas. The wrapper handles transport, retry, and cost. |
| Prompts <-> Services | Prompt builder functions in `ai/prompts/` | Prompts are functions that accept data and return message arrays. Not hardcoded strings. This makes them testable and composable. |

## Build Order (Dependencies)

Based on component dependencies, the recommended build order is:

```
Phase 1: Foundation (no dependencies)
├── Prisma schema (all 3 domains)
├── Config (env validation, logger)
├── Error handling middleware
├── Prisma client singleton
└── Custom error classes

Phase 2: Data & Content (depends on: Phase 1)
├── System content seed data
├── Content routes/controllers/service (read-only)
├── Assessment CRUD (create session, store responses)
└── Request validation middleware (Zod)

Phase 3: AI Core (depends on: Phase 1)
├── OpenAI client wrapper (retry, backoff, cost tracking)
├── Prompt builder functions
├── Zod schemas for AI responses
├── Classify service
└── Research service + cache layer

Phase 4: Scoring & Generation (depends on: Phase 3)
├── Scoring service (7 dimensions, pure code)
├── Report generation service
├── Validation service (hallucination checks)
└── Pipeline orchestrator (ties it all together)

Phase 5: Access & Delivery (depends on: Phase 2, Phase 4)
├── Report token system (nanoid, expiry)
├── Report routes (preview vs full)
├── Email gate (lead capture, MX validation)
├── PDF generation (Puppeteer)
└── Email delivery (Resend)

Phase 6: Polish (depends on: all above)
├── Rate limiting
├── Analytics events
├── Cost/spend limit enforcement
└── End-to-end pipeline testing
```

**Why this order:**
- Phase 1 is pure infrastructure. Everything depends on it.
- Phase 2 gets data flowing and lets the FE fetch questions/content while AI work continues.
- Phase 3 is the hardest, highest-risk work (AI integrations). Start it early to surface issues.
- Phase 4 depends on AI services being stable.
- Phase 5 is the "product" layer -- tokens, email gates, PDF -- and needs the pipeline working.
- Phase 6 is operational polish. Rate limiting and analytics are important but do not block the core pipeline.

## Sources

- [Express.js layered architecture patterns](https://codearchitecture.in/stories/layered-architecture-in-nodejs-and-express-class-based-design-dependency-injection-and-best-practices) - MEDIUM confidence
- [Controller-Service-Repository pattern in Node.js](https://www.w3tutorials.net/blog/controller-service-repository-pattern-nodejs/) - MEDIUM confidence
- [OpenAI rate limit handling and retry strategies](https://cookbook.openai.com/examples/how_to_handle_rate_limits) - HIGH confidence (official OpenAI docs)
- [OpenAI API retries with exponential backoff](https://platform.openai.com/docs/guides/rate-limits/retrying-with-exponential-backoff) - HIGH confidence (official OpenAI docs)
- [Circuit breaker pattern for LLM APIs](https://medium.com/@spacholski99/circuit-breaker-for-llm-with-retry-and-backoff-anthropic-api-example-typescript-1f99a0a0cf87) - MEDIUM confidence
- [BullMQ for background jobs in Node.js](https://bullmq.io/) - HIGH confidence (official docs)
- [OpenAI community: backend architecture for API calls](https://community.openai.com/t/best-way-to-structure-backend-architecture-for-openai-api-calls/1370575) - LOW confidence
- [AI-LLM PRD](/Users/apple/Desktop/PMF TOOL/prd-trd/ai-llm-prd.md) - HIGH confidence (project source of truth)

---
*Architecture research for: AI-powered PMF diagnostic tool backend*
*Researched: 2026-03-02*
