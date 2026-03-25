/**
 * Flow tests for the Playwright Reporter.
 *
 * Strategy: Enter the system through the reporter (onEnd), then assert on the
 * final effect - the interaction with GitHub via pushToGitHub.
 *
 * Key question: "If this test passes, do I know for sure that GitHub was triggered correctly?"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TestEyesReporter } from '../../collectors/playwright-reporter/src/reporter.js'
import { makePlaywrightTestCase, makePlaywrightResult, buildFullResult, resetTestIdCounter } from './factories.js'
import type { FullConfig, Suite } from '@playwright/test/reporter'
import type { PushTestDataOptions } from '../../apps/test-processing/src/git-operations.js'

// Import the mocked module to access mock functions
import * as gitOps from '../../apps/test-processing/src/git-operations.js'

// Default empty history - tests can override with mockResolvedValueOnce
const emptyAggregatedData = () => ({
  schemaVersion: '1.0.0',
  meta: { totalRuns: 0, lastAggregatedAt: null, processedFiles: [] },
  tests: {}
})

// Stub only git operations - the external boundary
vi.mock('../../apps/test-processing/src/git-operations.js', () => ({
  configureGit: vi.fn().mockResolvedValue(undefined),
  getDefaultGitConfig: vi.fn().mockReturnValue({ userName: 'test', userEmail: 'test@test.com' }),
  fetchBranches: vi.fn().mockResolvedValue(undefined),
  checkoutOrCreateBranch: vi.fn().mockResolvedValue(false),
  getCurrentBranch: vi.fn().mockReturnValue('main'),
  fetchAggregatedData: vi.fn().mockImplementation(() => Promise.resolve(emptyAggregatedData())),
  pushToGitHub: vi.fn().mockResolvedValue('abc1234'),
  stageFiles: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue({ success: true, commitSha: 'abc1234' }),
  push: vi.fn().mockResolvedValue({ success: true }),
  hasChanges: vi.fn().mockResolvedValue(true)
}))

// Helpers
const mockConfig = {} as FullConfig
const mockSuite = {} as Suite

function getPushToGitHubCall(index = 0): PushTestDataOptions {
  const calls = vi.mocked(gitOps.pushToGitHub).mock.calls
  return calls[index][0]
}

describe('Reporter Flow Tests', () => {
  beforeEach(() => {
    resetTestIdCounter()
    vi.stubEnv('CI', 'true')
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    vi.stubEnv('GITHUB_SHA', 'abc1234567890')
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('Test 1: Flaky detection with retries', () => {
    it('when 2 of 3 test attempts fail then pass, pushToGitHub is called with flaky test data', async () => {
      // Arrange
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const flakyTest = makePlaywrightTestCase({
        id: 'flaky-1',
        title: 'checkout flow',
        titlePath: ['E2E', 'checkout flow'],
        outcome: 'flaky'
      })

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(flakyTest, makePlaywrightResult({ status: 'failed', duration: 1200, retry: 0 }))
      reporter.onTestEnd(flakyTest, makePlaywrightResult({ status: 'failed', duration: 1150, retry: 1 }))
      reporter.onTestEnd(flakyTest, makePlaywrightResult({ status: 'passed', duration: 1100, retry: 2 }))

      // Act
      await reporter.onEnd(buildFullResult({ status: 'passed' }))

      // Assert: pushToGitHub was called with correct data
      expect(gitOps.pushToGitHub).toHaveBeenCalledTimes(1)

      const pushCall = getPushToGitHubCall()
      expect(pushCall.branch).toBe('gh-data')
      expect(pushCall.runDataFilename).toMatch(/\.json$/)

      // Assert: runData contains flaky test
      const flakyTestData = pushCall.runData.tests.find(t => t.name === 'E2E > checkout flow')
      expect(flakyTestData).toBeDefined()
      expect(flakyTestData!.wasFlaky).toBe(true)
      expect(flakyTestData!.status).toBe('passed')
      expect(flakyTestData!.durationMs).toBe(1100)

      // Assert: aggregatedData contains correct stats
      const testStats = pushCall.aggregatedData.tests['E2E > checkout flow']
      expect(testStats).toBeDefined()
      expect(testStats.flakyCount).toBe(1)
      expect(testStats.passCount).toBe(1)
      expect(testStats.failCount).toBe(0)
    })
  })

  describe('Test 2: Slow test tracking', () => {
    it('when a slow test completes, pushToGitHub is called with correct duration data', async () => {
      // Arrange
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const slowTest = makePlaywrightTestCase({
        id: 'slow-1',
        title: 'database query',
        titlePath: ['API', 'database query'],
        outcome: 'expected'
      })

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(slowTest, makePlaywrightResult({ status: 'passed', duration: 1550, retry: 0 }))

      // Act
      await reporter.onEnd(buildFullResult({ status: 'passed' }))

      // Assert: pushToGitHub was called with correct data
      expect(gitOps.pushToGitHub).toHaveBeenCalledTimes(1)

      const pushCall = getPushToGitHubCall()
      expect(pushCall.branch).toBe('gh-data')

      // Assert: runData has correct duration
      const testData = pushCall.runData.tests.find(t => t.name === 'API > database query')
      expect(testData!.durationMs).toBe(1550)

      // Assert: aggregatedData has correct duration stats
      const testStats = pushCall.aggregatedData.tests['API > database query']
      expect(testStats.avgDurationMs).toBe(1550)
      expect(testStats.p95DurationMs).toBe(1550)
    })
  })

  describe('Test 3: Mixed test statuses', () => {
    it('when mixing passed, failed, and flaky tests, pushToGitHub is called with correct counts', async () => {
      // Arrange
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })

      const loginTest = makePlaywrightTestCase({
        id: 'login', title: 'login', titlePath: ['Auth', 'login'], outcome: 'expected'
      })
      const paymentTest = makePlaywrightTestCase({
        id: 'payment', title: 'payment', titlePath: ['Checkout', 'payment'], outcome: 'unexpected'
      })
      const profileTest = makePlaywrightTestCase({
        id: 'profile', title: 'profile', titlePath: ['User', 'profile'], outcome: 'flaky'
      })

      reporter.onBegin(mockConfig, mockSuite)

      // Login: passes first attempt
      reporter.onTestEnd(loginTest, makePlaywrightResult({ status: 'passed', duration: 200, retry: 0 }))

      // Payment: fails all attempts
      reporter.onTestEnd(paymentTest, makePlaywrightResult({ status: 'failed', duration: 500, retry: 0 }))
      reporter.onTestEnd(paymentTest, makePlaywrightResult({ status: 'failed', duration: 520, retry: 1 }))

      // Profile: flaky - fails then passes
      reporter.onTestEnd(profileTest, makePlaywrightResult({ status: 'failed', duration: 300, retry: 0 }))
      reporter.onTestEnd(profileTest, makePlaywrightResult({ status: 'passed', duration: 280, retry: 1 }))

      // Act
      await reporter.onEnd(buildFullResult({ status: 'passed' }))

      // Assert: pushToGitHub was called
      expect(gitOps.pushToGitHub).toHaveBeenCalledTimes(1)

      // Assert: aggregatedData has correct counts per test
      const { aggregatedData } = getPushToGitHubCall()

      expect(aggregatedData.tests['Auth > login'].passCount).toBe(1)
      expect(aggregatedData.tests['Auth > login'].failCount).toBe(0)

      expect(aggregatedData.tests['Checkout > payment'].passCount).toBe(0)
      expect(aggregatedData.tests['Checkout > payment'].failCount).toBe(1)

      expect(aggregatedData.tests['User > profile'].passCount).toBe(1)
      expect(aggregatedData.tests['User > profile'].flakyCount).toBe(1)
    })
  })

  describe('Test 4: New run merges with existing history', () => {
    it('when history already contains a test, running it again accumulates results', async () => {
      // Arrange: Stub existing history in gh-data
      vi.mocked(gitOps.fetchAggregatedData).mockResolvedValueOnce({
        schemaVersion: '1.0.0',
        meta: { totalRuns: 5, lastAggregatedAt: '2024-01-01', processedFiles: ['old1.json', 'old2.json'] },
        tests: {
          'Auth > login': { totalRuns: 5, passCount: 5, failCount: 0, flakyCount: 0, avgDurationMs: 200, p95DurationMs: 220 }
        }
      })

      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const loginTest = makePlaywrightTestCase({
        id: 'login', title: 'login', titlePath: ['Auth', 'login'], outcome: 'unexpected'
      })

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(loginTest, makePlaywrightResult({ status: 'failed', duration: 250, retry: 0 }))

      // Act
      await reporter.onEnd(buildFullResult({ status: 'failed' }))

      // Assert: pushToGitHub receives merged data (history + new run)
      expect(gitOps.pushToGitHub).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'gh-data',
          aggregatedData: expect.objectContaining({
            meta: expect.objectContaining({ totalRuns: 6 }),
            tests: expect.objectContaining({
              'Auth > login': expect.objectContaining({
                totalRuns: 6,
                passCount: 5,
                failCount: 1
              })
            })
          })
        })
      )
    })

    it('when history has no tests and new test is added, aggregated data contains new test', async () => {
      // Arrange: Stub empty history
      vi.mocked(gitOps.fetchAggregatedData).mockResolvedValueOnce({
        schemaVersion: '1.0.0',
        meta: { totalRuns: 3, lastAggregatedAt: '2024-01-01', processedFiles: ['old.json'] },
        tests: {} // No tests in history
      })

      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      const newTest = makePlaywrightTestCase({
        id: 'new-test', title: 'new feature', titlePath: ['Feature', 'new feature'], outcome: 'expected'
      })

      reporter.onBegin(mockConfig, mockSuite)
      reporter.onTestEnd(newTest, makePlaywrightResult({ status: 'passed', duration: 100, retry: 0 }))

      // Act
      await reporter.onEnd(buildFullResult({ status: 'passed' }))

      // Assert: pushToGitHub has both history meta + new test
      const { aggregatedData } = getPushToGitHubCall()
      expect(aggregatedData.meta.totalRuns).toBe(4) // 3 + 1
      expect(aggregatedData.tests['Feature > new feature']).toBeDefined()
      expect(aggregatedData.tests['Feature > new feature'].passCount).toBe(1)
    })
  })

  describe('Test 5: Multiple runs accumulate flaky count', () => {
    it('when same test is flaky across multiple runs, pushToGitHub accumulates flakyCount', async () => {
      // Arrange: Run 1 - profile is flaky
      const reporter1 = new TestEyesReporter({ dataBranch: 'gh-data' })
      const profileTest1 = makePlaywrightTestCase({
        id: 'profile', title: 'profile', titlePath: ['User', 'profile'], outcome: 'flaky'
      })

      reporter1.onBegin(mockConfig, mockSuite)
      reporter1.onTestEnd(profileTest1, makePlaywrightResult({ status: 'failed', duration: 200, retry: 0 }))
      reporter1.onTestEnd(profileTest1, makePlaywrightResult({ status: 'passed', duration: 180, retry: 1 }))

      // Act: Run 1
      vi.stubEnv('GITHUB_SHA', 'run1sha123')
      await reporter1.onEnd(buildFullResult({ status: 'passed' }))

      // Assert: Run 1 - first run has flakyCount = 1
      const run1Call = getPushToGitHubCall(0)
      expect(run1Call.aggregatedData.meta.totalRuns).toBe(1)
      expect(run1Call.aggregatedData.tests['User > profile'].flakyCount).toBe(1)

      // Arrange: Run 2 - profile passes cleanly
      const reporter2 = new TestEyesReporter({ dataBranch: 'gh-data' })
      const profileTest2 = makePlaywrightTestCase({
        id: 'profile', title: 'profile', titlePath: ['User', 'profile'], outcome: 'expected'
      })

      reporter2.onBegin(mockConfig, mockSuite)
      reporter2.onTestEnd(profileTest2, makePlaywrightResult({ status: 'passed', duration: 190, retry: 0 }))

      // Act: Run 2
      vi.stubEnv('GITHUB_SHA', 'run2sha456')
      await reporter2.onEnd(buildFullResult({ status: 'passed' }))

      // Arrange: Run 3 - profile is flaky again
      const reporter3 = new TestEyesReporter({ dataBranch: 'gh-data' })
      const profileTest3 = makePlaywrightTestCase({
        id: 'profile', title: 'profile', titlePath: ['User', 'profile'], outcome: 'flaky'
      })

      reporter3.onBegin(mockConfig, mockSuite)
      reporter3.onTestEnd(profileTest3, makePlaywrightResult({ status: 'failed', duration: 210, retry: 0 }))
      reporter3.onTestEnd(profileTest3, makePlaywrightResult({ status: 'passed', duration: 195, retry: 1 }))

      // Act: Run 3
      vi.stubEnv('GITHUB_SHA', 'run3sha789')
      await reporter3.onEnd(buildFullResult({ status: 'passed' }))

      // Assert: pushToGitHub was called 3 times
      expect(gitOps.pushToGitHub).toHaveBeenCalledTimes(3)

      // Assert: Each call has correct runData
      expect(getPushToGitHubCall(0).runData.tests[0].wasFlaky).toBe(true)
      expect(getPushToGitHubCall(1).runData.tests[0].wasFlaky).toBeFalsy()
      expect(getPushToGitHubCall(2).runData.tests[0].wasFlaky).toBe(true)
    })
  })
})
