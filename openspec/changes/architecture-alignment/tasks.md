## 1. Core Infrastructure (test-processing)

- [ ] 1.1 Add `PushToGitHubOptions` interface to `apps/test-processing/src/types.ts`
- [ ] 1.2 Add `pushToGitHub()` function to `apps/test-processing/src/git-operations.ts`
- [ ] 1.3 Add `CollectFromRunDataOptions` interface to `apps/test-processing/src/types.ts`
- [ ] 1.4 Add `retries?: number` field to TestResult interface in `apps/test-processing/src/types.ts`
- [ ] 1.5 Rename `wasFlaky` to `isFlaky` in TestResult interface (or keep wasFlaky if preferred)
- [ ] 1.6 Create `collectFromRunData()` function in `apps/test-processing/src/collector.ts`
- [ ] 1.7 Export `collectFromRunData`, `pushToGitHub`, and types from `apps/test-processing/src/index.ts`

## 2. Fix Playwright Reporter

- [ ] 2.1 Refactor `onTestEnd()` to collect attempts by test ID using Map
- [ ] 2.2 Refactor `onEnd()` to use `test.outcome()` for final status determination
- [ ] 2.3 Emit exactly one TestResult per logical test in `onEnd()`
- [ ] 2.4 Add `retries` field to emitted TestResult (attempts.length - 1)
- [ ] 2.5 Add dependency on test-processing in `collectors/playwright-reporter/package.json`
- [ ] 2.6 Import and use `collectFromRunData` from test-processing
- [ ] 2.7 Delete `collectors/playwright-reporter/src/aggregate.ts`
- [ ] 2.8 Delete `collectors/playwright-reporter/src/git-operations.ts`
- [ ] 2.9 Delete `collectors/playwright-reporter/src/file-operations.ts`
- [ ] 2.10 Delete `collectors/playwright-reporter/src/deploy.ts`
- [ ] 2.11 Delete `collectors/playwright-reporter/src/cli.ts`

## 3. Create JUnit Collector

- [ ] 3.1 Create `collectors/junit/package.json`
- [ ] 3.2 Create `collectors/junit/tsconfig.json`
- [ ] 3.3 Create `collectors/junit/src/collect.ts` with `collectFromJUnit()` function
- [ ] 3.4 Create `collectors/junit/src/cli.ts` with CLI entry point
- [ ] 3.5 Update `pnpm-workspace.yaml` to include `collectors/*`

## 4. Flow Tests

- [ ] 4.1 Create `collectors/playwright-reporter/src/tests/factories.ts` with `makePlaywrightTestCase()` and `makePlaywrightResult()`
- [ ] 4.2 Create `collectors/playwright-reporter/src/tests/reporter.test.ts`
- [ ] 4.3 Implement test: "When 2 of 4 test attempts fail then pass, the test is marked as flaky with correct retry count"
- [ ] 4.4 Implement test: "When a test is consistently slow, aggregated stats reflect high duration"
- [ ] 4.5 Implement test: "When mixing passed, failed, and flaky tests in one run, each gets the correct status and counts"
- [ ] 4.6 Implement test: "When multiple runs are aggregated, flakyCount accumulates across runs"

## 5. Cleanup Old Tests

- [ ] 5.1 Delete `collectors/playwright-reporter/tests/aggregate.test.ts`
- [ ] 5.2 Delete `collectors/playwright-reporter/tests/file-operations.test.ts`
- [ ] 5.3 Delete `collectors/playwright-reporter/tests/junit-parser.test.ts`

## 6. Update Build and Action

- [ ] 6.1 Update `package.json` (root) esbuild paths to point to `collectors/junit/`
- [ ] 6.2 Add `input-path` and `input-type` inputs to `action.yml`
- [ ] 6.3 Add `flakyCount` to TestRow in `apps/frontend/src/types/index.ts`
- [ ] 6.4 Remove `collect` command from `apps/test-processing/scripts/cli.ts`

## 7. Verification

- [ ] 7.1 Run `pnpm typecheck` - all packages pass
- [ ] 7.2 Run `pnpm test` - all tests pass including new flow tests
- [ ] 7.3 Build and publish new npm version
- [ ] 7.4 Update test-eyes-demo and verify flaky counts are correct (not inflated)
- [ ] 7.5 Verify dashboard displays correctly
