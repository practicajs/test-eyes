import type { CollectFromRunDataOptions, RunData } from './types.js'
import { saveTestData, generateTestDataFilename, ensureDir } from './file-operations.js'
import {
  configureGit,
  getDefaultGitConfig,
  fetchBranches,
  checkoutOrCreateBranch,
  stageFiles,
  commit,
  pushWithRetry,
  getCurrentBranch
} from './git-operations.js'

// ============================================================================
// Collection Result
// ============================================================================

export interface CollectResult {
  success: boolean
  message: string
  runData?: RunData
}

// ============================================================================
// Format-Agnostic Collection (Simplified - No Aggregation)
// ============================================================================

/**
 * Collection phase: writes run file to data/runs/ and pushes.
 * NO aggregation - that happens in the cron job.
 * Safe for parallel shards due to unique filenames and retry logic.
 */
export async function collectFromRunData(
  options: CollectFromRunDataOptions
): Promise<CollectResult> {
  const { runData, dataBranch } = options

  try {
    // Configure git
    await configureGit(getDefaultGitConfig())
    await fetchBranches([dataBranch])

    // Checkout data branch
    await checkoutOrCreateBranch(dataBranch)

    // Write run file to data/runs/ directory
    const runsDir = 'data/runs'
    const filename = generateTestDataFilename(runData.commitSha)
    await ensureDir(runsDir)
    await saveTestData(runsDir, filename, runData)

    // Stage, commit, push with retry
    await stageFiles(['data/runs'])
    const commitResult = await commit(`Add test run: ${runData.runId}`)
    if (commitResult.success) {
      await pushWithRetry(dataBranch)
    }

    // Return to original branch
    const originalBranch = await getCurrentBranch()
    if (originalBranch && originalBranch !== dataBranch) {
      await checkoutOrCreateBranch(originalBranch)
    }

    return { success: true, message: 'Run file pushed', runData }
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message
    }
  }
}

// ============================================================================
// Push Run Data Only (Stubbable Boundary for Testing)
// ============================================================================

export interface PushRunDataOptions {
  branch: string
  runData: RunData
}

/**
 * Stubbable boundary for testing. Writes run file and pushes.
 * Flow tests stub this function to capture what would be pushed.
 */
export async function pushRunData(options: PushRunDataOptions): Promise<string | null> {
  const { branch, runData } = options

  // Write run file to data/runs/
  const runsDir = 'data/runs'
  await ensureDir(runsDir)
  const filename = generateTestDataFilename(runData.commitSha)
  await saveTestData(runsDir, filename, runData)

  // Stage, commit, push
  await stageFiles(['data/runs'])
  const commitResult = await commit(`Add test run: ${runData.runId}`)

  if (!commitResult.success || !commitResult.commitSha) {
    return null
  }

  const pushResult = await pushWithRetry(branch)
  if (!pushResult.success) {
    return null
  }

  return commitResult.commitSha
}
