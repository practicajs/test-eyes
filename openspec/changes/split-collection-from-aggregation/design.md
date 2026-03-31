## Context

**Current state:** The Playwright reporter calls `collectFromRunData()` which does collection + aggregation + push in one operation. This works for single CI runs but fails with sharding (multiple parallel pushes to `gh-data` branch cause conflicts).

**Constraint:** p95 calculation is broken — durations are faked from averages (`Array(n).fill(avgDuration)`), making p95 === average always.

**Stakeholders:** Users with Playwright projects who want test analytics dashboards.

## Goals / Non-Goals

**Goals:**
- Split collection (per-shard) from aggregation (cron job)
- Fix p95 by storing real durations in `test-history.json`
- Support parallel shards without git conflicts
- Simplify the codebase by removing `processedFiles` tracking

**Non-Goals:**
- Backwards compatibility with existing `data/*.json` files (fresh start)
- JUnit collector changes (focus on Playwright reporter)
- Frontend changes beyond updating the data file URL
- PR comment bot integration (out of scope)

## Decisions

### 1. Two-phase architecture

**Decision:** Split into Collection phase (reporter) and Aggregation phase (cron).

**Rationale:**
- Collection runs after every test suite — must be fast, conflict-free
- Aggregation runs on cron (every 6 hours) — can do heavy processing
- Shards don't compete because each writes a unique file

**Alternatives considered:**
- Locking mechanism for concurrent pushes → Too complex, git doesn't support locking well
- Merge strategy for conflicts → Unreliable, data could be lost

### 2. Inbox pattern for run files

**Decision:** Run files written to `data/runs/`, deleted after aggregation.

**Rationale:**
- Clear separation: inbox (temporary) vs history (persistent)
- No need for `processedFiles` tracking — file existence = unprocessed
- Easy to debug: look at `data/runs/` to see what's pending

**Alternatives considered:**
- Keep `processedFiles` array → Grows unbounded, complicates logic
- Move files to `data/processed/` → Extra complexity, no benefit

### 3. Random suffix in filenames

**Decision:** Filename format: `<date>_<sha>_<random>.json` with 4-char hex suffix.

**Rationale:**
- Two shards with same commit and millisecond timestamp won't collide
- `Date.now()` alone is not sufficient for parallel execution

**Alternatives considered:**
- Use `GITHUB_RUN_ID` + shard index → Not available in all environments
- UUID → Overkill, 4-char hex is sufficient

### 4. test-history.json as source of truth

**Decision:** Store last 200 raw executions per test in `test-history.json`.

**Rationale:**
- Real durations enable accurate p95 calculation
- 200 cap prevents unbounded growth (~20MB for 1000 tests)
- Summarizer derives `test-summary.json` as pure function of history

**Alternatives considered:**
- Store all executions → Unbounded growth
- Time-based cap (30 days) → Inconsistent data density across tests
- Store only aggregated stats → Can't fix p95 bug

### 5. Retry with rebase for push conflicts

**Decision:** 3 retries with `git pull --rebase` between attempts.

**Rationale:**
- Unique filenames mean rebase always succeeds (no actual conflicts)
- 3 retries handles transient issues without hanging

**Alternatives considered:**
- Single push, fail on conflict → Too fragile for CI
- Force push → Dangerous, could overwrite others' data

### 6. Concurrency group for aggregation workflow

**Decision:** Add `concurrency: { group: test-eyes-aggregate, cancel-in-progress: false }`.

**Rationale:**
- Prevents two cron runs from overlapping
- `cancel-in-progress: false` ensures running job completes (no data loss)

## Risks / Trade-offs

**[Risk] Aggregation fails mid-process → data loss**
→ Mitigation: Delete run files only after successful commit/push. Collect files to delete, delete at the end.

**[Risk] test-history.json grows too large**
→ Mitigation: 200 cap per test. For 1000 tests × 200 entries × ~100 bytes = ~20MB, acceptable.

**[Risk] Deleted/renamed tests stay in history forever**
→ Accepted trade-off: Manual cleanup if needed. Not worth the complexity to auto-prune.

**[Risk] totalRuns capped at 200 in summary**
→ Accepted trade-off: Dashboard shows "ran 200 times" even if test ran 500 times. Accurate enough for analytics.

**[Trade-off] No backwards compatibility**
→ Accepted: Fresh start is simpler. No migration path needed since no production users yet.

## Migration Plan

**Deployment steps:**
1. Merge all code changes
2. Delete existing `data/*.json` on `gh-data` branch (fresh start)
3. Create `data/runs/` directory
4. Run tests to generate new run files
5. Trigger aggregation workflow manually
6. Verify dashboard loads `test-summary.json`

**Rollback:**
- Revert to previous commit
- Existing data is lost anyway (fresh start), so no data rollback needed

## Open Questions

None — architecture plan v2 addresses all questions.
