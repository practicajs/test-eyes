/**
 * Test helper functions for flow tests.
 */

import { mkdir, writeFile, rm, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import type { RunData } from '../../src/types.js'
import { makeRunFile } from './factories.js'

// =============================================================================
// Temp Directory Helpers
// =============================================================================

export interface TestDirContext {
  dataDir: string
  runsDir: string
}

export async function createTempTestDir(): Promise<TestDirContext> {
  const uniqueId = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`
  const dataDir = `/tmp/test-eyes-aggregation-${uniqueId}`
  const runsDir = path.join(dataDir, 'runs')
  await mkdir(runsDir, { recursive: true })
  return { dataDir, runsDir }
}

export async function cleanupTempTestDir(ctx: TestDirContext): Promise<void> {
  if (ctx.dataDir && existsSync(ctx.dataDir)) {
    await rm(ctx.dataDir, { recursive: true, force: true })
  }
}

export async function getRunFiles(runsDir: string): Promise<string[]> {
  if (!existsSync(runsDir)) return []
  return readdir(runsDir)
}

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
