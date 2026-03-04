# PMF Insights — Backend

Express 5 + Prisma 7 + PostgreSQL + OpenAI backend powering the PMF Insights diagnostic tool. Founders answer 5 questions, and the system classifies answers via GPT-4o, researches competitors and market data via web search, computes a deterministic 7-dimension PMF score, generates a structured 9-section report, validates against hallucination, and delivers consulting-quality PDF reports via email.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express 5 (native async error handling)
- **ORM:** Prisma 7 with PostgreSQL (Supabase-compatible via `@prisma/adapter-pg`)
- **AI:** OpenAI GPT-4o (chat completions + Responses API with web search)
- **PDF:** Puppeteer (HTML-to-PDF rendering)
- **Email:** Resend (PDF attachment delivery)
- **Validation:** Zod v4
- **Logging:** Pino + pino-http

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in DATABASE_URL, OPENAI_API_KEY, RESEND_API_KEY, etc.

# Generate Prisma client
npm run prisma generate

# Run migrations
npm run prisma migrate deploy

# Seed system content
npm run seed

# Run dev server
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4o |
| `RESEND_API_KEY` | Yes | Resend API key for email delivery |
| `DAILY_SPEND_LIMIT` | Yes | Hard cap on daily OpenAI spend (USD) |
| `PORT` | No | Server port (default: `3001`) |

## Project Structure

```
src/
├── app.ts                  # Express app setup (middleware, routes, error handler)
├── server.ts               # HTTP server bootstrap
├── index.ts                # Entry point
├── config/
│   ├── env.ts              # Environment variable validation
│   ├── logger.ts           # Pino logger setup
│   ├── openai.ts           # OpenAI client + callOpenAI / callOpenAIWebSearch wrappers
│   ├── puppeteer.ts        # Puppeteer singleton for PDF generation
│   └── resend.ts           # Resend email client
├── controllers/
│   ├── assessment.controller.ts   # Assessment CRUD + response submission
│   ├── lead.controller.ts         # Email capture (MX validation)
│   ├── report.controller.ts       # Report access + PDF email delivery
│   └── system.controller.ts       # System content endpoints
├── services/
│   ├── ai.service.ts              # GPT-4o report generation (structured JSON)
│   ├── assessment.service.ts      # Assessment lifecycle management
│   ├── classification.service.ts  # AI answer classification with confidence scoring
│   ├── email.service.ts           # Email delivery via Resend
│   ├── hallucination.service.ts   # 5-check hallucination validation
│   ├── lead.service.ts            # Lead creation + MX validation
│   ├── pdf.service.ts             # HTML-to-PDF via Puppeteer
│   ├── pipeline.service.ts        # Full pipeline orchestrator (classify → research → score → report)
│   ├── report.access.service.ts   # Token-based report access control
│   ├── report.service.ts          # Report storage + retrieval
│   ├── research.service.ts        # 4-dimension web research with 7-day cache
│   ├── scoring.service.ts         # 7-dimension deterministic scoring engine
│   └── system.service.ts          # System content + question management
├── routes/                 # Express route definitions
├── middlewares/
│   ├── error.middleware.ts        # Global error handler
│   ├── requestLogger.middleware.ts # Request logging
│   └── validate.middleware.ts     # Zod request validation
├── schemas/                # Zod validation schemas
├── templates/
│   ├── report-pdf.ts       # HTML template for PDF report
│   └── report-email.ts     # HTML template for email delivery
├── db/
│   └── prisma.ts           # Prisma client singleton
├── errors/                 # Custom error classes
└── utils/
    ├── hash.ts             # Hashing utilities
    ├── sanitize.ts         # Input sanitization
    └── token.ts            # Secure token generation
```

## API Endpoints

### Assessment Flow
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/assessments` | Create new assessment session |
| `POST` | `/api/assessments/:id/responses` | Submit answer to a question |
| `POST` | `/api/assessments/:id/complete` | Run full pipeline (classify → research → score → report) |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/reports/:token` | Get report by access token |
| `POST` | `/api/reports/:token/email` | Email PDF report to user |

### Leads
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/leads` | Submit email to unlock report |

### System
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/system/questions` | Get assessment questions |
| `GET` | `/api/system/content` | Get system content |

## Pipeline Architecture

```
User answers 5 questions
        ↓
Classification (GPT-4o) — parse & classify with confidence scoring
        ↓
Research (OpenAI web search) — competitors, market data, category complaints, trends
        ↓
Scoring (deterministic) — 7 dimensions computed in code (not LLM)
        ↓
Report Generation (GPT-4o) — structured 9-section JSON report
        ↓
Hallucination Validation — number extraction, company verification, score consistency, banned words
        ↓
PDF Generation (Puppeteer) — consulting-quality HTML-to-PDF
        ↓
Email Delivery (Resend) — PDF attachment to user
```

## Scripts

```bash
npm run dev       # Development server (ts-node-dev with hot reload)
npm run build     # TypeScript compilation
npm run start     # Start production server
npm run prisma    # Prisma CLI passthrough
npm run seed      # Seed system content
```
