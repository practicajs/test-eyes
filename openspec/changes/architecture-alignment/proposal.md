## Why

The Playwright reporter was implemented as a self-contained package with duplicated code instead of following the planned thin-collector architecture. This causes maintenance burden (bug fixes must be applied in two places) and blocks the multi-format collector vision (adding Vitest, Jest, etc. would require duplicating all logic again). Additionally, the flaky detection logic has a critical bug that inflates test counts by recording per-attempt instead of per-test.

## What Changes

- **Extract shared core**: Create `collectFromRunData()` in `apps/test-processing` as the format-agnostic collection pipeline
- **Create stubbable boundary**: Add `pushToGitHub()` wrapper for testability
- **Make playwright-reporter thin**: Remove duplicated modules (aggregate, git-operations, file-operations, deploy), import from test-processing
- **Fix flaky detection**: Change from per-attempt to per-test recording using `test.outcome() === 'flaky'`
- **Create JUnit collector**: Move JUnit entry point to `collectors/junit/` for symmetry
- **Add flow tests**: Implement 4 behavior-driven tests with data factories
- **Add schema fields**: Add `retries` field to TestResult, `CollectFromRunDataOptions` type
- **Update action.yml**: Add `input-path`/`input-type` for multi-format support

## Capabilities

### New Capabilities
- `multi-format-collectors`: Architecture supporting multiple test result formats (JUnit, Playwright, future Vitest) through thin collectors calling shared core
- `flow-testing`: Test infrastructure with stubbable git boundary and data factories for behavior-driven tests

### Modified Capabilities
- `test-aggregation`: Add `retries` field tracking, fix per-test (not per-attempt) counting
- `playwright-reporter`: Refactor to thin collector importing from test-processing core

## Impact

**Code**:
- `apps/test-processing/src/`: Add collector.ts, modify git-operations.ts, types.ts
- `collectors/playwright-reporter/src/`: Delete aggregate.ts, git-operations.ts, file-operations.ts, deploy.ts; refactor reporter.ts
- `collectors/junit/`: New package (collect.ts, cli.ts)

**APIs**:
- New exports from test-processing: `collectFromRunData`, `pushToGitHub`
- TestResult type: add `retries?: number`

**Dependencies**:
- playwright-reporter depends on test-processing (workspace dependency, bundled on publish)

**Breaking**:
- Internal refactor only, npm package API unchanged
