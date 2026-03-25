import path from 'path'
import type { AggregatedData, TestStats, RunData } from './types.js'
import {
  loadAggregatedData,
  findUnprocessedFiles,
  loadTestData
} from './file-operations.js'

// ============================================================================
// Statistics Calculation
// ============================================================================

export function calculateP95(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil(0.95 * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

// ============================================================================
// Data Validation
// ============================================================================

export function isValidRunData(data: unknown): data is RunData {
  if (typeof data !== 'object' || data === null) return false

  const obj = data as Record<string, unknown>

  if (typeof obj.runId !== 'string') return false
  if (!Array.isArray(obj.tests)) return false

  return obj.tests.every(
    (t: unknown) =>
      typeof t === 'object' &&
      t !== null &&
      typeof (t as Record<string, unknown>).name === 'string' &&
      typeof (t as Record<string, unknown>).durationMs === 'number' &&
      ['passed', 'failed', 'skipped'].includes((t as Record<string, unknown>).status as string)
  )
}

// ============================================================================
// Test Processing
// ============================================================================

function createEmptyStats(): TestStats {
  return {
    totalRuns: 0,
    passCount: 0,
    failCount: 0,
    flakyCount: 0,
    avgDurationMs: 0,
    p95DurationMs: 0
  }
}

export function processTestRun(
  data: AggregatedData,
  durations: Map<string, number[]>,
  runData: RunData,
  filename: string
): void {
  data.meta.totalRuns++
  data.meta.processedFiles.push(filename)

  for (const test of runData.tests) {
    if (!data.tests[test.name]) {
      data.tests[test.name] = createEmptyStats()
      durations.set(test.name, [])
    }

    const stats = data.tests[test.name]
    stats.totalRuns++

    if (test.status === 'passed') {
      stats.passCount++
    } else if (test.status === 'failed') {
      stats.failCount++
    }

    if (test.wasFlaky) {
      stats.flakyCount++
    }

    durations.get(test.name)!.push(test.durationMs)
  }
}

export function recalculateStats(data: AggregatedData, durations: Map<string, number[]>): void {
  for (const [testName, stats] of Object.entries(data.tests)) {
    const testDurations = durations.get(testName) || []
    if (testDurations.length > 0) {
      stats.avgDurationMs = calculateAverage(testDurations)
      stats.p95DurationMs = calculateP95(testDurations)
    }
  }
}

// ============================================================================
// Main Aggregation Function
// ============================================================================

export interface AggregateResult {
  success: boolean
  totalRuns: number
  totalTests: number
  newFilesProcessed: number
  data: AggregatedData
}

export interface AggregateOptions {
  dataDir: string
  currentRunData?: RunData
  currentRunFilename?: string
}

/**
 * Aggregates test run data from existing files on disk.
 * Does NOT write to disk - returns the aggregated data for the caller to handle.
 */
export async function aggregate(options: AggregateOptions): Promise<AggregateResult> {
  const { dataDir, currentRunData, currentRunFilename } = options
  const outputFile = path.join(dataDir, 'main-test-data.json')
  const data = await loadAggregatedData(outputFile)

  // Use Set for O(1) lookup
  const processedSet = new Set(data.meta.processedFiles)
  const newFiles = await findUnprocessedFiles(dataDir, processedSet)

  // Reconstruct durations from existing stats
  const durations = new Map<string, number[]>()
  for (const [testName, stats] of Object.entries(data.tests)) {
    durations.set(testName, Array(stats.totalRuns).fill(stats.avgDurationMs))
  }

  // Process files from disk
  for (const filename of newFiles) {
    const filepath = path.join(dataDir, filename)
    const runData = await loadTestData(filepath)

    if (runData && isValidRunData(runData)) {
      processTestRun(data, durations, runData, filename)
    } else {
      console.warn(`Skipping invalid file: ${filename}`)
    }
  }

  // Process current run data if provided (not yet on disk)
  if (currentRunData && currentRunFilename) {
    if (!processedSet.has(currentRunFilename)) {
      processTestRun(data, durations, currentRunData, currentRunFilename)
    }
  }

  recalculateStats(data, durations)
  data.meta.lastAggregatedAt = new Date().toISOString()

  return {
    success: true,
    totalRuns: data.meta.totalRuns,
    totalTests: Object.keys(data.tests).length,
    newFilesProcessed: newFiles.length + (currentRunData ? 1 : 0),
    data
  }
}
