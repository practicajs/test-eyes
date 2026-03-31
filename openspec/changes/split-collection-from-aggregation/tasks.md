## 1. Types and Interfaces

- [x] 1.1 Add `TestHistory` interface to `types.ts`
- [x] 1.2 Add `RecentExecution` interface to `types.ts`
- [x] 1.3 Add `failureMessage?: string` to `TestResult` interface
- [x] 1.4 Remove `processedFiles` from `AggregatedMeta`
- [x] 1.5 Remove `totalRuns` from `AggregatedMeta`

## 2. File Operations

- [x] 2.1 Add `deleteFile()` function to `file-operations.ts`
- [x] 2.2 Add `saveTestHistory()` function to `file-operations.ts`
- [x] 2.3 Update `generateTestDataFilename()` to include 4-char random suffix
- [x] 2.4 Remove `findUnprocessedFiles()` function (no longer needed)

## 3. Git Operations

- [x] 3.1 Add `fetchTestHistory()` function to `git-operations.ts`
- [x] 3.2 Add `pushWithRetry()` function with 3 retries and rebase

## 4. Aggregation Rewrite

- [x] 4.1 Add `deriveStats()` function that calculates stats from executions array
- [x] 4.2 Add `ingestRunFiles()` function that appends run data to history
- [x] 4.3 Rewrite main `aggregate()` to new `aggregateAndSummarize()` function
- [x] 4.4 Keep `calculateP95()`, `calculateAverage()`, `isValidRunData()` unchanged
- [x] 4.5 Remove `processTestRun()`, `recalculateStats()`, `createEmptyStats()` functions
- [x] 4.6 Remove the `Array(n).fill(avg)` duration hack

## 5. Collector Simplification

- [x] 5.1 Update `collectFromRunData()` to write run file to `data/runs/`
- [x] 5.2 Remove aggregation call from `collectFromRunData()`
- [x] 5.3 Use `pushWithRetry()` instead of `push()`
- [x] 5.4 Update return type to not include aggregation results

## 6. Exports and Index

- [x] 6.1 Export `TestHistory` and `RecentExecution` from `index.ts`
- [x] 6.2 Export `fetchTestHistory` from `index.ts`
- [x] 6.3 Export `aggregateAndSummarize` from `index.ts`

## 7. File Renaming

- [x] 7.1 Update `fetchAggregatedData()` default path to `data/test-summary.json`
- [x] 7.2 Update `git-operations.ts` EMPTY_AGGREGATED_DATA constant
- [x] 7.3 Update frontend `useTestData.ts` fetch URL to `test-summary.json`
- [x] 7.4 Update `deploy.ts` to use `test-summary.json`
- [x] 7.5 Update frontend types to match new `AggregatedMeta`

## 8. Workflow Updates

- [x] 8.1 Add concurrency group to `aggregate-and-deploy.yml`
- [x] 8.2 Update aggregation step to call `aggregateAndSummarize()`

## 9. Test Factories

- [x] 9.1 Create `makeRunFile()` factory function in `tests/flow/factories.ts`
- [x] 9.2 Create `makeHistoryEntry()` factory function

## 10. Collection Flow Tests

- [x] 10.1 Test: Passed tests are recorded
- [x] 10.2 Test: Failed test is recorded
- [x] 10.3 Test: Flaky test detected
- [x] 10.4 Test: Multiple tests with mixed results
- [x] 10.5 Test: Skipped test recorded
- [x] 10.6 Test: Not in CI — nothing pushed
- [x] 10.7 Test: Retry uses last attempt duration

## 11. Aggregation Flow Tests

- [x] 11.1 Test: Single run, single test
- [x] 11.2 Test: Multiple run files processed
- [x] 11.3 Test: New runs append to existing history
- [x] 11.4 Test: History capped at 200
- [x] 11.5 Test: p95 from real durations
- [x] 11.6 Test: Mixed pass/fail/flaky counts
- [x] 11.7 Test: New test added to history
- [x] 11.8 Test: Unmentioned test preserved
- [x] 11.9 Test: Run files deleted after processing
- [x] 11.10 Test: No run files — nothing changes

## 12. Cleanup

- [x] 12.1 Remove old test files that test deprecated behavior
- [x] 12.2 Update any remaining references to `main-test-data.json`
- [x] 12.3 Run full test suite and fix any failures
