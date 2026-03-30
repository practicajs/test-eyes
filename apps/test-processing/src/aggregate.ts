import path from 'path'
import type {
  AggregatedData,
  TestStats,
  RunData,
  TestHistory,
  RecentExecution
} from './types.js'
import { findJsonFiles, loadTestData, deleteFile } from './file-operations.js'
import { fetchTestHistory } from './git-operations.js'

// ============================================================================
// Statistics Calculation (UNCHANGED)
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
// Data Validation (UNCHANGED)
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
// Derive Stats from Executions
// ============================================================================

export const HISTORY_CAP = 200

export function deriveStats(executions: RecentExecution[]): TestStats {
  const durations = executions.map(e => e.durationMs)

  return {
    totalRuns: executions.length,
    passCount: executions.filter(e => e.status === 'passed').length,
    failCount: executions.filter(e => e.status === 'failed').length,
    flakyCount: executions.filter(e => e.wasFlaky).length,
    avgDurationMs: calculateAverage(durations),
    p95DurationMs: calculateP95(durations)
  }
}

// ============================================================================
// Main Aggregation Function
// ============================================================================

/**
 * Aggregates test run data: reads run files from inbox, ingests into history,
 * derives summary stats, deletes processed run files.
 * Caller writes both files to disk, commits, and pushes to gh-data.
 */
export async function aggregateAndSummarize(
  dataDir: string,
  dataBranch: string = 'gh-data'
): Promise<{ history: TestHistory; summary: AggregatedData }> {
  const runsDir = path.join(dataDir, 'runs')

  // ═══════════════════════════════════════════════════════════════════════
  // AGGREGATOR — ingest run files into test-history.json
  // ═══════════════════════════════════════════════════════════════════════

  // Step 1: Read existing history
  const history = await fetchTestHistory(dataBranch)

  // Step 2: Find all run files in the inbox
  const runFiles = await findJsonFiles(runsDir)

  // Step 3: Ingest each run file into history
  for (const filename of runFiles) {
    const filepath = path.join(runsDir, filename)
    const run = await loadTestData(filepath)
    if (!run || !isValidRunData(run)) continue

    for (const test of run.tests) {
      if (!history.tests[test.name]) {
        history.tests[test.name] = []
      }

      history.tests[test.name].push({
        runId: run.runId,
        status: test.status,
        durationMs: test.durationMs,
        timestamp: run.createdAt,
        failureMessage: test.failureMessage,
        wasFlaky: test.wasFlaky ?? false
      })

      // Cap at 200 — drop oldest entries
      if (history.tests[test.name].length > HISTORY_CAP) {
        history.tests[test.name] = history.tests[test.name].slice(-HISTORY_CAP)
      }
    }

    await deleteFile(filepath)  // processed — remove from inbox
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARIZER — derive test-summary.json from test-history.json
  // ═══════════════════════════════════════════════════════════════════════

  const summary: AggregatedData = {
    schemaVersion: '1.0.0',
    meta: { lastAggregatedAt: new Date().toISOString() },
    tests: {}
  }

  for (const [testName, executions] of Object.entries(history.tests)) {
    summary.tests[testName] = deriveStats(executions)
  }

  // Caller writes both files to disk, commits, and pushes to gh-data
  return { history, summary }
}
