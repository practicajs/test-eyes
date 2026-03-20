import path from 'path'
import type { RunData } from './types.js'
import { loadJson, saveJson, listJsonFiles } from './file-operations.js'

interface TestStats {
  totalRuns: number
  passCount: number
  failCount: number
  flakyCount: number
  avgDurationMs: number
  p95DurationMs: number
}

interface AggregatedMeta {
  totalRuns: number
  lastAggregatedAt: string | null
  processedFiles: string[]
}

interface AggregatedData {
  schemaVersion: string
  meta: AggregatedMeta
  tests: Record<string, TestStats>
}

function createEmptyAggregatedData(): AggregatedData {
  return {
    schemaVersion: '1.0.0',
    meta: {
      totalRuns: 0,
      lastAggregatedAt: null,
      processedFiles: []
    },
    tests: {}
  }
}

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

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function calculateP95(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil(0.95 * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

function isValidRunData(data: unknown): data is RunData {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.runId !== 'string') return false
  if (!Array.isArray(obj.tests)) return false
  return true
}

export async function aggregate(dataDir: string): Promise<void> {
  const outputFile = path.join(dataDir, 'main-test-data.json')

  // Load existing data or create new
  let data = await loadJson<AggregatedData>(outputFile)
  if (!data) {
    data = createEmptyAggregatedData()
  }

  const processedSet = new Set(data.meta.processedFiles)
  const allFiles = await listJsonFiles(dataDir)
  const newFiles = allFiles.filter(
    f => !processedSet.has(f) && f !== 'main-test-data.json' && f !== 'index.json'
  )

  if (newFiles.length === 0) {
    return
  }

  // Reconstruct durations map
  const durations = new Map<string, number[]>()
  for (const [testName, stats] of Object.entries(data.tests)) {
    durations.set(testName, Array(stats.totalRuns).fill(stats.avgDurationMs))
  }

  // Process new files
  for (const filename of newFiles) {
    const filepath = path.join(dataDir, filename)
    const runData = await loadJson<RunData>(filepath)

    if (!runData || !isValidRunData(runData)) {
      console.warn(`Skipping invalid file: ${filename}`)
      continue
    }

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

  // Recalculate stats
  for (const [testName, stats] of Object.entries(data.tests)) {
    const testDurations = durations.get(testName) || []
    if (testDurations.length > 0) {
      stats.avgDurationMs = calculateAverage(testDurations)
      stats.p95DurationMs = calculateP95(testDurations)
    }
  }

  data.meta.lastAggregatedAt = new Date().toISOString()
  await saveJson(outputFile, data)
}
