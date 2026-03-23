import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { aggregate } from '../src/aggregate.js'

const TEST_DIR = '.test-data'

describe('aggregate', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true })
  })

  it('should create main-test-data.json when no data exists', async () => {
    const runData = {
      runId: '2024-01-01_abc1234',
      prNumber: 1,
      commitSha: 'abc1234',
      createdAt: '2024-01-01T00:00:00Z',
      tests: [
        { name: 'test1', durationMs: 100, status: 'passed' as const },
        { name: 'test2', durationMs: 200, status: 'failed' as const }
      ]
    }

    await fs.writeFile(
      path.join(TEST_DIR, '2024-01-01_abc1234.json'),
      JSON.stringify(runData)
    )

    await aggregate(TEST_DIR)

    const mainData = JSON.parse(
      await fs.readFile(path.join(TEST_DIR, 'main-test-data.json'), 'utf-8')
    )

    expect(mainData.schemaVersion).toBe('1.0.0')
    expect(mainData.meta.totalRuns).toBe(1)
    expect(mainData.tests['test1'].passCount).toBe(1)
    expect(mainData.tests['test2'].failCount).toBe(1)
  })

  it('should track flaky tests', async () => {
    const runData = {
      runId: '2024-01-01_abc1234',
      prNumber: 1,
      commitSha: 'abc1234',
      createdAt: '2024-01-01T00:00:00Z',
      tests: [
        { name: 'flaky-test', durationMs: 100, status: 'passed' as const, wasFlaky: true }
      ]
    }

    await fs.writeFile(
      path.join(TEST_DIR, '2024-01-01_abc1234.json'),
      JSON.stringify(runData)
    )

    await aggregate(TEST_DIR)

    const mainData = JSON.parse(
      await fs.readFile(path.join(TEST_DIR, 'main-test-data.json'), 'utf-8')
    )

    expect(mainData.tests['flaky-test'].flakyCount).toBe(1)
  })

  it('should aggregate multiple runs', async () => {
    const run1 = {
      runId: '2024-01-01_abc1234',
      prNumber: 1,
      commitSha: 'abc1234',
      createdAt: '2024-01-01T00:00:00Z',
      tests: [{ name: 'test1', durationMs: 100, status: 'passed' as const }]
    }

    const run2 = {
      runId: '2024-01-02_def5678',
      prNumber: 2,
      commitSha: 'def5678',
      createdAt: '2024-01-02T00:00:00Z',
      tests: [{ name: 'test1', durationMs: 150, status: 'passed' as const }]
    }

    await fs.writeFile(
      path.join(TEST_DIR, '2024-01-01_abc1234.json'),
      JSON.stringify(run1)
    )
    await fs.writeFile(
      path.join(TEST_DIR, '2024-01-02_def5678.json'),
      JSON.stringify(run2)
    )

    await aggregate(TEST_DIR)

    const mainData = JSON.parse(
      await fs.readFile(path.join(TEST_DIR, 'main-test-data.json'), 'utf-8')
    )

    expect(mainData.meta.totalRuns).toBe(2)
    expect(mainData.tests['test1'].totalRuns).toBe(2)
    expect(mainData.tests['test1'].passCount).toBe(2)
    expect(mainData.tests['test1'].avgDurationMs).toBe(125)
  })
})
