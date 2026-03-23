## Context

Test-eyes is a test analytics system that collects test results from CI, aggregates statistics, and displays them on a dashboard. The original design specified a multi-format collector architecture where thin collectors (JUnit, Playwright, future Vitest) call shared core logic in `apps/test-processing/`.

**Current state**: The Playwright reporter was implemented as a self-contained package with duplicated code:
- `collectors/playwright-reporter/` contains copies of: aggregate.ts, git-operations.ts, file-operations.ts, deploy.ts, types.ts
- No dependency on `test-processing`
- `collectors/junit/` was never created
- Flaky detection records per-attempt (inflating counts) instead of per-test

**Constraints**:
- npm package `@practica/test-eyes` is already published and in use
- External API must remain unchanged (reporter configuration in playwright.config.ts)
- test-processing code must be bundled into the npm package when published

## Goals / Non-Goals

**Goals:**
- Eliminate code duplication between collectors and test-processing
- Create single source of truth for collection logic (`collectFromRunData()`)
- Enable easy addition of new reporter types (Vitest, Jest)
- Fix flaky detection to record one result per logical test
- Implement planned flow tests with stubbable boundary

**Non-Goals:**
- Changing the public npm package API
- Adding new dashboard features
- Supporting non-Playwright reporters in this change (JUnit collector is for architecture, not new features)

## Decisions

### 1. Shared Core Function: `collectFromRunData()`

**Decision**: Create a single `collectFromRunData(options: CollectFromRunDataOptions)` function in `apps/test-processing/src/collector.ts` that handles:
- Git branch checkout
- Save run data
- Aggregate statistics
- Commit and push

**Alternatives considered**:
- Keep separate implementations: Rejected - violates DRY, maintenance burden
- Use shared utilities but separate orchestration: Rejected - still duplicates orchestration logic

**Rationale**: Single function is the simplest approach. All format-specific logic stays in collectors (parsing), all shared logic stays in core.

### 2. Stubbable Boundary: `pushToGitHub()`

**Decision**: Create `pushToGitHub(options: PushToGitHubOptions)` that encapsulates git commit + push. Flow tests stub only this function.

**Rationale**:
- Follows the original plan's testing strategy
- Everything upstream (reporter mapping, RunData building, aggregation math) runs for real
- Only external side effect (git) is stubbed

### 3. Flaky Detection: Per-Test via `test.outcome()`

**Decision**:
- Collect attempts in `onTestEnd()` keyed by test ID (Map)
- In `onEnd()`, use `test.outcome() === 'flaky'` to determine final status
- Emit ONE TestResult per logical test

**Alternatives considered**:
- Keep current per-attempt approach: Rejected - inflates test counts, skews statistics
- Deduplicate in aggregation: Rejected - harder, error-prone, wrong place for this logic

**Rationale**: Playwright's `test.outcome()` is the authoritative source for test status. Using it in `onEnd()` gives us the correct final status.

### 4. Bundling Strategy

**Decision**: playwright-reporter depends on test-processing via workspace dependency (`"test-processing": "workspace:*"`). When publishing, use esbuild to bundle test-processing code into the package.

**Rationale**:
- Local dev: workspace dependency for fast iteration
- Published package: self-contained, no external dependencies on test-processing

### 5. JUnit Collector Location

**Decision**: Create `collectors/junit/` with its own package.json. Move JUnit-specific logic from `apps/test-processing/scripts/action-collect.ts`.

**Rationale**: Symmetry with Playwright collector. Both are thin wrappers calling shared core.

## Risks / Trade-offs

**[Risk] Breaking existing demo repos** → Publish as patch version first, test on test-eyes-demo before wider release

**[Risk] Bundling complexity** → Use existing esbuild setup, test bundle size

**[Risk] Flaky detection behavior change** → Document clearly in release notes, counts may differ from previous versions

**[Trade-off] More packages to maintain** → Worth it for cleaner architecture and future extensibility

## Migration Plan

1. **Phase 1**: Create core infrastructure in test-processing (non-breaking)
2. **Phase 2**: Refactor playwright-reporter to use core (internal change)
3. **Phase 3**: Create JUnit collector (new package)
4. **Phase 4**: Add flow tests (validation)
5. **Phase 5**: Update action.yml, build scripts (integration)
6. **Phase 6**: Publish new npm version, verify on demo repo

**Rollback**: If issues found, revert to previous npm version. Internal architecture changes don't affect external API.
