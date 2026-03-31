## ADDED Requirements

### Requirement: TestHistory data structure
The system SHALL maintain a `test-history.json` file containing the last 200 raw executions per test. This is the source of truth for aggregation.

#### Scenario: Empty history initialization
- **WHEN** `test-history.json` does not exist
- **THEN** system SHALL create it with `{ schemaVersion: "1.0.0", tests: {} }`

#### Scenario: History structure
- **WHEN** history contains test executions
- **THEN** each test entry SHALL have: `runId`, `status`, `durationMs`, `timestamp`, optional `failureMessage`, optional `wasFlaky`

### Requirement: History cap at 200 entries per test
The system SHALL cap each test's execution history at 200 entries, dropping oldest entries when exceeded.

#### Scenario: Cap enforced on new entry
- **WHEN** a test has 199 entries and 2 new run files are processed
- **THEN** history SHALL contain exactly 200 entries (oldest dropped)

#### Scenario: Old entries preserved within cap
- **WHEN** history has 50 entries and 1 new run file is processed
- **THEN** history SHALL contain 51 entries (all preserved)

### Requirement: Real durations stored
The system SHALL store actual `durationMs` values from test results, not averages or approximations.

#### Scenario: Duration accuracy
- **WHEN** a test runs with duration 1500ms
- **THEN** history entry SHALL have `durationMs: 1500` (exact value)

### Requirement: Fetch history via git show
The system SHALL read `test-history.json` from remote branch using `git show` without checkout.

#### Scenario: Fetch existing history
- **WHEN** `fetchTestHistory('gh-data')` is called and file exists
- **THEN** system SHALL return parsed TestHistory object

#### Scenario: Fetch non-existent history
- **WHEN** `fetchTestHistory('gh-data')` is called and file does not exist
- **THEN** system SHALL return empty history `{ schemaVersion: "1.0.0", tests: {} }`
