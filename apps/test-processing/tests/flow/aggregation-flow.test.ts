/**
 * Aggregation Flow Tests
 *
 * Entry point: aggregateAndSummarize() function
 * Stub boundary: fetchTestHistory (existing history), file system (run files)
 * Assert on: returned history and summary objects
 *
 * Note: Uses real /tmp file system intentionally - this is a flow/integration test
 * that verifies the full aggregation pipeline including file I/O operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFile } from 'fs/promises'
import path from 'path'
import { aggregateAndSummarize, HISTORY_CAP } from '../../src/aggregate.js'
import * as gitOps from '../../src/git-operations.js'
import { makeRunFile, makeHistoryEntry } from './factories.js'
import {
  createRunFilesWithDurations,
  createTempTestDir,
  cleanupTempTestDir,
  getRunFiles,
  type TestDirContext
} from './helpers.js'
import type { TestHistory } from '../../src/types.js'

// ============================================================================
// Stub Setup - Using vi.hoisted() for proper isolation
// ============================================================================

const { getMockedHistory, setMockedHistory } = vi.hoisted(() => {
  let _mockedHistory: TestHistory = { schemaVersion: '1.0.0', tests: {} }
  return {
    getMockedHistory: () => _mockedHistory,
    setMockedHistory: (history: TestHistory) => { _mockedHistory = history }
  }
})

vi.mock('../../src/git-operations.js', async (importOriginal) => {
  const actual = await importOriginal<typeof gitOps>()
  return {
    ...actual,
    fetchTestHistory: vi.fn(async () => getMockedHistory())
  }
})

// ============================================================================
// Tests
// ============================================================================

describe('Aggregation Flow', () => {
  let ctx: TestDirContext

  async function writeRunFile(filename: string, runData: ReturnType<typeof makeRunFile>): Promise<void> {
    await writeFile(path.join(ctx.runsDir, filename), JSON.stringify(runData, null, 2))
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    setMockedHistory({ schemaVersion: '1.0.0', tests: {} })
    ctx = await createTempTestDir()
  })

  afterEach(async () => {
    await cleanupTempTestDir(ctx)
  })

  it('When single run with single test, then history and summary reflect that test', async () => {
    const runFile = makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 200, status: 'passed' }]
    })
    await writeRunFile('run1.json', runFile)

    const { history, summary } = await aggregateAndSummarize(ctx.dataDir)

    expect(history.tests['Auth > login']).toHaveLength(1)
    expect(summary.tests['Auth > login']).toEqual(
      expect.objectContaining({ passCount: 1, avgDurationMs: 200, p95DurationMs: 200 })
    )
  })

  it('When multiple run files exist, then all are aggregated into history', async () => {
    await writeRunFile('run1.json', makeRunFile({ tests: [{ name: 'Auth > login', durationMs: 200, status: 'passed' }] }))
    await writeRunFile('run2.json', makeRunFile({ tests: [{ name: 'Auth > login', durationMs: 300, status: 'passed' }] }))

    const { history, summary } = await aggregateAndSummarize(ctx.dataDir)

    expect(history.tests['Auth > login']).toHaveLength(2)
    expect(summary.tests['Auth > login']).toEqual(expect.objectContaining({ totalRuns: 2, avgDurationMs: 250 }))
  })

  it('When new runs arrive, then they append to existing history', async () => {
    setMockedHistory({
      schemaVersion: '1.0.0',
      tests: { 'Auth > login': [makeHistoryEntry({ runId: 'r1' }), makeHistoryEntry({ runId: 'r2' })] }
    })
    await writeRunFile('run3.json', makeRunFile({ tests: [{ name: 'Auth > login', durationMs: 130, status: 'passed' }] }))

    const { history } = await aggregateAndSummarize(ctx.dataDir)

    expect(history.tests['Auth > login']).toHaveLength(3)
    expect(history.tests['Auth > login'].map(e => e.runId)).toContain('r1')
  })

  it('When history exceeds cap, then oldest entries are dropped', async () => {
    setMockedHistory({
      schemaVersion: '1.0.0',
      tests: { 'Auth > login': Array.from({ length: HISTORY_CAP - 1 }, (_, i) => makeHistoryEntry({ runId: `r${i}` })) }
    })
    await writeRunFile('run200.json', makeRunFile({ tests: [{ name: 'Auth > login', durationMs: 500, status: 'passed' }] }))
    await writeRunFile('run201.json', makeRunFile({ tests: [{ name: 'Auth > login', durationMs: 600, status: 'passed' }] }))

    const { history } = await aggregateAndSummarize(ctx.dataDir)

    expect(history.tests['Auth > login']).toHaveLength(HISTORY_CAP)
    expect(history.tests['Auth > login'][0].runId).toBe('r1')
  })

  it('When calculating p95, then uses real 95th percentile of durations', async () => {
    const durations = [100, 150, 200, 250, 300, 350, 400, 450, 500, 2000]
    await createRunFilesWithDurations(ctx.runsDir, 'Auth > login', durations)

    const { summary } = await aggregateAndSummarize(ctx.dataDir)

    expect(summary.tests['Auth > login']).toEqual(expect.objectContaining({
      p95DurationMs: 2000,
      avgDurationMs: 470
    }))
  })

  it('When tests have mixed results, then summary counts pass/fail/flaky correctly', async () => {
    await writeRunFile('run1.json', makeRunFile({ tests: [{ name: 'Auth > login', durationMs: 100, status: 'passed' }] }))
    await writeRunFile('run2.json', makeRunFile({ tests: [{ name: 'Auth > login', durationMs: 200, status: 'failed' }] }))
    await writeRunFile('run3.json', makeRunFile({ tests: [{ name: 'Auth > login', durationMs: 300, status: 'passed', wasFlaky: true }] }))

    const { summary } = await aggregateAndSummarize(ctx.dataDir)

    expect(summary.tests['Auth > login']).toEqual(
      expect.objectContaining({ passCount: 2, failCount: 1, flakyCount: 1 })
    )
  })

  it('When new test appears in run, then history and summary include the new test', async () => {
    setMockedHistory({ schemaVersion: '1.0.0', tests: { 'Auth > login': [makeHistoryEntry({ runId: 'r1' })] } })
    await writeRunFile('run2.json', makeRunFile({
      tests: [{ name: 'Auth > login', durationMs: 110, status: 'passed' }, { name: 'Checkout > pay', durationMs: 500, status: 'passed' }]
    }))

    const { history, summary } = await aggregateAndSummarize(ctx.dataDir)

    expect(Object.keys(history.tests)).toEqual(['Auth > login', 'Checkout > pay'])
    expect(Object.keys(summary.tests)).toEqual(['Auth > login', 'Checkout > pay'])
  })

  it('When test not in current run, then its history is preserved', async () => {
    setMockedHistory({
      schemaVersion: '1.0.0',
      tests: { 'Auth > login': Array.from({ length: 5 }, (_, i) => makeHistoryEntry({ runId: `r${i}` })) }
    })
    await writeRunFile('run6.json', makeRunFile({ tests: [{ name: 'Checkout > pay', durationMs: 500, status: 'passed' }] }))

    const { history, summary } = await aggregateAndSummarize(ctx.dataDir)

    expect(history.tests['Auth > login']).toHaveLength(5)
    expect(summary.tests['Checkout > pay'].totalRuns).toBe(1)
  })

  it('When aggregation completes, then run files are deleted', async () => {
    await writeRunFile('run1.json', makeRunFile({ tests: [{ name: 'Auth > login', durationMs: 100, status: 'passed' }] }))
    await writeRunFile('run2.json', makeRunFile({ tests: [{ name: 'Auth > logout', durationMs: 200, status: 'passed' }] }))

    await aggregateAndSummarize(ctx.dataDir)

    expect(await getRunFiles(ctx.runsDir)).toHaveLength(0)
  })

  it('When no run files exist, then history remains unchanged', async () => {
    setMockedHistory({
      schemaVersion: '1.0.0',
      tests: { 'Auth > login': [makeHistoryEntry({ runId: 'r1', durationMs: 100 }), makeHistoryEntry({ runId: 'r2', durationMs: 120 })] }
    })

    const { history, summary } = await aggregateAndSummarize(ctx.dataDir)

    expect(history.tests['Auth > login']).toHaveLength(2)
    expect(summary.tests['Auth > login']).toEqual(expect.objectContaining({ totalRuns: 2, avgDurationMs: 110 }))
  })
})
