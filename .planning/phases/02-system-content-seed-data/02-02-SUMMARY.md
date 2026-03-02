---
phase: 02-system-content-seed-data
plan: 02
subsystem: database
tags: [prisma, seed, upsert, idempotent, system-content]

# Dependency graph
requires:
  - phase: 01-foundation-middleware
    provides: "Prisma schema with 5 system content models (ProblemCategory, Question, MicroInsight, PmfFact, SocialProof)"
provides:
  - "Idempotent seed script populating 37 records across 5 system content tables"
  - "prisma db seed integration via package.json"
affects: [02-system-content-seed-data, 03-assessment-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [upsert-with-explicit-ids, prisma-seed-script]

key-files:
  created: [prisma/seed.ts]
  modified: [package.json]

key-decisions:
  - "Used PrismaClient cast pattern from src/db/prisma.ts for Prisma v7 compatibility"
  - "Explicit IDs 1-N for upsert idempotency on tables without natural unique keys"
  - "factText format: title + colon + description matching FE PMF_FACTS exactly"

patterns-established:
  - "Seed idempotency: upsert with explicit IDs for autoincrement tables, upsert with slug for named entities"
  - "Seed imports PrismaClient directly from generated path, never from src/db/prisma.ts"

requirements-completed: [SYS-06]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 2 Plan 02: System Content Seed Data Summary

**Idempotent Prisma seed script populating 37 records across 5 system content tables with exact FE constant data**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T06:39:49Z
- **Completed:** 2026-03-02T06:41:57Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created seed script with upsert operations for all 5 system content tables (5 categories, 5 questions, 15 micro-insights, 6 facts, 6 testimonials)
- All seed data matches FE constants exactly (text, options, metadata)
- Registered prisma.seed in package.json with npm run seed convenience script

## Task Commits

Each task was committed atomically:

1. **Task 1: Create idempotent seed script with all system content** - `7d41c61` (feat)
2. **Task 2: Register seed command in package.json and verify** - `d24fdb5` (chore)

## Files Created/Modified
- `prisma/seed.ts` - Idempotent seed script for 5 system content tables (37 records)
- `package.json` - Added prisma.seed config and npm run seed script

## Decisions Made
- Used PrismaClient type cast pattern (`new (PrismaClient as unknown as new () => PrismaInstance)()`) consistent with src/db/prisma.ts for Prisma v7 compatibility
- Used explicit IDs (1-N) for upsert idempotency on Question, MicroInsight, PmfFact, and SocialProof tables (no natural unique keys)
- Used slug as upsert key for ProblemCategory (has @unique constraint)
- Typed options array explicitly to satisfy Prisma's InputJsonValue type constraints

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PrismaClient v7 constructor signature**
- **Found during:** Task 1 (seed script compilation)
- **Issue:** `new PrismaClient()` fails in Prisma v7 -- constructor expects 1 argument
- **Fix:** Used same cast pattern as src/db/prisma.ts: `new (PrismaClient as unknown as new () => PrismaInstance)()`
- **Files modified:** prisma/seed.ts
- **Verification:** `npx tsc --noEmit --skipLibCheck` passes
- **Committed in:** 7d41c61

**2. [Rule 1 - Bug] Fixed options type for Prisma JSON field**
- **Found during:** Task 1 (seed script compilation)
- **Issue:** `unknown` type for options not assignable to Prisma's `InputJsonValue | NullableJsonNullValueInput`
- **Fix:** Explicitly typed options as `Array<{ id: string; label: string; value: string }> | null`
- **Files modified:** prisma/seed.ts
- **Verification:** `npx tsc --noEmit --skipLibCheck` passes
- **Committed in:** 7d41c61

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed type issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Seed script ready: `npm run seed` or `npx prisma db seed` will populate all system content
- API endpoints from Plan 01 can now return real data once seed is run against the database
- All 37 records match FE constants exactly for frontend/backend data consistency

---
*Phase: 02-system-content-seed-data*
*Completed: 2026-03-02*
