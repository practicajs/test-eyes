## ADDED Requirements

### Requirement: Retries field in TestResult
The TestResult interface SHALL include an optional `retries` field indicating how many retry attempts occurred.

#### Scenario: retries field exists
- **WHEN** inspecting `apps/test-processing/src/types.ts` TestResult interface
- **THEN** retries field of type `number | undefined` is present

#### Scenario: retries populated from reporter
- **WHEN** Playwright reporter records a test that passed after 2 retries
- **THEN** TestResult has retries: 2

## MODIFIED Requirements

### Requirement: Per-test counting (not per-attempt)
The system SHALL record exactly one TestResult per logical test, regardless of retry attempts. The status SHALL reflect the final outcome, not individual attempts.

#### Scenario: Retried test produces single entry
- **WHEN** a test fails twice then passes on third attempt
- **THEN** RunData contains exactly 1 TestResult for that test (not 3)

#### Scenario: Status reflects final outcome
- **WHEN** a test fails attempts 0-1 but passes on attempt 2
- **THEN** TestResult has status: 'passed' and isFlaky: true

#### Scenario: Duration uses final attempt
- **WHEN** a test has attempts with durations [150ms, 142ms, 138ms]
- **THEN** TestResult has durationMs: 138 (the final attempt's duration)
