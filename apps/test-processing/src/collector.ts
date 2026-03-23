import path from 'path'
import type { CollectOptions, CollectFromRunDataOptions, RunData } from './types.js'
import { parseAndBuildRunData } from './junit-parser.js'
import { aggregate } from './aggregate.js'
import {
  saveTestData,
  generateTestDataFilename,
  ensureDir,
  copyToTemp
} from './file-operations.js'
import {
  configureGit,
  getDefaultGitConfig,
  fetchBranches,
  checkoutOrCreateBranch,
  stageFiles,
  commit,
  push,
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
  const { runData, dataBranch, deployAfterCollect, deployBranch } = options

  try {
    // Step 1: Configure git
    await configureGit(getDefaultGitConfig())
    const originalBranch = await getCurrentBranch()

    // Step 2: Fetch and checkout data branch
    console.log(`[test-eyes] Fetching branches: main, ${dataBranch}`)
    await fetchBranches(['main', dataBranch])

    console.log(`[test-eyes] Checking out ${dataBranch}`)
    const isNew = await checkoutOrCreateBranch(dataBranch)
    if (isNew) {
      console.log(`[test-eyes] Created new branch: ${dataBranch}`)
    }

    // Step 3: Save run data
    const dataDir = 'data'
    await ensureDir(dataDir)
    const filename = generateTestDataFilename(runData.commitSha)
    const dataFilePath = await saveTestData(dataDir, filename, runData)
    console.log(`[test-eyes] Saved test data to: ${dataFilePath}`)

    // Step 4: Aggregate
    console.log('[test-eyes] Running aggregation...')
    const aggregateResult = await aggregate(dataDir)
    console.log(`[test-eyes] Aggregated ${aggregateResult.totalRuns} runs, ${aggregateResult.totalTests} tests`)

    // Step 5: Commit and push via stubbable boundary
    const commitSha = await pushToGitHub({
      branch: dataBranch,
      message: `Add test data: ${runData.runId}`,
      files: ['data/']
    })

    if (commitSha) {
      console.log(`[test-eyes] Committed and pushed: ${commitSha.slice(0, 7)}`)
    } else {
      console.log('[test-eyes] No changes to commit')
    }

    // Step 6: Return to original branch
    if (originalBranch && originalBranch !== dataBranch) {
      await checkoutOrCreateBranch(originalBranch)
    }

    // Note: Deploy is handled separately by the action or CLI
    // as it requires the frontend dist directory

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
    outputPath,
    dataBranch,
    commitSha,
    prNumber
  } = options

  try {
    // Step 1: Parse JUnit XML
    console.log(`Parsing JUnit file: ${junitPath}`)
    const runData = await parseAndBuildRunData(junitPath, { commitSha, prNumber })
    console.log(`Found ${runData.tests.length} tests`)

    // Step 2: Save to temp location (before branch switch)
    const tempDataPath = `/tmp/test-data-${commitSha.slice(0, 7)}.json`
    await saveTestData('/tmp', `test-data-${commitSha.slice(0, 7)}.json`, runData)

    // Step 3: Configure git
    await configureGit(getDefaultGitConfig())

    // Step 4: Fetch branches
    console.log(`Fetching branches: main, ${dataBranch}`)
    await fetchBranches(['main', dataBranch])

    // Step 5: Checkout data branch
    console.log(`Checking out ${dataBranch}`)
    const isNew = await checkoutOrCreateBranch(dataBranch)
    if (isNew) {
      console.log(`Created new branch: ${dataBranch}`)
    }

    // Step 6: Setup data directory and copy test data
    const dataDir = 'data'
    await ensureDir(dataDir)
    const filename = generateTestDataFilename(commitSha)
    const dataFilePath = await saveTestData(dataDir, filename, runData)
    console.log(`Saved test data to: ${dataFilePath}`)

    // Step 7: Run aggregation
    console.log('Running aggregation...')
    const aggregateResult = await aggregate(dataDir)
    console.log(`Aggregated ${aggregateResult.totalRuns} runs, ${aggregateResult.totalTests} tests`)

    // Step 8: Commit and push
    await stageFiles(['data/'])
    const commitResult = await commit(`Add test data for ${commitSha.slice(0, 7)}`)

    if (commitResult.success) {
      console.log('Committed changes')
      const pushResult = await push(dataBranch)
      if (pushResult.success) {
        console.log(`Pushed to ${dataBranch}`)
      } else {
        console.warn(`Push failed: ${pushResult.message}`)
      }
    } else {
      console.log('No changes to commit')
    }

    return {
      success: true,
      message: 'Test data collected successfully',
      testsFound: runData.tests.length,
      aggregatedRuns: aggregateResult.totalRuns,
      dataFile: dataFilePath
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
