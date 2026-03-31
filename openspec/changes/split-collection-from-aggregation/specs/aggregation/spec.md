## ADDED Requirements

### Requirement: Aggregator ingests run files into history
The system SHALL read all run files from `data/runs/` and append executions to `test-history.json`.

#### Scenario: Single run, single test
- **WHEN** no history exists and 1 run file has `Auth > login` passing at 200ms
- **THEN** history SHALL have 1 entry, summary SHALL have `passCount: 1, avgDurationMs: 200, p95: 200`

#### Scenario: Multiple run files processed
- **WHEN** no history exists and 2 run files each have `Auth > login` (200ms, 300ms)
- **THEN** history SHALL have 2 entries, summary SHALL have `totalRuns: 2, avgDurationMs: 250`

#### Scenario: New runs append to existing history
- **WHEN** history has 3 entries for `Auth > login` and 1 new run file arrives
- **THEN** history SHALL have 4 entries (3 old + 1 new), old entries preserved

#### Scenario: History capped at 200
- **WHEN** history has 199 entries and 2 new run files arrive
- **THEN** history SHALL have exactly 200 entries (oldest dropped)

### Requirement: Summarizer derives stats from history
The system SHALL derive `test-summary.json` as a pure function of `test-history.json`.

#### Scenario: p95 from real durations
- **WHEN** 1 run file has 10 tests for `Auth > login` with durations `[100, 150, 200, 250, 300, 350, 400, 450, 500, 2000]`
- **THEN** summary SHALL have `p95DurationMs: 2000` (real 95th percentile, NOT average of 470)

#### Scenario: Mixed pass/fail/flaky counts
- **WHEN** 3 run files for `Auth > login`: passed, failed, passed+flaky
- **THEN** summary SHALL have `passCount: 2, failCount: 1, flakyCount: 1`

### Requirement: New tests added to history
The system SHALL create new entries in history for tests not previously seen.

#### Scenario: New test added to history
- **WHEN** history has `Auth > login` and run file has `Auth > login` AND `Checkout > pay`
- **THEN** history SHALL have both tests, summary SHALL have both tests

### Requirement: Unmentioned tests preserved
The system SHALL preserve history for tests not in current run files.

#### Scenario: Unmentioned test preserved
- **WHEN** history has `Auth > login` (5 entries) and run file has only `Checkout > pay`
- **THEN** `Auth > login` SHALL stay in history + summary unchanged, `Checkout > pay` added

### Requirement: Run files deleted after successful processing
The system SHALL delete run files only after successful commit/push.

#### Scenario: Run files deleted after processing
- **WHEN** 2 run files in inbox and aggregation succeeds
- **THEN** both files SHALL be deleted after aggregate returns

### Requirement: No changes when inbox empty
The system SHALL return unchanged data when no run files exist.

#### Scenario: No run files — nothing changes
- **WHEN** history has 3 entries and no run files in inbox
- **THEN** history and summary SHALL be returned unchanged, no files deleted

### Requirement: Concurrency protection
The system SHALL prevent concurrent aggregation runs via GitHub Actions concurrency group.

#### Scenario: Concurrent runs prevented
- **WHEN** aggregation workflow is running and cron triggers again
- **THEN** second run SHALL be queued, not run in parallel

### Requirement: Output file renamed
The system SHALL write summary to `test-summary.json` (not `main-test-data.json`).

#### Scenario: Summary file location
- **WHEN** aggregation completes
- **THEN** summary SHALL be written to `data/test-summary.json`
