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
  CollectOptions,
  CollectFromRunDataOptions
} from './types.js'

// Aggregation
export {
  aggregate,
  type AggregateResult,
  type AggregateOptions
} from './aggregate.js'

// Collection (main entry points)
export {
  collectTestData,
  collectFromRunData,
  type CollectResult,
  type CollectFromRunDataResult
} from './collector.js'

// Git Operations (stubbable boundaries for testing)
export {
  pushToGitHub,
  fetchAggregatedData,
  type PushTestDataOptions
} from './git-operations.js'

// Deploy
export {
  deployDashboard,
  type DeployDashboardOptions
} from './deploy.js'
