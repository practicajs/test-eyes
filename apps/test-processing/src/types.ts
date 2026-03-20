// ============================================================================
// Test Data Types
// ============================================================================

export interface TestResult {
  name: string
  durationMs: number
  status: 'passed' | 'failed' | 'skipped'
  wasFlaky?: boolean // true if test failed then passed on retry
}

export interface RunData {
  runId: string
  prNumber: number
  commitSha: string
  createdAt: string
  tests: TestResult[]
}

// ============================================================================
// Aggregated Data Types
// ============================================================================

export interface TestStats {
  totalRuns: number
  passCount: number
  failCount: number
  flakyCount: number
  avgDurationMs: number
  p95DurationMs: number
}

export interface AggregatedMeta {
  totalRuns: number
  lastAggregatedAt: string | null
  processedFiles: string[]
}

export interface AggregatedData {
  schemaVersion: string
  meta: AggregatedMeta
  tests: Record<string, TestStats>
}

// ============================================================================
// Git Operations Types
// ============================================================================

export interface GitConfig {
  userName: string
  userEmail: string
}

export interface CommitResult {
  success: boolean
  commitSha?: string
  message: string
}

export interface PushResult {
  success: boolean
  message: string
}

// ============================================================================
// Deploy Types
// ============================================================================

export interface DeployConfig {
  sourceDir: string
  dataFile: string
  targetBranch: string
  commitSha: string
}

export interface DeployResult {
  success: boolean
  message: string
  url?: string
}

// ============================================================================
// CLI Types
// ============================================================================

export interface CollectOptions {
  junitPath: string
  outputPath: string
  dataBranch: string
  commitSha: string
  prNumber: number
}

export interface DeployOptions {
  distDir: string
  dataDir: string
  targetBranch: string
  commitSha: string
}
