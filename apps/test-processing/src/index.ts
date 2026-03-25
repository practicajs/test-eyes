// Types
export * from './types.js'

// JUnit Parser
export {
  parseJUnitXml,
  parseJUnitFile,
  buildRunData,
  parseAndBuildRunData
} from './junit-parser.js'

// Aggregation
export {
  aggregate,
  calculateP95,
  calculateAverage,
  isValidRunData,
  processTestRun,
  recalculateStats,
  type AggregateResult,
  type AggregateOptions
} from './aggregate.js'

// File Operations
export {
  ensureDir,
  copyDir,
  copyFile,
  removeDir,
  generateTestDataFilename,
  saveTestData,
  loadTestData,
  loadAggregatedData,
  saveAggregatedData,
  findJsonFiles,
  findUnprocessedFiles,
  copyToTemp,
  prepareSiteDir,
  createNoJekyllFile
} from './file-operations.js'

// Git Operations
export {
  configureGit,
  getDefaultGitConfig,
  fetchBranches,
  checkoutBranch,
  checkoutOrCreateBranch,
  stageFiles,
  stageAll,
  hasChanges,
  commit,
  push,
  pushWithUpstream,
  removeAllTracked,
  getCurrentBranch,
  getCurrentSha,
  pushToGitHub,
  type PushTestDataOptions
} from './git-operations.js'

// Deploy
export {
  prepareSite,
  deployToGitHubPages,
  deployDashboard,
  type DeployDashboardOptions
} from './deploy.js'

// Collector
export {
  collectTestData,
  collectFromRunData,
  preserveActionDist,
  type CollectResult,
  type CollectFromRunDataResult,
  type CollectWithDeployOptions
} from './collector.js'
