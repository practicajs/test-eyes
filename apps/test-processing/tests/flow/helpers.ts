/**
 * Test helper functions for flow tests.
 */

import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import type { RunData } from '../../src/types.js'
import { makeRunFile } from './factories.js'

// =============================================================================
// File System Helpers
// =============================================================================

export async function createRunFiles(
  runsDir: string,
  configs: Array<{ filename: string; tests: Parameters<typeof makeRunFile>[0]['tests'] }>
): Promise<void> {
  await mkdir(runsDir, { recursive: true })
  await Promise.all(
    configs.map(({ filename, tests }) =>
      writeFile(
        path.join(runsDir, filename),
        JSON.stringify(makeRunFile({ tests }), null, 2)
      )
    )
  )
}

export async function writeRunFile(
  runsDir: string,
  filename: string,
  runData: RunData
): Promise<void> {
  await writeFile(path.join(runsDir, filename), JSON.stringify(runData, null, 2))
}

/**
 * Creates multiple run files with a single test at different durations.
 * Useful for testing p95 calculations.
 */
export async function createRunFilesWithDurations(
  runsDir: string,
  testName: string,
  durations: number[]
): Promise<void> {
  await Promise.all(
    durations.map((duration, i) =>
      writeFile(
        path.join(runsDir, `run${i}.json`),
        JSON.stringify(makeRunFile({ tests: [{ name: testName, durationMs: duration, status: 'passed' }] }), null, 2)
      )
    )
  )
}
