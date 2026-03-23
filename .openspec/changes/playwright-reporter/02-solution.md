# Solution Design

## Approach
Create an npm package `@practica/test-eyes` that implements Playwright Reporter interface.

## Architecture

```
Customer Repo                          GitHub
─────────────────                      ──────────────
playwright.config.ts
    └── reporter: @practica/test-eyes
            │
            ▼
      ┌─────────────┐
      │  onTestEnd  │  ← Collect test results
      │  onEnd      │  ← Aggregate + push
      └─────────────┘
            │
            ▼
      gh-data branch  ──────────────►  gh-pages (dashboard)
```

## Key Components

1. **Reporter** (`src/reporter.ts`)
   - Implements Playwright Reporter interface
   - Collects test name, duration, status
   - Detects flaky tests (passed on retry → wasFlaky: true)

2. **Aggregation** (`src/aggregate.ts`)
   - Merges new run data with existing
   - Calculates totals, averages, p95, flakyCount

3. **Git Operations** (`src/git-operations.ts`)
   - Switches to gh-data branch
   - Commits and pushes data

4. **Dashboard** (existing frontend)
   - Displays test analytics
   - Shows Flaky column

## Flaky Detection Logic
```typescript
wasFlaky: result.status === 'passed' && result.retry > 0
```
