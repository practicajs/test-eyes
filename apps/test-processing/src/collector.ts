import type { CollectFromRunDataOptions, RunData } from './types.js'
import {
  getCurrentBranch,
  checkoutOrCreateBranch,
  pushRunDataToGit
} from './git-operations.js'
import { handleError } from 'error-handling'

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
 * Collection phase: pushes run data to git.
 * NO aggregation - that happens in the cron job.
 * Safe for parallel shards due to unique filenames and retry logic.
 */
export async function collectFromRunData(
  options: CollectFromRunDataOptions
): Promise<CollectResult> {
  const { runData, dataBranch } = options

  try {
    // Save original branch before switching
    const originalBranch = await getCurrentBranch()

    // Push run data to git (this is the boundary we mock in tests)
    const pushResult = await pushRunDataToGit({
      branch: dataBranch,
      runData
    })

    // Return to original branch
    if (originalBranch && originalBranch !== dataBranch) {
      await checkoutOrCreateBranch(originalBranch)
    }

    if (!pushResult.success) {
      return { success: false, message: pushResult.message }
    }

    return { success: true, message: 'Run file pushed', runData }
  } catch (error) {
    handleError('collect failed', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}
