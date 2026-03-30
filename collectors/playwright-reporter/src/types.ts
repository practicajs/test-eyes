// Reporter configuration options
export interface TestEyesReporterOptions {
  // Branch to store test data (default: 'gh-data')
  dataBranch?: string
  // PR number (default: from GITHUB_PR_NUMBER or 0)
  prNumber?: number
}
