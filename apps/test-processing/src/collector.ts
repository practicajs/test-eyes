import type { CollectOptions, CollectFromRunDataOptions } from './types.js'
import { parseAndBuildRunData } from './junit-parser.js'
import { aggregate } from './aggregate.js'
import { copyToTemp, generateTestDataFilename } from './file-operations.js'
import {
  configureGit,
  getDefaultGitConfig,
  fetchBranches,
  checkoutOrCreateBranch,
  pushToGitHub,
  getCurrentBranch
} from './git-operations.js'

// ============================================================================
// Format-Agnostic Collection (Core Function)
// ============================================================================

export interface CollectFromRunDataResult {
  success: boolean
  message: string
  commitSha?: string
  aggregatedRuns: number
}

/**
 * Format-agnostic collection function. Both JUnit and Playwright collectors
 * call this shared function. All format-specific logic stays in collectors.
 */
export async function collectFromRunData(
  options: CollectFromRunDataOptions
): Promise<CollectFromRunDataResult> {
  const { runData, dataBranch } = options

  try {
    // Step 1: Configure git
    await configureGit(getDefaultGitConfig())
    const originalBranch = await getCurrentBranch()

    // Step 2: Fetch branch (no checkout yet - using git show to read data)
    console.log(`[test-eyes] Fetching branches: main, ${dataBranch}`)
    await fetchBranches(['main', dataBranch])

    // Step 3: Generate filename once for consistency
    const dataDir = 'data'
    const runDataFilename = generateTestDataFilename(runData.commitSha)

    // Step 4: Aggregate using git show (no checkout needed for reading)
    console.log('[test-eyes] Running aggregation...')
    const aggregateResult = await aggregate({
      dataDir,
      dataBranch, // fetch history via git show
      currentRunData: runData,
      currentRunFilename: runDataFilename
    })
    console.log(`[test-eyes] Aggregated ${aggregateResult.totalRuns} runs, ${aggregateResult.totalTests} tests`)

    // Step 5: Now checkout for writing
    console.log(`[test-eyes] Checking out ${dataBranch}`)
    const isNew = await checkoutOrCreateBranch(dataBranch)
    if (isNew) {
      console.log(`[test-eyes] Created new branch: ${dataBranch}`)
    }

    // Step 6: Commit and push via stubbable boundary (handles file writing)
    const commitSha = await pushToGitHub({
      branch: dataBranch,
      message: `Add test data: ${runData.runId}`,
      runData,
      runDataFilename,
      aggregatedData: aggregateResult.data
    })

    if (commitSha) {
      console.log(`[test-eyes] Committed and pushed: ${commitSha.slice(0, 7)}`)
    } else {
      console.log('[test-eyes] No changes to commit')
    }

    // Step 7: Return to original branch
    if (originalBranch && originalBranch !== dataBranch) {
      await checkoutOrCreateBranch(originalBranch)
    }

    return {
      success: true,
      message: 'Test data collected successfully',
      commitSha: commitSha ?? undefined,
      aggregatedRuns: aggregateResult.totalRuns
    }
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
      aggregatedRuns: 0
    }
  }
}

// ============================================================================
// Collection Result
// ============================================================================

export interface CollectResult {
  success: boolean
  message: string
  testsFound: number
  aggregatedRuns: number
  dataFile?: string
}

// ============================================================================
// Collect and Store Test Data
// ============================================================================

export async function collectTestData(options: CollectOptions): Promise<CollectResult> {
  const {
    junitPath,
    dataBranch,
    commitSha,
    prNumber
  } = options

  try {
    // Step 1: Parse JUnit XML
    console.log(`Parsing JUnit file: ${junitPath}`)
    const runData = await parseAndBuildRunData(junitPath, { commitSha, prNumber })
    console.log(`Found ${runData.tests.length} tests`)

    // Step 2: Configure git
    await configureGit(getDefaultGitConfig())

    // Step 3: Fetch branches (no checkout yet)
    console.log(`Fetching branches: main, ${dataBranch}`)
    await fetchBranches(['main', dataBranch])

    // Step 4: Generate filename once for consistency
    const dataDir = 'data'
    const runDataFilename = generateTestDataFilename(commitSha)

    // Step 5: Aggregate using git show (no checkout needed for reading)
    console.log('Running aggregation...')
    const aggregateResult = await aggregate({
      dataDir,
      dataBranch,
      currentRunData: runData,
      currentRunFilename: runDataFilename
    })
    console.log(`Aggregated ${aggregateResult.totalRuns} runs, ${aggregateResult.totalTests} tests`)

    // Step 6: Now checkout for writing
    console.log(`Checking out ${dataBranch}`)
    const isNew = await checkoutOrCreateBranch(dataBranch)
    if (isNew) {
      console.log(`Created new branch: ${dataBranch}`)
    }

    // Step 7: Commit and push via stubbable boundary (handles file writing)
    const commitSha_ = await pushToGitHub({
      branch: dataBranch,
      message: `Add test data for ${commitSha.slice(0, 7)}`,
      runData,
      runDataFilename,
      aggregatedData: aggregateResult.data
    })

    if (commitSha_) {
      console.log(`Committed and pushed: ${commitSha_.slice(0, 7)}`)
    } else {
      console.log('No changes to commit')
    }

    return {
      success: true,
      message: 'Test data collected successfully',
      testsFound: runData.tests.length,
      aggregatedRuns: aggregateResult.totalRuns
    }
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
      testsFound: 0,
      aggregatedRuns: 0
    }
  }
}

// ============================================================================
// Collect with Temp Script Preservation
// ============================================================================

export interface CollectWithDeployOptions extends CollectOptions {
  actionDistDir: string
}

export async function preserveActionDist(actionDistDir: string): Promise<string> {
  console.log('Preserving action-dist to temp...')
  return copyToTemp(actionDistDir, 'test-eyes-dist')
}
