## 1. Core Infrastructure (test-processing)

- [x] 1.1 Add `PushToGitHubOptions` interface to `apps/test-processing/src/types.ts`
- [x] 1.2 Add `pushToGitHub()` function to `apps/test-processing/src/git-operations.ts`
- [x] 1.3 Add `CollectFromRunDataOptions` interface to `apps/test-processing/src/types.ts`
- [x] 1.4 Add `retries?: number` field to TestResult interface in `apps/test-processing/src/types.ts`
- [x] 1.5 Rename `wasFlaky` to `isFlaky` in TestResult interface (or keep wasFlaky if preferred)
- [x] 1.6 Create `collectFromRunData()` function in `apps/test-processing/src/collector.ts`
- [x] 1.7 Export `collectFromRunData`, `pushToGitHub`, and types from `apps/test-processing/src/index.ts`

## 2. Fix Playwright Reporter

- [x] 2.1 Refactor `onTestEnd()` to collect attempts by test ID using Map
- [x] 2.2 Refactor `onEnd()` to use `test.outcome()` for final status determination
- [x] 2.3 Emit exactly one TestResult per logical test in `onEnd()`
- [x] 2.4 Add `retries` field to emitted TestResult (attempts.length - 1)
- [x] 2.5 Add dependency on test-processing in `collectors/playwright-reporter/package.json`
- [x] 2.6 Import and use `collectFromRunData` from test-processing
- [x] 2.7 Delete `collectors/playwright-reporter/src/aggregate.ts`
- [x] 2.8 Delete `collectors/playwright-reporter/src/git-operations.ts`
- [x] 2.9 Delete `collectors/playwright-reporter/src/file-operations.ts`
- [x] 2.10 Delete `collectors/playwright-reporter/src/deploy.ts`
- [x] 2.11 Delete `collectors/playwright-reporter/src/cli.ts`

## 3. Create JUnit Collector

- [x] 3.1 Create `collectors/junit/package.json`
- [x] 3.2 Create `collectors/junit/tsconfig.json`
- [x] 3.3 Create `collectors/junit/src/collect.ts` with `collectFromJUnit()` function
- [x] 3.4 Create `collectors/junit/src/cli.ts` with CLI entry point
- [x] 3.5 Update `pnpm-workspace.yaml` to include `collectors/*` (already included)

## 4. Flow Tests

- [x] 4.1 Create `collectors/playwright-reporter/src/tests/factories.ts` with `makePlaywrightTestCase()` and `makePlaywrightResult()`
- [x] 4.2 Create `collectors/playwright-reporter/src/tests/reporter.test.ts`
- [x] 4.3 Implement test: "When 2 of 4 test attempts fail then pass, the test is marked as flaky with correct retry count"
- [x] 4.4 Implement test: "When a test is consistently slow, aggregated stats reflect high duration"
- [x] 4.5 Implement test: "When mixing passed, failed, and flaky tests in one run, each gets the correct status and counts"
- [x] 4.6 Implement test: "When multiple runs are aggregated, flakyCount accumulates across runs"

## 5. Cleanup Old Tests

- [x] 5.1 Delete `collectors/playwright-reporter/tests/aggregate.test.ts`
- [x] 5.2 Delete `collectors/playwright-reporter/tests/file-operations.test.ts`
- [x] 5.3 Delete `collectors/playwright-reporter/tests/junit-parser.test.ts`

## 6. Update Build and Action

- [x] 6.1 Update `package.json` (root) esbuild paths to point to `collectors/junit/` (kept as-is, uses test-processing)
- [x] 6.2 Add `input-path` and `input-type` inputs to `action.yml`
- [x] 6.3 Add `flakyCount` to TestRow in `apps/frontend/src/types/index.ts` (already existed)
- [x] 6.4 Remove `collect` command from `apps/test-processing/scripts/cli.ts`

## 7. Verification

- [x] 7.1 Run `pnpm typecheck` - all packages pass
- [x] 7.2 Run `pnpm test` - all tests pass including new flow tests (5/5)
- [x] 7.3 Build and publish new npm version (@practica/test-eyes@0.1.5)
- [x] 7.4 Update test-eyes-demo and verify flaky counts are correct (not inflated)
- [x] 7.5 Verify dashboard displays correctly (data verified in gh-data branch)
