// =============================================================================
// Public API - Only export what external consumers need
// =============================================================================

// Types
export type {
  TestResult,
  RunData,
  TestStats,
  AggregatedMeta,
  AggregatedData,
  TestHistory,
  RecentExecution,
  CollectFromRunDataOptions
} from './types.js'

// Aggregation
export {
  aggregateAndSummarize,
  deriveStats,
  isValidRunData,
  HISTORY_CAP
} from './aggregate.js'

// Collection (main entry points)
export {
  collectFromRunData,
  type CollectResult
} from './collector.js'

// JUnit Parser (for junit collector)
export { parseAndBuildRunData } from './junit-parser.js'

// Git Operations (stubbable boundaries for testing)
export {
  fetchTestHistory,
  fetchAggregatedData,
  pushRunDataToGit,
  pushAggregatedDataToGit,
  type PushRunDataOptions,
  type PushAggregatedDataOptions
} from './git-operations.js'

// File Operations
export {
  saveTestHistory,
  loadTestHistory,
  saveAggregatedData,
  findJsonFiles
} from './file-operations.js'

// Deploy
export {
  deployDashboard,
  type DeployDashboardOptions
} from './deploy.js'
