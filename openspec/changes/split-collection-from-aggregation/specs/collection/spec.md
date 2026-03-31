## ADDED Requirements

### Requirement: Collection writes only run file
The system SHALL write only the run file during collection phase. No aggregation, no summary update.

#### Scenario: Passed tests are recorded
- **WHEN** two tests pass with durations 1550ms and 800ms
- **THEN** RunData SHALL have 2 tests with `status: 'passed'` and correct durations

#### Scenario: Failed test is recorded
- **WHEN** two tests fail
- **THEN** RunData SHALL have 2 tests with `status: 'failed'`

#### Scenario: Flaky test detected
- **WHEN** test fails twice, then passes on retry
- **THEN** RunData SHALL have 1 test with `wasFlaky: true`, `status: 'passed'`, `retries: 2`

#### Scenario: Multiple tests with mixed results
- **WHEN** 3 tests run: one passes, one fails, one flaky
- **THEN** RunData SHALL have 3 tests, each with correct status

#### Scenario: Skipped test recorded
- **WHEN** one test is skipped
- **THEN** RunData SHALL have 1 test with `status: 'skipped'`

### Requirement: CI environment check
The system SHALL only push data when running in CI environment.

#### Scenario: Not in CI — nothing pushed
- **WHEN** `CI` environment variable is not set
- **THEN** push function SHALL NOT be called

### Requirement: Last attempt duration used
The system SHALL use the duration from the last retry attempt, not earlier attempts.

#### Scenario: Retry uses last attempt duration
- **WHEN** test fails at 300ms (retry 0), passes at 180ms (retry 1)
- **THEN** RunData SHALL have `durationMs: 180`, `retries: 1`

### Requirement: Push with retry on conflict
The system SHALL retry push up to 3 times with rebase on conflict.

#### Scenario: Push succeeds on first attempt
- **WHEN** push to `gh-data` succeeds immediately
- **THEN** collection SHALL complete successfully

#### Scenario: Push succeeds after retry
- **WHEN** first push fails due to conflict, second succeeds after rebase
- **THEN** collection SHALL complete successfully

#### Scenario: Push fails after 3 retries
- **WHEN** all 3 push attempts fail
- **THEN** collection SHALL return error result

### Requirement: No aggregation during collection
The system SHALL NOT call aggregate functions during collection phase.

#### Scenario: Aggregation not called
- **WHEN** reporter collects test data
- **THEN** `aggregate()` or `aggregateAndSummarize()` SHALL NOT be called
