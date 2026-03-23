# test-eyes-reporter

Playwright reporter and CLI for Test Eyes analytics dashboard. Collects test results, tracks flaky tests, and deploys an analytics dashboard to GitHub Pages.

## Features

- **Playwright Reporter**: Automatically collect test results during Playwright runs
- **Flaky Test Detection**: Tracks tests that fail then pass on retry
- **JUnit XML Support**: Also works with any test framework that outputs JUnit XML
- **GitHub Pages Dashboard**: Visualize test analytics over time
- **Zero Config CI**: Works out of the box with GitHub Actions

## Installation

```bash
npm install test-eyes-reporter
# or
pnpm add test-eyes-reporter
```

## Usage with Playwright

Add the reporter to your `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  retries: 2, // Enable retries to detect flaky tests
  reporter: [
    ['list'],
    ['test-eyes-reporter', {
      dataBranch: 'gh-data',    // Branch to store test data
      deployBranch: 'gh-pages', // Branch to deploy dashboard
      deploy: true              // Auto-deploy after test run
    }]
  ]
})
```

Then run your tests:

```bash
npx playwright test
```

The reporter will:
1. Collect all test results
2. Track which tests are flaky (failed then passed on retry)
3. Push data to the `gh-data` branch
4. Deploy the dashboard to `gh-pages` (if `deploy: true`)

## Usage with JUnit XML (Any Test Framework)

For non-Playwright test frameworks, use the CLI:

```bash
# Collect test results
npx test-eyes collect --junit-path ./test-results.xml

# Collect and deploy dashboard
npx test-eyes collect --junit-path ./test-results.xml --deploy

# Deploy dashboard only
npx test-eyes deploy
```

## CLI Commands

### `test-eyes collect`

Collect test results from JUnit XML.

```bash
test-eyes collect --junit-path <path> [options]

Options:
  --junit-path <path>   Path to JUnit XML file (required)
  --data-branch <name>  Git branch for data storage (default: gh-data)
  --commit-sha <sha>    Commit SHA (default: current HEAD)
  --pr-number <num>     PR number (default: 0)
  --deploy              Also deploy dashboard after collecting
```

### `test-eyes deploy`

Deploy the dashboard to GitHub Pages.

```bash
test-eyes deploy [options]

Options:
  --data-branch <name>    Source branch for data (default: gh-data)
  --deploy-branch <name>  Target branch for deployment (default: gh-pages)
```

## GitHub Actions Setup

Add to your workflow:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Run Playwright tests
        run: npx playwright test
        env:
          CI: true
```

Make sure your repo has GitHub Pages enabled with source set to `gh-pages` branch.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dataBranch` | string | `'gh-data'` | Branch to store test data |
| `deployBranch` | string | `'gh-pages'` | Branch to deploy dashboard |
| `deploy` | boolean | `true` | Deploy dashboard after collecting |
| `prNumber` | number | auto | PR number (auto-detected from env) |

## Data Format

Test data is stored as JSON in the data branch:

```json
{
  "runId": "2024-01-15_abc1234",
  "prNumber": 42,
  "commitSha": "abc1234...",
  "createdAt": "2024-01-15T10:00:00Z",
  "tests": [
    {
      "name": "login > should authenticate user",
      "durationMs": 1500,
      "status": "passed",
      "wasFlaky": false
    }
  ]
}
```

## Dashboard

The dashboard shows:
- **Test Overview**: All tests with pass/fail counts
- **Flaky Tests**: Tests that have been flaky
- **Slowest Tests**: Tests sorted by p95 duration
- **Search**: Filter tests by name

## License

MIT
