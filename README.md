# Test Eyes

[![npm version](https://img.shields.io/npm/v/@practica/test-eyes.svg)](https://www.npmjs.com/package/@practica/test-eyes)
[![npm version](https://img.shields.io/npm/v/@practica/test-eyes-junit.svg)](https://www.npmjs.com/package/@practica/test-eyes-junit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Test analytics dashboard that collects test results from CI, aggregates statistics over time, and displays them on GitHub Pages. Track flaky tests, slow tests, and test performance trends across your repositories.

## Features

- **Flaky Test Detection** - Automatically identifies tests that fail and then pass on retry
- **Performance Tracking** - P95 and average duration metrics for every test
- **Multiple Views** - Slowest tests, fastest tests, flaky tests, and flaky by category
- **Real-time Search** - Filter tests instantly by name
- **GitHub Pages Dashboard** - Automatically deployed, no infrastructure needed
- **Multiple Input Formats** - Playwright reporter and JUnit XML collector

## Quick Start

### Using with Playwright

1. Install the Playwright reporter:

```bash
npm install @practica/test-eyes
```

2. Add it to your Playwright config:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['@practica/test-eyes', {
      dataBranch: 'gh-data',
      deployBranch: 'gh-pages',
      deploy: true
    }]
  ]
});
```

3. Run your tests in CI - data is automatically collected and dashboard deployed.

### Using with JUnit XML

1. Install the JUnit collector:

```bash
npm install @practica/test-eyes-junit
```

2. Run after your tests:

```bash
npx test-eyes-junit ./test-results.xml --deploy
```

### Using the GitHub Action

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

permissions:
  contents: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tests
        run: npm test -- --reporter=junit --outputFile=test-results.xml

      - name: Collect and deploy
        uses: your-org/test-eyes@main
        with:
          input-path: test-results.xml
          data-branch: gh-data
          deploy-branch: gh-pages
```

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@practica/test-eyes`](./collectors/playwright-reporter) | Playwright reporter - collects test data directly from Playwright | [![npm](https://img.shields.io/npm/v/@practica/test-eyes.svg)](https://www.npmjs.com/package/@practica/test-eyes) |
| [`@practica/test-eyes-junit`](./collectors/junit) | JUnit collector - parses JUnit XML files from any test runner | [![npm](https://img.shields.io/npm/v/@practica/test-eyes-junit.svg)](https://www.npmjs.com/package/@practica/test-eyes-junit) |
| `apps/frontend` | React dashboard (Vite + Tailwind + TanStack Table) | - |
| `apps/test-processing` | Core aggregation and deployment logic | - |
| `libraries/design-system` | Shared UI components | - |

## Playwright Reporter Options

Configure the reporter in your `playwright.config.ts`:

```typescript
['@practica/test-eyes', {
  dataBranch: 'gh-data',
  deployBranch: 'gh-pages',
  deploy: true,
  prNumber: 123
}]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dataBranch` | `string` | `'gh-data'` | Branch to store test data |
| `deployBranch` | `string` | `'gh-pages'` | Branch to deploy dashboard |
| `deploy` | `boolean` | `true` | Whether to deploy dashboard after collecting data |
| `frontendDistPath` | `string` | auto-detect | Path to frontend dist directory |
| `prNumber` | `number` | from env | PR number (auto-detected from `GITHUB_PR_NUMBER` or `PR_NUMBER`) |

The reporter only runs in CI environments (when `CI` or `GITHUB_ACTIONS` is set).

## JUnit Collector CLI Options

```bash
test-eyes-junit <junit-path> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--data-branch <branch>` | `gh-data` | Branch to store test data |
| `--commit-sha <sha>` | `GITHUB_SHA` or git rev-parse | Git commit SHA |
| `--pr-number <number>` | `GITHUB_PR_NUMBER` or `0` | PR number |
| `--deploy` | - | Deploy dashboard after collection |
| `--deploy-branch <branch>` | `gh-pages` | Branch to deploy to |

### Examples

```bash
# Basic usage
test-eyes-junit ./test-results.xml

# With custom branches
test-eyes-junit ./test-results.xml --data-branch test-data --deploy

# In GitHub Actions
test-eyes-junit ./test-results.xml --commit-sha $GITHUB_SHA --pr-number $PR_NUMBER --deploy
```

## GitHub Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `input-path` | Yes* | - | Path to test results file |
| `junit-path` | Yes* | - | Alias for `input-path` (backward compatibility) |
| `input-type` | No | `junit` | Type of input file (`junit`, `playwright`) |
| `data-branch` | No | `gh-data` | Branch to store test data |
| `deploy-branch` | No | `gh-pages` | Branch to deploy dashboard |

*Either `input-path` or `junit-path` is required.

## How It Works

### Data Flow

```
Tests Run in CI
      |
      v
+------------------+
|  Collector       |  (Playwright Reporter or JUnit CLI)
|  - Parse results |
|  - Build RunData |
+------------------+
      |
      v
+------------------+
|  test-processing |  (Core domain layer)
|  - Aggregate     |
|  - Calculate p95 |
|  - Track flaky   |
+------------------+
      |
      v
+------------------+
|  gh-data branch  |  (Raw test data JSON files)
+------------------+
      |
      v
+------------------+
|  gh-pages branch |  (Static dashboard)
+------------------+
```

### Branch Structure

- **`gh-data`** - Stores raw test run data as JSON files. Each test run creates a new file with the commit SHA and timestamp.
- **`gh-pages`** - Hosts the static dashboard. Contains the React app and aggregated `main-test-data.json`.

### Test Data Schema

Each test run is stored as:

```typescript
interface RunData {
  runId: string;        // Unique identifier
  prNumber: number;     // PR number (0 for main branch)
  commitSha: string;    // Git commit SHA
  createdAt: string;    // ISO timestamp
  tests: TestResult[];  // Array of test results
}

interface TestResult {
  name: string;              // Full test name
  durationMs: number;        // Test duration in milliseconds
  status: 'passed' | 'failed' | 'skipped';
  wasFlaky?: boolean;        // True if failed then passed on retry
  retries?: number;          // Number of retry attempts
}
```

Aggregated statistics:

```typescript
interface TestStats {
  totalRuns: number;      // Total times this test ran
  passCount: number;      // Successful runs
  failCount: number;      // Failed runs
  flakyCount: number;     // Times marked as flaky
  avgDurationMs: number;  // Average duration
  p95DurationMs: number;  // 95th percentile duration
}
```

## Dashboard Features

The dashboard provides four main views:

| View | Description |
|------|-------------|
| **Slowest Tests** | Tests sorted by P95 duration (highest first) |
| **Fastest Tests** | Tests sorted by P95 duration (lowest first) |
| **Flaky Tests** | Tests with flaky count > 0, sorted by flaky count |
| **Flaky by Category** | Flaky tests grouped by test file/category |

All views support real-time search filtering.

## Local Development

```bash
# Install dependencies
pnpm install

# Start dev servers
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

### Project Structure

```
test-eyes/
├── apps/
│   ├── frontend/           # React dashboard (Vite + Tailwind)
│   ├── test-processing/    # Core aggregation logic
│   └── example-app/        # Sample app for testing
├── collectors/
│   ├── playwright-reporter/  # @practica/test-eyes
│   └── junit/                # @practica/test-eyes-junit
├── libraries/
│   └── design-system/      # Shared UI components
└── action.yml              # GitHub Action definition
```

## CLI Commands

### test-processing CLI

```bash
# Aggregate test data files
pnpm --filter test-processing cli aggregate ./data

# Deploy dashboard
pnpm --filter test-processing cli deploy --dist-dir ./dist --data-dir ./data
```

#### Deploy Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--dist-dir` | `-d` | - | Frontend dist directory (required) |
| `--data-dir` | - | `data` | Data directory |
| `--commit-sha` | `-c` | `GITHUB_SHA` | Commit SHA |
| `--target-branch` | `-t` | `gh-pages` | Target branch |

## GitHub Actions Workflows

The repository includes several workflow examples:

### collect-test-data.yml
Runs tests and collects data on PRs:
- Runs tests with JUnit output
- Parses results and saves to `gh-data` branch

### deploy-frontend.yml
Deploys dashboard on push to main:
- Builds frontend
- Copies data from `gh-data` branch
- Deploys to GitHub Pages

### aggregate-and-deploy.yml
Aggregates data and deploys:
- Fetches all test data files
- Runs aggregation to compute statistics
- Deploys updated dashboard

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CI` | Set to `true` in CI environments |
| `GITHUB_ACTIONS` | Set automatically by GitHub Actions |
| `GITHUB_SHA` | Current commit SHA |
| `GITHUB_PR_NUMBER` | PR number (if applicable) |
| `PR_NUMBER` | Alternative PR number variable |
| `GITHUB_REPOSITORY` | Repository in `owner/repo` format |

## Requirements

- Node.js 22+
- pnpm 9+ (for development)
- Playwright 1.40+ (for Playwright reporter)

## License

MIT
