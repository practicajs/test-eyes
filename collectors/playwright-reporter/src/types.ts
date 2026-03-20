// Reporter configuration options
export interface TestEyesReporterOptions {
  // Branch to store test data (default: 'gh-data')
  dataBranch?: string
  // Branch to deploy dashboard (default: 'gh-pages')
  deployBranch?: string
  // Whether to deploy dashboard after collecting data (default: true)
  deploy?: boolean
  // Path to frontend dist directory (default: auto-detect)
  frontendDistPath?: string
  // PR number (default: from GITHUB_PR_NUMBER or 0)
  prNumber?: number
}

// Internal test result format (matches test-processing)
export interface TestResult {
  name: string
  durationMs: number
  status: 'passed' | 'failed' | 'skipped'
  wasFlaky?: boolean
}

// Run data format (matches test-processing)
export interface RunData {
  runId: string
  prNumber: number
  commitSha: string
  createdAt: string
  tests: TestResult[]
}

// Git configuration
export interface GitConfig {
  userName: string
  userEmail: string
}
