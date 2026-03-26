/**
 * Flow tests for the Playwright Reporter.
 *
 * Strategy: Enter through reporter (onEnd) → Assert on pushToGitHub.
 * Principle: Arrange shows only fields that appear in Assert.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TestEyesReporter } from '../../collectors/playwright-reporter/src/reporter.js'
import { makeTest, makeResult, endRun, makeHistory, resetTestIdCounter, testName } from './factories.js'
import type { FullConfig, Suite } from '@playwright/test/reporter'
import * as gitOps from '../../apps/test-processing/src/git-operations.js'

// Git operations mock is in setup.ts (loaded via vitest setupFiles)

const mockConfig = {} as FullConfig
const mockSuite = {} as Suite

describe('Reporter Flow Tests', () => {
  beforeEach(() => {
    resetTestIdCounter()
    vi.stubEnv('CI', 'true')
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    vi.stubEnv('GITHUB_SHA', 'abc1234567890')
    vi.clearAllMocks()
    vi.mocked(gitOps.fetchAggregatedData).mockResolvedValue({
      schemaVersion: '1.0.0',
      meta: { totalRuns: 0, lastAggregatedAt: null, processedFiles: [] },
      tests: {}
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('Flaky detection', () => {
    it('When test fails twice then passes, then it is marked as flaky', async () => {
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const titlePath = ['E2E', 'checkout flow']
      const test = makeTest(titlePath, 'flaky')

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(test, makeResult('failed', 1200, 0))
      reporter.onTestEnd(test, makeResult('failed', 1150, 1))
      reporter.onTestEnd(test, makeResult('passed', 1100, 2))
      await reporter.onEnd(endRun())

      expect(gitOps.pushToGitHub).toHaveBeenCalledWith(
        expect.objectContaining({
          runData: expect.objectContaining({
            tests: [expect.objectContaining({
              name: testName(titlePath),
              wasFlaky: true,
              status: 'passed',
              durationMs: 1100
            })]
          }),
          aggregatedData: expect.objectContaining({
            tests: {
              [testName(titlePath)]: expect.objectContaining({
                flakyCount: 1,
                passCount: 1,
                failCount: 0
              })
            }
          })
        })
      )
    })
  })

  describe('Duration tracking', () => {
    it('When test completes, then duration is recorded in stats', async () => {
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const titlePath = ['API', 'database query']
      const test = makeTest(titlePath)

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(test, makeResult('passed', 1550))
      await reporter.onEnd(endRun())

      expect(gitOps.pushToGitHub).toHaveBeenCalledWith(
        expect.objectContaining({
          runData: expect.objectContaining({
            tests: [expect.objectContaining({ name: testName(titlePath), durationMs: 1550 })]
          }),
          aggregatedData: expect.objectContaining({
            tests: {
              [testName(titlePath)]: expect.objectContaining({
                avgDurationMs: 1550,
                p95DurationMs: 1550
              })
            }
          })
        })
      )
    })
  })

  describe('Mixed statuses', () => {
    it('When tests have mixed results, then counts are tracked correctly', async () => {
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const passedPath = ['Auth', 'login']
      const failedPath = ['Checkout', 'payment']
      const flakyPath = ['User', 'profile']
      const passed = makeTest(passedPath)
      const failed = makeTest(failedPath, 'unexpected')
      const flaky = makeTest(flakyPath, 'flaky')

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(passed, makeResult('passed', 200))
      reporter.onTestEnd(failed, makeResult('failed', 500))
      reporter.onTestEnd(flaky, makeResult('failed', 300, 0))
      reporter.onTestEnd(flaky, makeResult('passed', 280, 1))
      await reporter.onEnd(endRun('failed'))

      expect(gitOps.pushToGitHub).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregatedData: expect.objectContaining({
            tests: {
              [testName(passedPath)]: expect.objectContaining({ passCount: 1, failCount: 0 }),
              [testName(failedPath)]: expect.objectContaining({ passCount: 0, failCount: 1 }),
              [testName(flakyPath)]: expect.objectContaining({ passCount: 1, flakyCount: 1 })
            }
          })
        })
      )
    })
  })

  describe('History merge', () => {
    it('When history exists, then new results accumulate', async () => {
      const titlePath = ['Auth', 'login']
      vi.mocked(gitOps.fetchAggregatedData).mockResolvedValueOnce(
        makeHistory({ [testName(titlePath)]: { totalRuns: 5, passCount: 5 } })
      )
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const test = makeTest(titlePath, 'unexpected')

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(test, makeResult('failed', 250))
      await reporter.onEnd(endRun('failed'))

      expect(gitOps.pushToGitHub).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregatedData: expect.objectContaining({
            meta: expect.objectContaining({ totalRuns: 6 }),
            tests: {
              [testName(titlePath)]: expect.objectContaining({
                totalRuns: 6,
                passCount: 5,
                failCount: 1
              })
            }
          })
        })
      )
    })

    it('When history has no tests, then new test is added', async () => {
      vi.mocked(gitOps.fetchAggregatedData).mockResolvedValueOnce(makeHistory({}, 3))
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const titlePath = ['Feature', 'new feature']
      const test = makeTest(titlePath)

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(test, makeResult('passed', 100))
      await reporter.onEnd(endRun())

      expect(gitOps.pushToGitHub).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregatedData: expect.objectContaining({
            meta: expect.objectContaining({ totalRuns: 4 }),
            tests: {
              [testName(titlePath)]: expect.objectContaining({ passCount: 1 })
            }
          })
        })
      )
    })
  })

  describe('Flaky tracking across runs', () => {
    it('When first run is flaky, then wasFlaky is true', async () => {
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const test = makeTest(['User', 'profile'], 'flaky')

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(test, makeResult('failed', 200, 0))
      reporter.onTestEnd(test, makeResult('passed', 180, 1))
      await reporter.onEnd(endRun())

      expect(gitOps.pushToGitHub).toHaveBeenCalledWith(
        expect.objectContaining({
          runData: expect.objectContaining({
            tests: [expect.objectContaining({ wasFlaky: true })]
          })
        })
      )
    })

    it('When run passes cleanly, then wasFlaky is false', async () => {
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const test = makeTest(['User', 'profile'])

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(test, makeResult('passed', 190))
      await reporter.onEnd(endRun())

      expect(gitOps.pushToGitHub).toHaveBeenCalledWith(
        expect.objectContaining({
          runData: expect.objectContaining({
            tests: [expect.objectContaining({ wasFlaky: false })]
          })
        })
      )
    })

    it('When run is flaky again, then wasFlaky is true', async () => {
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const test = makeTest(['User', 'profile'], 'flaky')

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(test, makeResult('failed', 210, 0))
      reporter.onTestEnd(test, makeResult('passed', 195, 1))
      await reporter.onEnd(endRun())

      expect(gitOps.pushToGitHub).toHaveBeenCalledWith(
        expect.objectContaining({
          runData: expect.objectContaining({
            tests: [expect.objectContaining({ wasFlaky: true })]
          })
        })
      )
    })
  })
})
