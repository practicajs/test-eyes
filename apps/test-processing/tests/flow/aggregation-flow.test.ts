/**
 * Aggregation Flow Tests
 *
 * Entry point: aggregateAndSummarize() function
 * Stub boundary: fetchTestHistory (existing history), file system (run files)
 * Assert on: returned history and summary objects
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { aggregateAndSummarize, HISTORY_CAP } from '../../src/aggregate.js'
import * as gitOps from '../../src/git-operations.js'
import { makeRunFile, makeHistoryEntry } from './factories.js'
import type { TestHistory } from '../../src/types.js'

// ============================================================================
// Test Data Directory
// ============================================================================

let TEST_DATA_DIR: string
let RUNS_DIR: string

async function setupTestDir(): Promise<void> {
  const uniqueId = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`
  TEST_DATA_DIR = `/tmp/test-eyes-aggregation-${uniqueId}`
  RUNS_DIR = path.join(TEST_DATA_DIR, 'runs')
  await mkdir(RUNS_DIR, { recursive: true })
}

async function writeRunFile(filename: string, runData: ReturnType<typeof makeRunFile>): Promise<void> {
  await writeFile(path.join(RUNS_DIR, filename), JSON.stringify(runData, null, 2))
}

async function getRunFiles(): Promise<string[]> {
  if (!existsSync(RUNS_DIR)) return []
  return readdir(RUNS_DIR)
}

// ============================================================================
// Stub Setup
// ============================================================================

let mockedHistory: TestHistory = { schemaVersion: '1.0.0', tests: {} }

vi.mock('../../src/git-operations.js', async (importOriginal) => {
  const actual = await importOriginal<typeof gitOps>()
  return {
    ...actual,
    fetchTestHistory: vi.fn(async () => mockedHistory)
  }
})

// ============================================================================
// Tests
// ============================================================================

describe('Aggregation Flow', () => {
  beforeEach(async () => {
    mockedHistory = { schemaVersion: '1.0.0', tests: {} }
    await setupTestDir()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    if (existsSync(TEST_DATA_DIR)) {
      await rm(TEST_DATA_DIR, { recursive: true, force: true })
    }
  })

  it('11.1 Single run, single test', async () => {
    // WHEN no history exists and 1 run file has Auth > login passing at 200ms
    const runFile = makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 200, status: 'passed' }]
    })
    await writeRunFile('run1.json', runFile)

    const { history, summary } = await aggregateAndSummarize(TEST_DATA_DIR)

    // THEN history has 1 entry, summary has passCount: 1, avgDurationMs: 200, p95: 200
    expect(history.tests['Auth > login']).toHaveLength(1)
    expect(summary.tests['Auth > login']).toEqual(
      expect.objectContaining({
        passCount: 1,
        avgDurationMs: 200,
        p95DurationMs: 200
      })
    )
  })

  it('11.2 Multiple run files processed', async () => {
    // WHEN no history exists and 2 run files each have Auth > login (200ms, 300ms)
    await writeRunFile('run1.json', makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 200, status: 'passed' }]
    }))
    await writeRunFile('run2.json', makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 300, status: 'passed' }]
    }))

    const { history, summary } = await aggregateAndSummarize(TEST_DATA_DIR)

    // THEN history has 2 entries, summary has totalRuns: 2, avgDurationMs: 250
    expect(history.tests['Auth > login']).toHaveLength(2)
    expect(summary.tests['Auth > login']).toEqual(
      expect.objectContaining({
        totalRuns: 2,
        avgDurationMs: 250
      })
    )
  })

  it('11.3 New runs append to existing history', async () => {
    // WHEN history has 3 entries for Auth > login and 1 new run file arrives
    mockedHistory = {
      schemaVersion: '1.0.0',
      tests: {
        'Auth > login': [
          makeHistoryEntry({ runId: 'r1', durationMs: 100 }),
          makeHistoryEntry({ runId: 'r2', durationMs: 110 }),
          makeHistoryEntry({ runId: 'r3', durationMs: 120 })
        ]
      }
    }

    await writeRunFile('run4.json', makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 130, status: 'passed' }]
    }))

    const { history } = await aggregateAndSummarize(TEST_DATA_DIR)

    // THEN history has 4 entries (3 old + 1 new), old entries preserved
    const entries = history.tests['Auth > login']
    expect(entries).toHaveLength(4)
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ runId: 'r1' }),
        expect.objectContaining({ runId: 'r2' }),
        expect.objectContaining({ runId: 'r3' }),
        expect.objectContaining({ status: 'passed', durationMs: 130 })
      ])
    )
  })

  it('11.4 History capped at HISTORY_CAP', async () => {
    // WHEN history has HISTORY_CAP-1 entries and 2 new run files arrive
    mockedHistory = {
      schemaVersion: '1.0.0',
      tests: {
        'Auth > login': Array.from({ length: HISTORY_CAP - 1 }, (_, i) =>
          makeHistoryEntry({ runId: `r${i}`, durationMs: 100 + i })
        )
      }
    }

    await writeRunFile('run200.json', makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 500, status: 'passed' }]
    }))
    await writeRunFile('run201.json', makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 600, status: 'passed' }]
    }))

    const { history } = await aggregateAndSummarize(TEST_DATA_DIR)

    // THEN history has exactly HISTORY_CAP entries (oldest dropped)
    const entries = history.tests['Auth > login']
    expect(entries).toHaveLength(HISTORY_CAP)
    // First entry should be r1 (r0 was dropped), last should have durationMs: 600
    expect(entries[0].runId).toBe('r1')
    expect(entries[entries.length - 1].durationMs).toBe(600)
  })

  it('11.5 p95 from real durations', async () => {
    // WHEN 10 run files for Auth > login with specific durations
    const durations = [100, 150, 200, 250, 300, 350, 400, 450, 500, 2000]

    // Create 10 separate run files to get 10 history entries
    for (let i = 0; i < durations.length; i++) {
      await writeRunFile(`run${i}.json`, makeRunFile({
        tests: [{ name: 'Auth > login', durationMs: durations[i], status: 'passed' }]
      }))
    }

    const { summary } = await aggregateAndSummarize(TEST_DATA_DIR)

    // THEN summary has p95DurationMs: 2000 (real 95th percentile, NOT average of 470)
    expect(summary.tests['Auth > login'].p95DurationMs).toBe(2000)
    // Verify avg is NOT 2000 (to confirm p95 is different from avg)
    expect(summary.tests['Auth > login'].avgDurationMs).toBe(470)
  })

  it('11.6 Mixed pass/fail/flaky counts', async () => {
    // WHEN 3 run files for Auth > login: passed, failed, passed+flaky
    await writeRunFile('run1.json', makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 100, status: 'passed', wasFlaky: false }]
    }))
    await writeRunFile('run2.json', makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 200, status: 'failed', wasFlaky: false }]
    }))
    await writeRunFile('run3.json', makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 300, status: 'passed', wasFlaky: true }]
    }))

    const { summary } = await aggregateAndSummarize(TEST_DATA_DIR)

    // THEN summary has passCount: 2, failCount: 1, flakyCount: 1
    expect(summary.tests['Auth > login']).toEqual(
      expect.objectContaining({
        passCount: 2,
        failCount: 1,
        flakyCount: 1
      })
    )
  })

  it('11.7 New test added to history', async () => {
    // WHEN history has Auth > login and run file has Auth > login AND Checkout > pay
    mockedHistory = {
      schemaVersion: '1.0.0',
      tests: {
        'Auth > login': [makeHistoryEntry({ runId: 'r1', durationMs: 100 })]
      }
    }

    await writeRunFile('run2.json', makeRunFile({
      tests: [
        { name: 'Auth > login', durationMs: 110, status: 'passed' },
        { name: 'Checkout > pay', durationMs: 500, status: 'passed' }
      ]
    }))

    const { history, summary } = await aggregateAndSummarize(TEST_DATA_DIR)

    // THEN history has both tests, summary has both tests
    expect(history.tests['Auth > login']).toHaveLength(2)
    expect(history.tests['Checkout > pay']).toHaveLength(1)
    expect(summary.tests['Auth > login']).toBeDefined()
    expect(summary.tests['Checkout > pay']).toBeDefined()
  })

  it('11.8 Unmentioned test preserved', async () => {
    // WHEN history has Auth > login (5 entries) and run file has only Checkout > pay
    mockedHistory = {
      schemaVersion: '1.0.0',
      tests: {
        'Auth > login': Array.from({ length: 5 }, (_, i) =>
          makeHistoryEntry({ runId: `r${i}`, durationMs: 100 + i * 10 })
        )
      }
    }

    await writeRunFile('run6.json', makeRunFile({
      tests: [{ name: 'Checkout > pay', durationMs: 500, status: 'passed' }]
    }))

    const { history, summary } = await aggregateAndSummarize(TEST_DATA_DIR)

    // THEN Auth > login stays in history + summary unchanged, Checkout > pay added
    expect(history.tests['Auth > login']).toHaveLength(5)
    expect(history.tests['Checkout > pay']).toHaveLength(1)
    expect(summary.tests['Auth > login'].totalRuns).toBe(5)
    expect(summary.tests['Checkout > pay'].totalRuns).toBe(1)
  })

  it('11.9 Run files deleted after processing', async () => {
    // WHEN 2 run files in inbox and aggregation succeeds
    await writeRunFile('run1.json', makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 100, status: 'passed' }]
    }))
    await writeRunFile('run2.json', makeRunFile({
      tests: [{ name: 'Auth > logout', durationMs: 200, status: 'passed' }]
    }))

    // Verify files exist before
    const filesBefore = await getRunFiles()
    expect(filesBefore).toHaveLength(2)

    await aggregateAndSummarize(TEST_DATA_DIR)

    // THEN both files are deleted after aggregate returns
    const filesAfter = await getRunFiles()
    expect(filesAfter).toHaveLength(0)
  })

  it('11.10 No run files — nothing changes', async () => {
    // WHEN history has 3 entries and no run files in inbox
    mockedHistory = {
      schemaVersion: '1.0.0',
      tests: {
        'Auth > login': [
          makeHistoryEntry({ runId: 'r1', durationMs: 100 }),
          makeHistoryEntry({ runId: 'r2', durationMs: 110 }),
          makeHistoryEntry({ runId: 'r3', durationMs: 120 })
        ]
      }
    }

    const { history, summary } = await aggregateAndSummarize(TEST_DATA_DIR)

    // THEN history and summary returned unchanged, no files deleted
    expect(history.tests['Auth > login']).toHaveLength(3)
    expect(summary.tests['Auth > login'].totalRuns).toBe(3)
    expect(summary.tests['Auth > login'].avgDurationMs).toBe(110)
  })
})
