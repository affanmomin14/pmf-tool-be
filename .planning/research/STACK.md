# Technology Stack

**Project:** PMF Insights Tool Backend
**Researched:** 2026-03-02
**Overall confidence:** MEDIUM-HIGH

## Already Installed (Locked In)

These are already in `package.json` and are not up for debate. Documented here for completeness.

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Express | ^5.2.1 | HTTP framework, native async error handling | HIGH (installed) |
| Prisma Client | ^7.4.1 | ORM, typed database access | HIGH (installed) |
| PostgreSQL | latest | Primary database | HIGH (decided) |
| Zod | ^4.3.6 | Input validation, schema definitions | HIGH (installed) |
| Pino | ^10.3.1 | Structured JSON logging | HIGH (installed) |
| pino-http | ^11.0.0 | HTTP request logging middleware | HIGH (installed) |
| Helmet | ^8.1.0 | Security headers | HIGH (installed) |
| CORS | ^2.8.6 | Cross-origin resource sharing | HIGH (installed) |
| dotenv | ^17.3.1 | Environment variable loading | HIGH (installed) |
| TypeScript | ^5.9.3 | Type safety | HIGH (installed) |
| ts-node-dev | ^2.0.0 | Dev server with hot reload | HIGH (installed) |

## Recommended Stack -- Complementary Libraries

### AI / LLM Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| openai | ^6.25.0 | OpenAI API client (GPT-4o, web search) | Official SDK, TypeScript-first, supports both Chat Completions and new Responses API. Use Responses API for new code -- 3-5% better reasoning with GPT-4o/5, built-in web search tool, structured outputs via `text.format`. | HIGH |

**Critical decision: Responses API vs Chat Completions**

Use the **Responses API** (not Chat Completions) because:
1. It is OpenAI's recommended API for all new projects as of 2025
2. Built-in web search tool eliminates need for separate search API (Serper, etc.)
3. Better structured output support via `text.format` parameter
4. 3-5% better model intelligence on reasoning benchmarks vs Chat Completions with same prompts
5. Chat Completions will not be deprecated but Responses is the investment path forward
6. Assistants API deadline is August 2026 -- starting with Responses avoids future migration

**Structured outputs with Zod 4 caveat:** The OpenAI SDK uses `zodResponseFormat` to convert Zod schemas to JSON Schema. Known limitation: `.optional()` fields must also be `.nullable()` for OpenAI compatibility. All report JSON schemas should use `.nullable()` instead of plain `.optional()`.

Source: [OpenAI Responses vs Chat Completions](https://platform.openai.com/docs/guides/responses-vs-chat-completions), [Structured Outputs Guide](https://developers.openai.com/api/docs/guides/structured-outputs/) -- MEDIUM confidence (verified via multiple official sources, but Zod 4 specifically may have edge cases vs Zod 3 which was the original integration target)

### Rate Limiting

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| express-rate-limit | ^8.2.1 | Per-endpoint IP-based rate limiting | 16M+ weekly downloads, built-in memory store sufficient for single-server, Express middleware pattern, TypeScript support. No Redis dependency needed for this project's scale. | HIGH |

**Configuration approach:** Create per-route limiters (generous for content endpoints, strict for AI pipeline endpoints which are expensive). The built-in `MemoryStore` is fine -- this is a single-server app, not a distributed cluster.

Do NOT use: `rate-limiter-flexible` (overkill, requires Redis for features this project does not need), custom middleware (reinventing the wheel).

Source: [express-rate-limit npm](https://www.npmjs.com/package/express-rate-limit) -- HIGH confidence

### PDF Generation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| puppeteer | ^24.37.5 | HTML-to-PDF with full CSS control | Full Chromium rendering gives consulting-quality PDF layout. Supports @page CSS, headers/footers, custom fonts, and print media queries. The `page.pdf()` method is battle-tested. | HIGH |

**Important operational notes:**
- Puppeteer downloads a Chromium binary (~280MB) on `npm install`. Set `PUPPETEER_CACHE_DIR` in CI/deployment.
- For PDF generation, launch browser once and reuse across requests (do NOT launch per-request -- 2-3 second cold start penalty each time).
- Use `puppeteer-core` in production if you want to manage the Chrome binary separately (e.g., Docker with pre-installed Chrome).
- Memory: each Chromium page uses ~30-50MB RAM. Close pages after PDF generation.

Do NOT use: `pdfkit` (no HTML/CSS support, imperative API), `html-pdf` (deprecated, uses PhantomJS), `jspdf` (client-side oriented), `puppeteer-html-pdf` (stale wrapper, 2 years since last publish).

Source: [Puppeteer PDF Guide](https://pptr.dev/guides/pdf-generation) -- HIGH confidence

### Email Delivery

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| resend | ^6.9.3 | Transactional email delivery with PDF attachment | Modern API, excellent DX, simple `emails.send()` with attachment support. Supports HTML emails and file attachments (for PDF reports). Free tier: 3,000 emails/month (sufficient for early stage). | HIGH |

**Usage pattern:**
```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'PMF Insights <reports@yourdomain.com>',
  to: email,
  subject: 'Your PMF Diagnostic Report',
  html: emailTemplate,
  attachments: [{ filename: 'pmf-report.pdf', content: pdfBuffer }],
});
```

**Requires:** Verified sending domain in Resend dashboard.

Do NOT use: `nodemailer` (SMTP complexity, requires mail server config), `sendgrid` (heavier SDK, enterprise-oriented pricing), `AWS SES` (over-engineered for this use case).

Source: [Resend Node.js docs](https://resend.com/docs/send-with-nodejs), [npm](https://www.npmjs.com/package/resend) -- HIGH confidence

### Unique ID Generation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| nanoid | ^3.3.11 | URL-friendly unique IDs for report tokens | Secure, URL-safe, tiny. **Must use v3.x** because nanoid v4+ and v5 are ESM-only and this project uses CommonJS (`"type": "commonjs"` in package.json, `"module": "CommonJS"` in tsconfig). v3 still supported by maintainer. | HIGH |

**CRITICAL:** Do NOT install nanoid v4 or v5. They will fail with `require()` in a CommonJS project. Stick with `nanoid@3`.

Alternative if you later migrate to ESM: upgrade to nanoid ^5.1.6.

Source: [nanoid GitHub](https://github.com/ai/nanoid), [CommonJS issue](https://github.com/ai/nanoid/issues/365) -- HIGH confidence

### Caching (Research Cache with 7-day TTL)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| node-cache | ^5.1.2 | In-process cache for research results | No external dependency (no Redis needed), built-in TTL support, simple get/set/del API. For a single-server tool with category-keyed research cache, in-process caching is sufficient and eliminates Redis operational overhead. | MEDIUM |

**Why not Redis:** This is a single-server application without clustering needs. The research cache is keyed by `category + sub_category` with 7-day TTL. The dataset is small (maybe hundreds of entries). Adding Redis means another service to deploy, monitor, and maintain. `node-cache` stores in process memory with automatic TTL expiration.

**Caveat:** Cache is lost on server restart. For a 7-day TTL research cache, this means some cold-start penalty after deploys. Acceptable for this use case -- research will be re-fetched and cached again on first request per category.

**Upgrade path:** If the app later needs multiple servers or persistent cache, swap `node-cache` for Redis (`ioredis@^5.10.0`) with minimal code changes (same get/set/TTL pattern).

Do NOT use: Redis/ioredis (operational overhead not justified at this scale), `lru-cache` (LRU eviction not needed -- TTL-based expiration is the requirement).

Source: [node-cache npm](https://www.npmjs.com/package/node-cache) -- MEDIUM confidence (training data for latest version, verified API pattern via multiple sources)

### Hashing (IP Anonymization)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js crypto (built-in) | N/A | SHA-256 hashing of IP addresses | Built into Node.js, zero dependencies. `crypto.createHash('sha256').update(ip).digest('hex')`. No library needed. | HIGH |

Do NOT use: `bcrypt` (designed for passwords, slow by design -- overkill for IP hashing), `md5` (insecure), any npm hash library (unnecessary dependency).

### HTTP Client (for any external API calls beyond OpenAI)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js fetch (built-in) | N/A | HTTP client for any non-OpenAI external calls | Built into Node.js 18+. No library needed. The OpenAI SDK handles its own HTTP. | HIGH |

Do NOT use: `axios` (unnecessary dependency when built-in fetch exists), `node-fetch` (polyfill for older Node, not needed on Node 18+), `got` (ESM-only since v12).

### MX Validation (Email Gate)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js dns (built-in) | N/A | MX record validation for email addresses | `dns.promises.resolveMx(domain)` is built into Node.js. Validates that the email domain has mail servers. Combine with Zod email format validation. | HIGH |

Do NOT use: `email-validator` npm packages (most just do regex, not MX lookup), `mailgun-validate` (paid API call per validation).

**Pattern:**
```typescript
import { promises as dns } from 'dns';

async function validateEmailMx(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}
```

## Dev Dependencies to Add

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @types/node-cache | N/A | Types for node-cache | TypeScript support (check if node-cache ships its own types first) | LOW |
| pino-pretty | ^13.1.3 | Human-readable dev logs | Pino outputs JSON by default, pino-pretty makes dev logs readable. Use only in dev: `pino-http \| pino-pretty` | MEDIUM |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| AI SDK | openai (official) | @ai-sdk/openai (Vercel AI SDK) | Extra abstraction layer not needed; direct SDK gives full control over Responses API, structured outputs, and token tracking |
| Rate Limiting | express-rate-limit | rate-limiter-flexible | Requires Redis for distributed features; overkill for single-server |
| PDF | puppeteer | @react-pdf/renderer | Requires React rendering pipeline; HTML/CSS is simpler for server-side |
| PDF | puppeteer | pdfkit | No HTML/CSS support; imperative API is painful for complex layouts |
| Email | resend | nodemailer | SMTP configuration complexity; Resend is API-first |
| Email | resend | @sendgrid/mail | Heavier SDK, enterprise pricing, more config |
| Cache | node-cache | ioredis + Redis | External dependency not justified at current scale |
| Cache | node-cache | Map + setTimeout | No TTL management, manual cleanup, memory leak risk |
| IDs | nanoid v3 | uuid | Longer strings (36 chars vs ~21), not URL-friendly |
| IDs | nanoid v3 | cuid2 | ESM-only since v2, same CommonJS problem |

## Installation

```bash
# Core dependencies to add
npm install openai@^6.25.0 express-rate-limit@^8.2.1 puppeteer@^24.37.5 resend@^6.9.3 nanoid@^3.3.11 node-cache@^5.1.2

# Dev dependencies to add
npm install -D pino-pretty@^13.1.3
```

**Note on puppeteer install:** First install will download Chromium (~280MB). In Docker/CI, consider using `puppeteer-core` and installing Chrome separately for smaller image size.

## Architecture Implications

### OpenAI Responses API Integration Pattern

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Structured output with Responses API
const response = await openai.responses.create({
  model: 'gpt-4o',
  input: [{ role: 'user', content: prompt }],
  text: {
    format: {
      type: 'json_schema',
      name: 'report_section',
      schema: reportSectionJsonSchema, // Convert Zod schema to JSON Schema
    },
  },
});

// Web search via Responses API (for research pipeline)
const researchResponse = await openai.responses.create({
  model: 'gpt-4o',
  tools: [{ type: 'web_search_preview' }],
  input: 'Find competitors for [category] in [market]',
});
```

### Zod 4 + OpenAI Structured Outputs Compatibility

Zod 4 is installed in this project. The OpenAI SDK's `zodResponseFormat` helper was built for Zod 3. Key considerations:

1. **Test early**: Verify `zodResponseFormat` works with Zod 4 schemas during the first AI integration phase
2. **Fallback**: If incompatible, manually convert Zod 4 schemas to JSON Schema using `zod-to-json-schema` and pass raw JSON Schema to the `text.format` parameter
3. **Schema rules for OpenAI**: All properties must be `required` in the JSON Schema. Use `.nullable()` instead of `.optional()`. No `oneOf`/`anyOf` at top level.

### Token Tracking Pattern

Every OpenAI call must log token usage for cost control:

```typescript
// response.usage contains:
// { input_tokens, output_tokens, total_tokens }
// Log these to analytics_events table with cost calculation
```

## Version Verification Notes

| Package | Claimed Version | Verification Method | Status |
|---------|----------------|---------------------|--------|
| openai | ^6.25.0 | npm search result (published 5 days ago) | Verified |
| express-rate-limit | ^8.2.1 | npm search result (16M weekly downloads) | Verified |
| puppeteer | ^24.37.5 | npm search result (published 10 days ago) | Verified |
| resend | ^6.9.3 | npm search result (published 2 days ago) | Verified |
| nanoid | ^3.3.11 | npm info nanoid@3 version -- confirmed latest v3 | Verified |
| node-cache | ^5.1.2 | npm info node-cache version -- confirmed | Verified |
| pino-pretty | ^13.1.3 | npm info pino-pretty version -- confirmed | Verified |

## Sources

- [OpenAI Responses API migration guide](https://platform.openai.com/docs/guides/migrate-to-responses) -- Official docs
- [OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs/) -- Official docs
- [OpenAI Node.js SDK releases](https://github.com/openai/openai-node/releases) -- Official GitHub
- [express-rate-limit npm](https://www.npmjs.com/package/express-rate-limit) -- npm registry
- [Puppeteer PDF generation guide](https://pptr.dev/guides/pdf-generation) -- Official docs
- [Resend Node.js docs](https://resend.com/docs/send-with-nodejs) -- Official docs
- [nanoid GitHub (CJS compatibility)](https://github.com/ai/nanoid) -- Official GitHub
- [node-cache npm](https://www.npmjs.com/package/node-cache) -- npm registry
- [Zod 4 + OpenAI compatibility discussion](https://community.openai.com/t/structured-outputs-example-broken-node-js-triggering-zod-version-discovered/1338894) -- Community forum
