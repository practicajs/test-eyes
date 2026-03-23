## ADDED Requirements

### Requirement: Stubbable git boundary
The system SHALL provide a `pushToGitHub()` function that encapsulates git commit and push operations, allowing tests to stub only this function while running all upstream code for real.

#### Scenario: pushToGitHub function exists
- **WHEN** inspecting `apps/test-processing/src/git-operations.ts`
- **THEN** pushToGitHub function is exported with PushToGitHubOptions interface

#### Scenario: Flow tests stub only pushToGitHub
- **WHEN** running reporter flow tests
- **THEN** vi.mock stubs only pushToGitHub, all other code runs for real

### Requirement: Data factories for tests
The system SHALL provide factory functions `makePlaywrightTestCase()` and `makePlaywrightResult()` that produce valid test objects with sensible defaults.

#### Scenario: Factory functions exist
- **WHEN** inspecting `collectors/playwright-reporter/src/tests/factories.ts`
- **THEN** makePlaywrightTestCase and makePlaywrightResult functions are exported

#### Scenario: Factories accept overrides
- **WHEN** calling `makePlaywrightTestCase({ outcome: 'flaky' })`
- **THEN** returned object has outcome() returning 'flaky' with other fields having defaults

### Requirement: Flaky detection flow test
The system SHALL have a test verifying: "When 2 of 4 test attempts fail then pass, the test is marked as flaky with correct retry count"

#### Scenario: Flaky test produces correct output
- **WHEN** reporter receives 3 attempts (fail, fail, pass) for one test with outcome 'flaky'
- **THEN** pushToGitHub receives RunData with 1 test having isFlaky: true, retries: 2, status: 'passed'

### Requirement: Slow test aggregation flow test
The system SHALL have a test verifying: "When a test is consistently slow, aggregated stats reflect high duration"

#### Scenario: Slow test stats calculated correctly
- **WHEN** 3 runs have durations 1500ms, 1600ms, 1550ms for the same test
- **THEN** aggregated avgDurationMs is approximately 1550 and p95DurationMs is 1600

### Requirement: Mixed statuses flow test
The system SHALL have a test verifying: "When mixing passed, failed, and flaky tests in one run, each gets the correct status and counts"

#### Scenario: Mixed statuses produce correct counts
- **WHEN** one run has login (pass), payment (fail), profile (flaky)
- **THEN** RunData has 3 tests with correct statuses, flakyCount = 1, failCount = 1, passCount = 1

### Requirement: Multi-run accumulation flow test
The system SHALL have a test verifying: "When multiple runs are aggregated, flakyCount accumulates across runs"

#### Scenario: flakyCount accumulates
- **WHEN** 4 runs where profile test is flaky in 2 and passes cleanly in 2
- **THEN** aggregated stats show totalRuns: 4, flakyCount: 2, passCount: 4
