---
phase: 01-foundation-middleware
plan: 02
subsystem: core-config-utilities
tags: [env-validation, singletons, error-handling, utilities]
dependency_graph:
  requires: []
  provides: [env, openai-client, logger, prisma-client, error-classes, token-gen, sanitize, hash-ip]
  affects: [all-services, all-middleware]
tech_stack:
  added: [openai, nanoid@3, pino-pretty]
  patterns: [zod-env-validation, singleton-clients, graceful-shutdown, error-hierarchy]
key_files:
  created:
    - src/config/env.ts
    - src/config/openai.ts
    - src/config/logger.ts
    - src/db/prisma.ts
    - src/errors/index.ts
    - src/utils/token.ts
    - src/utils/sanitize.ts
    - src/utils/hash.ts
  modified:
    - src/index.ts
    - src/server.ts
    - tsconfig.json
    - package.json
decisions:
  - Zod v4 import via zod/v4 path (project uses zod 4.3.6)
  - Prisma v7 client instantiated without constructor args (datasource URL from prisma.config.ts)
  - nanoid v3 chosen over v4+ for CommonJS compatibility
metrics:
  duration: 186s
  completed: 2026-03-02
---

# Phase 01 Plan 02: Environment Validation, Singletons & Utilities Summary

Zod-validated env config with fail-fast, OpenAI/Prisma/Pino singletons, error class hierarchy, and nanoid/sanitize/hash utilities

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Environment validation, client singletons, and Pino logger | 9df3c28 | src/config/env.ts, src/config/openai.ts, src/config/logger.ts, src/db/prisma.ts |
| 2 | Custom error classes and utility functions | eb94951 | src/errors/index.ts, src/utils/token.ts, src/utils/sanitize.ts, src/utils/hash.ts |

## What Was Built

### Environment Validation (src/config/env.ts)
Zod v4 schema validates all env vars at startup. Missing DATABASE_URL or OPENAI_API_KEY causes immediate process.exit(1) with clear error messages. Exports typed `env` object used throughout the app.

### Client Singletons
- **OpenAI** (src/config/openai.ts): Configured from env.OPENAI_API_KEY
- **Prisma** (src/db/prisma.ts): Singleton with globalThis caching for dev hot-reload, graceful shutdown on SIGTERM/SIGINT
- **Pino Logger** (src/config/logger.ts): pino-pretty transport in development, JSON in production, level from env.LOG_LEVEL

### Error Classes (src/errors/index.ts)
AppError base class with: ValidationError (400), NotFoundError (404), RateLimitError (429), AIError (502)

### Utility Functions
- **generateToken** (src/utils/token.ts): 21-char URL-safe nanoid tokens
- **sanitizeInput** (src/utils/sanitize.ts): Strips HTML, trims, truncates to 500 chars, handles null/undefined
- **hashIp** (src/utils/hash.ts): Salted SHA-256 hex digest for IP anonymization

### Boot Sequence (src/index.ts)
Import order: dotenv/config -> config/env (fail-fast validation) -> server (starts listening)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsconfig.json missing include/exclude**
- **Found during:** Task 1 verification
- **Issue:** prisma.config.ts at project root caused TS6059 error (file outside rootDir)
- **Fix:** Added `"include": ["src"]` and `"exclude": ["node_modules", "dist"]` to tsconfig.json
- **Commit:** 9df3c28

**2. [Rule 3 - Blocking] Prisma v7 import path and constructor**
- **Found during:** Task 1 verification
- **Issue:** Prisma v7 generates to client.ts (no index.ts), and constructor requires adapter/accelerateUrl union type
- **Fix:** Import from `../generated/prisma/client`, instantiate with type cast since v7 reads datasource from prisma.config.ts
- **Commit:** 9df3c28

## Decisions Made

1. Used `zod/v4` import path since project has zod 4.3.6 installed
2. Prisma v7 client constructed without connection args -- datasource URL comes from prisma.config.ts at runtime
3. nanoid v3.3.11 used (v4+ is ESM-only, incompatible with CommonJS module setting)
