## ADDED Requirements

### Requirement: Format-agnostic collection core
The system SHALL provide a `collectFromRunData()` function in `apps/test-processing/` that accepts RunData from any collector and handles git operations, saving, and aggregation.

#### Scenario: Playwright collector calls shared core
- **WHEN** Playwright reporter calls `collectFromRunData({ runData, dataBranch: 'gh-data' })`
- **THEN** system saves run data to data branch, aggregates statistics, commits and pushes

#### Scenario: JUnit collector calls shared core
- **WHEN** JUnit collector calls `collectFromRunData({ runData, dataBranch: 'gh-data' })`
- **THEN** system saves run data to data branch, aggregates statistics, commits and pushes

### Requirement: Thin Playwright collector
The Playwright reporter package SHALL contain only reporter-specific code (onTestEnd, onEnd hooks) and SHALL import shared logic from test-processing.

#### Scenario: No duplicated modules in playwright-reporter
- **WHEN** inspecting `collectors/playwright-reporter/src/`
- **THEN** there are no files named aggregate.ts, git-operations.ts, file-operations.ts, or deploy.ts

#### Scenario: Dependency on test-processing
- **WHEN** inspecting `collectors/playwright-reporter/package.json`
- **THEN** test-processing is listed as a dependency

### Requirement: JUnit collector package
The system SHALL have a separate JUnit collector package at `collectors/junit/` that parses JUnit XML and calls `collectFromRunData()`.

#### Scenario: JUnit collector structure
- **WHEN** inspecting `collectors/junit/`
- **THEN** package.json, src/collect.ts, and src/cli.ts exist

#### Scenario: JUnit collector uses shared core
- **WHEN** JUnit collector processes a JUnit XML file
- **THEN** it calls `collectFromRunData()` from test-processing

### Requirement: Typed collection options
The system SHALL provide a `CollectFromRunDataOptions` interface defining the contract between collectors and core.

#### Scenario: Type definition exists
- **WHEN** inspecting `apps/test-processing/src/types.ts`
- **THEN** CollectFromRunDataOptions interface is exported with runData and dataBranch fields
