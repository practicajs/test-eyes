## MODIFIED Requirements

### Requirement: Flaky detection via test.outcome()
The reporter SHALL use Playwright's `test.outcome() === 'flaky'` to determine flaky status instead of checking `result.retry > 0` in onTestEnd.

#### Scenario: Flaky detected via outcome
- **WHEN** a test has outcome 'flaky' (failed some attempts, passed final)
- **THEN** TestResult has isFlaky: true

#### Scenario: Non-flaky pass
- **WHEN** a test has outcome 'expected' (passed first attempt)
- **THEN** TestResult has isFlaky: false or undefined

#### Scenario: Failed test not marked flaky
- **WHEN** a test has outcome 'unexpected' (failed all attempts)
- **THEN** TestResult has isFlaky: false or undefined, status: 'failed'

### Requirement: Collect attempts by test ID
The reporter SHALL collect all attempts for each test keyed by test ID during onTestEnd, then resolve final status in onEnd.

#### Scenario: Attempts collected per test
- **WHEN** onTestEnd is called 3 times for the same test.id
- **THEN** all 3 attempts are stored, associated with that test ID

#### Scenario: Final resolution in onEnd
- **WHEN** onEnd is called
- **THEN** each unique test ID produces exactly one TestResult

### Requirement: Import shared logic from test-processing
The reporter SHALL import `collectFromRunData` from test-processing instead of implementing its own collection logic.

#### Scenario: Uses collectFromRunData
- **WHEN** reporter's onEnd completes
- **THEN** it calls collectFromRunData from test-processing package

#### Scenario: No local collection implementation
- **WHEN** inspecting playwright-reporter source
- **THEN** there is no local implementation of git operations, file saving, or aggregation
