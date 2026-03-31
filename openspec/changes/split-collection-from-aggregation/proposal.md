## Why

The current architecture does collection + aggregation in one shot. This causes two problems:
1. **Race conditions with sharding** — concurrent pushes to `gh-data` branch from parallel shards can conflict
2. **Fake p95 stats** — durations are reconstructed from averages (`Array(n).fill(avgDuration)`), so p95 always equals average

Splitting collection from aggregation fixes both: each shard pushes only its run file (no conflicts), and aggregation stores real durations for accurate p95.

## What Changes

- **Collection phase** — Reporter writes a single run file to `data/runs/` and pushes. No aggregation, no stats update.
- **Aggregation phase** — Cron job reads all run files, appends to `test-history.json` (source of truth with real durations), derives `test-summary.json` (stats for frontend).
- **BREAKING**: `main-test-data.json` renamed to `test-summary.json`
- **BREAKING**: `processedFiles` tracking removed from `AggregatedMeta`
- **BREAKING**: Run files now written to `data/runs/` subdirectory instead of `data/`
- New retry logic for push conflicts (3 retries with rebase)
- Random suffix in filenames to prevent shard collisions

## Capabilities

### New Capabilities
- `test-history`: New data structure storing last 200 raw executions per test with real durations. Source of truth for aggregation.
- `inbox-pattern`: Run files in `data/runs/` as inbox — written by collectors, deleted after aggregation.

### Modified Capabilities
- `collection`: Simplified to only write run file and push. No aggregation.
- `aggregation`: Rewritten to ingest run files into history, then derive summary. Real p95 calculation.

## Impact

**Files to change:**
- `apps/test-processing/src/types.ts` — new types, remove `processedFiles`
- `apps/test-processing/src/git-operations.ts` — add `fetchTestHistory()`, `pushWithRetry()`
- `apps/test-processing/src/file-operations.ts` — add `deleteFile()`, `saveTestHistory()`, random suffix
- `apps/test-processing/src/aggregate.ts` — full rewrite
- `apps/test-processing/src/collector.ts` — simplify, remove aggregation
- `apps/frontend/src/hooks/useTestData.ts` — update fetch URL
- `.github/workflows/aggregate-and-deploy.yml` — add concurrency, update steps
- All tests — rewrite for new architecture

**APIs affected:**
- `collectFromRunData()` — simplified signature and behavior
- `aggregate()` → `aggregateAndSummarize()` — new function signature

**Data migration:**
- Existing `data/*.json` files ignored (fresh start)
- Existing `main-test-data.json` → `test-summary.json` (manual rename or regenerate)
