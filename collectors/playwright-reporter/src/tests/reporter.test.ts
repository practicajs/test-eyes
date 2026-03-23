import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TestEyesReporter } from '../reporter.js'
import {
  makePlaywrightTestCase,
  makePlaywrightResult,
  resetTestIdCounter
} from './factories.js'
import type { FullConfig, FullResult, Suite } from '@playwright/test/reporter'
import { aggregate, saveTestData, ensureDir, type RunData } from 'test-processing'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// Stub only pushToGitHub - everything else runs for real
vi.mock('test-processing', async () => {
  const actual = await vi.importActual('test-processing')
  return {
    ...actual,
    collectFromRunData: vi.fn().mockResolvedValue({
      success: true,
      message: 'Test data collected',
      commitSha: 'abc1234',
      aggregatedRuns: 1
    })
  }
})

const mockConfig = {} as FullConfig
const mockSuite = {} as Suite
const mockFullResult = { status: 'passed' } as FullResult

describe('TestEyesReporter', () => {
  beforeEach(() => {
    resetTestIdCounter()
    vi.stubEnv('CI', '')
    vi.stubEnv('GITHUB_ACTIONS', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('flaky test detection', () => {
    it('when 2 of 4 test attempts fail then pass, the test is marked as flaky with correct retry count', () => {
      const reporter = new TestEyesReporter()
      reporter.onBegin(mockConfig, mockSuite)

      // Create a test that has 4 attempts: fail, fail, pass, pass (retries = 3)
      const test = makePlaywrightTestCase({
        title: 'flaky test',
        titlePath: ['Suite', 'flaky test'],
        outcome: 'flaky'
      })

      // Simulate 4 attempts
      reporter.onTestEnd(test, makePlaywrightResult({ status: 'failed', retry: 0, duration: 100 }))
      reporter.onTestEnd(test, makePlaywrightResult({ status: 'failed', retry: 1, duration: 100 }))
      reporter.onTestEnd(test, makePlaywrightResult({ status: 'passed', retry: 2, duration: 100 }))
      reporter.onTestEnd(test, makePlaywrightResult({ status: 'passed', retry: 3, duration: 100 }))

      // Access private method via type assertion for testing
      const results = (reporter as any).buildTestResults()

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        name: 'Suite > flaky test',
        status: 'passed',
        wasFlaky: true,
        retries: 3,
        durationMs: 100 // Last attempt duration only
      })
    })
  })

  describe('duration tracking', () => {
    it('when a test is consistently slow, total duration reflects all attempts', () => {
      const reporter = new TestEyesReporter()
      reporter.onBegin(mockConfig, mockSuite)

      const slowTest = makePlaywrightTestCase({
        title: 'slow test',
        outcome: 'expected'
      })

      // Single attempt with high duration
      reporter.onTestEnd(slowTest, makePlaywrightResult({
        status: 'passed',
        duration: 5000
      }))

      const results = (reporter as any).buildTestResults()

      expect(results).toHaveLength(1)
      expect(results[0].durationMs).toBe(5000)
    })
  })

  describe('mixed test statuses', () => {
    it('when mixing passed, failed, and flaky tests in one run, each gets the correct status', () => {
      const reporter = new TestEyesReporter()
      reporter.onBegin(mockConfig, mockSuite)

      // Passed test
      const passedTest = makePlaywrightTestCase({
        id: 'test-1',
        title: 'passed test',
        outcome: 'expected'
      })
      reporter.onTestEnd(passedTest, makePlaywrightResult({
        status: 'passed',
        duration: 100
      }))

      // Failed test
      const failedTest = makePlaywrightTestCase({
        id: 'test-2',
        title: 'failed test',
        outcome: 'unexpected'
      })
      reporter.onTestEnd(failedTest, makePlaywrightResult({
        status: 'failed',
        duration: 200
      }))

      // Flaky test (2 attempts)
      const flakyTest = makePlaywrightTestCase({
        id: 'test-3',
        title: 'flaky test',
        outcome: 'flaky'
      })
      reporter.onTestEnd(flakyTest, makePlaywrightResult({
        status: 'failed',
        retry: 0,
        duration: 150
      }))
      reporter.onTestEnd(flakyTest, makePlaywrightResult({
        status: 'passed',
        retry: 1,
        duration: 150
      }))

      // Skipped test
      const skippedTest = makePlaywrightTestCase({
        id: 'test-4',
        title: 'skipped test',
        outcome: 'skipped'
      })
      reporter.onTestEnd(skippedTest, makePlaywrightResult({
        status: 'skipped',
        duration: 0
      }))

      const results = (reporter as any).buildTestResults()

      expect(results).toHaveLength(4)

      const passed = results.find((r: any) => r.name.includes('passed test'))
      expect(passed).toMatchObject({
        status: 'passed',
        wasFlaky: false
      })

      const failed = results.find((r: any) => r.name.includes('failed test'))
      expect(failed).toMatchObject({
        status: 'failed',
        wasFlaky: false
      })

      const flaky = results.find((r: any) => r.name.includes('flaky test'))
      expect(flaky).toMatchObject({
        status: 'passed',
        wasFlaky: true,
        retries: 1,
        durationMs: 150 // Last attempt duration only
      })

      const skipped = results.find((r: any) => r.name.includes('skipped test'))
      expect(skipped).toMatchObject({
        status: 'skipped',
        wasFlaky: false
      })
    })
  })

  describe('single result per test', () => {
    it('emits exactly one TestResult per logical test regardless of retry count', () => {
      const reporter = new TestEyesReporter()
      reporter.onBegin(mockConfig, mockSuite)

      // Test with 3 retries (4 total attempts)
      const test = makePlaywrightTestCase({
        title: 'retried test',
        outcome: 'expected'
      })

      reporter.onTestEnd(test, makePlaywrightResult({ retry: 0 }))
      reporter.onTestEnd(test, makePlaywrightResult({ retry: 1 }))
      reporter.onTestEnd(test, makePlaywrightResult({ retry: 2 }))
      reporter.onTestEnd(test, makePlaywrightResult({ retry: 3 }))

      const results = (reporter as any).buildTestResults()

      // Should be exactly 1 result, not 4
      expect(results).toHaveLength(1)
      expect(results[0].retries).toBe(3)
    })
  })

  describe('aggregation across runs', () => {
    it('when multiple runs are aggregated, flakyCount accumulates across runs', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-eyes-'))

      try {
        // Import actual functions (not mocked)
        const { aggregate, saveTestData, ensureDir } = await vi.importActual<typeof import('test-processing')>('test-processing')

        await ensureDir(tempDir)

        // Create 4 runs where profile test is flaky in 2 of them
        const runs: RunData[] = [
          {
            runId: 'run-1',
            prNumber: 1,
            commitSha: 'abc1111',
            createdAt: '2024-01-01T10:00:00Z',
            tests: [{ name: 'profile test', durationMs: 200, status: 'passed', wasFlaky: true }]
          },
          {
            runId: 'run-2',
            prNumber: 1,
            commitSha: 'abc2222',
            createdAt: '2024-01-01T11:00:00Z',
            tests: [{ name: 'profile test', durationMs: 180, status: 'passed', wasFlaky: false }]
          },
          {
            runId: 'run-3',
            prNumber: 1,
            commitSha: 'abc3333',
            createdAt: '2024-01-01T12:00:00Z',
            tests: [{ name: 'profile test', durationMs: 210, status: 'passed', wasFlaky: true }]
          },
          {
            runId: 'run-4',
            prNumber: 1,
            commitSha: 'abc4444',
            createdAt: '2024-01-01T13:00:00Z',
            tests: [{ name: 'profile test', durationMs: 195, status: 'passed', wasFlaky: false }]
          }
        ]

        // Save all runs
        for (let i = 0; i < runs.length; i++) {
          await saveTestData(tempDir, `run-${i + 1}.json`, runs[i])
        }

        // Run aggregation
        const result = await aggregate(tempDir)

        // Read the aggregated data
        const aggregatedPath = path.join(tempDir, 'main-test-data.json')
        const aggregatedContent = await fs.readFile(aggregatedPath, 'utf-8')
        const aggregatedData = JSON.parse(aggregatedContent)

        // Assert: totalRuns: 4, flakyCount: 2, passCount: 4
        expect(aggregatedData.meta.totalRuns).toBe(4)
        expect(aggregatedData.tests['profile test'].totalRuns).toBe(4)
        expect(aggregatedData.tests['profile test'].flakyCount).toBe(2)
        expect(aggregatedData.tests['profile test'].passCount).toBe(4)
      } finally {
        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true })
      }
    })
  })
})
