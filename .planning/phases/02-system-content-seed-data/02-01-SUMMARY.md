---
phase: 02-system-content-seed-data
plan: 01
subsystem: system-content-api
tags: [api, prisma, express, read-only]
dependency_graph:
  requires: [prisma-client, express-app, validate-middleware, error-classes]
  provides: [system-content-endpoints, system-service-layer]
  affects: [frontend-api-integration]
tech_stack:
  added: []
  patterns: [service-controller-router, select-projection, success-envelope]
key_files:
  created:
    - src/services/system.service.ts
    - src/controllers/system.controller.ts
    - src/routes/system.routes.ts
  modified:
    - src/app.ts
decisions:
  - Service functions return Prisma select projections (no full model exposure)
  - Controller handlers use { success: true, data } envelope consistently
  - Facts endpoint uses optional query param filtering; micro-insights uses route param
metrics:
  duration: 1 min
  completed: 2026-03-02T06:40:50Z
---

# Phase 2 Plan 1: System Content API Summary

Read-only API layer serving 5 system content types (questions, categories, facts, social proof, micro-insights) via Prisma queries with select projections and consistent response envelopes.

## What Was Built

### Service Layer (src/services/system.service.ts)
- `getActiveQuestions()` -- active questions ordered by displayOrder with type, placeholder, options
- `getActiveCategories()` -- active categories with usage counts ordered by displayOrder
- `getActiveFacts(location?)` -- active facts with optional displayLocation filter
- `getActiveSocialProof()` -- active social proof ordered by displayOrder
- `getMicroInsightsByQuestion(questionId)` -- active insights for a specific question

### Controller Layer (src/controllers/system.controller.ts)
- 5 async handlers wrapping service calls, returning `{ success: true, data }` envelope

### Router (src/routes/system.routes.ts)
- `GET /api/system/questions` -- no validation needed
- `GET /api/system/categories` -- no validation needed
- `GET /api/system/facts?location=` -- Zod query validation (optional string)
- `GET /api/system/social-proof` -- no validation needed
- `GET /api/system/micro-insights/:questionId` -- Zod params validation (coerce to positive int)

### App Mount (src/app.ts)
- `app.use('/api/system', systemRoutes)` mounted before error handler

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 7dbd84f | Service and controller with 5 query functions and 5 handlers |
| 2 | 25b9ec5 | Router with validation and app.ts mount |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- Full project `tsc --noEmit` passes clean
- Service exports 5 functions with proper select/where/orderBy
- Controller exports 5 handlers with success envelope
- Router has 5 GET routes with appropriate validation
- App.ts mounts systemRoutes at /api/system

## Self-Check: PASSED

- All 3 created files exist on disk
- Both commits (7dbd84f, 25b9ec5) verified in git log
