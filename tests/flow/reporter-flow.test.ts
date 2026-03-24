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
import { makePlaywrightTestCase, makePlaywrightResult, resetTestIdCounter } from './factories.js'
import type { FullConfig, FullResult, Suite } from '@playwright/test/reporter'
import fs from 'fs/promises'

// Import the mocked module to access mock functions
import * as gitOps from '../../apps/test-processing/src/git-operations.js'

// Stub only git operations - the external boundary
vi.mock('../../apps/test-processing/src/git-operations.js', () => ({
  configureGit: vi.fn().mockResolvedValue(undefined),
  getDefaultGitConfig: vi.fn().mockReturnValue({ userName: 'test', userEmail: 'test@test.com' }),
  fetchBranches: vi.fn().mockResolvedValue(undefined),
  checkoutOrCreateBranch: vi.fn().mockResolvedValue(false),
  getCurrentBranch: vi.fn().mockResolvedValue('main'),
  pushToGitHub: vi.fn().mockResolvedValue('abc1234'),
  stageFiles: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue({ success: true, commitSha: 'abc1234' }),
  push: vi.fn().mockResolvedValue({ success: true }),
  hasChanges: vi.fn().mockResolvedValue(true)
}))

// Helpers
const mockConfig = {} as FullConfig
const mockSuite = {} as Suite
const mockFullResult = { status: 'passed' } as FullResult

async function cleanupDataDir() {
  try {
    await fs.rm('data', { recursive: true, force: true })
  } catch {
    // Ignore if doesn't exist
  }
}

async function readAggregatedData() {
  const content = await fs.readFile('data/main-test-data.json', 'utf-8')
  return JSON.parse(content)
}

describe('Reporter Flow Tests', () => {
  beforeEach(async () => {
    resetTestIdCounter()
    vi.stubEnv('CI', 'true')
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    vi.stubEnv('GITHUB_SHA', 'abc1234567890')
    vi.clearAllMocks()
    await cleanupDataDir()
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await cleanupDataDir()
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
      await reporter.onEnd(mockFullResult)

      // Assert: pushToGitHub was called with correct branch
      expect(gitOps.pushToGitHub).toHaveBeenCalledTimes(1)
      expect(gitOps.pushToGitHub).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'gh-data',
          files: ['data/']
        })
      )

      // Assert: aggregated data contains flaky test with correct values
      const aggregated = await readAggregatedData()
      const testStats = aggregated.tests['E2E > checkout flow']

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
      await reporter.onEnd(mockFullResult)

      // Assert: pushToGitHub was called
      expect(gitOps.pushToGitHub).toHaveBeenCalledTimes(1)
      expect(gitOps.pushToGitHub).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'gh-data' })
      )

      // Assert: aggregated data has correct duration
      const aggregated = await readAggregatedData()
      const testStats = aggregated.tests['API > database query']

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
      await reporter.onEnd(mockFullResult)

      // Assert: pushToGitHub was called
      expect(gitOps.pushToGitHub).toHaveBeenCalledTimes(1)

      // Assert: aggregated data has correct counts per test
      const aggregated = await readAggregatedData()

      expect(aggregated.tests['Auth > login'].passCount).toBe(1)
      expect(aggregated.tests['Auth > login'].failCount).toBe(0)

      expect(aggregated.tests['Checkout > payment'].passCount).toBe(0)
      expect(aggregated.tests['Checkout > payment'].failCount).toBe(1)

      expect(aggregated.tests['User > profile'].passCount).toBe(1)
      expect(aggregated.tests['User > profile'].flakyCount).toBe(1)
    })
  })

  describe('Test 4: Multiple runs accumulate flaky count', () => {
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
      await reporter1.onEnd(mockFullResult)

      // Arrange: Run 2 - profile passes cleanly
      const reporter2 = new TestEyesReporter({ dataBranch: 'gh-data' })
      const profileTest2 = makePlaywrightTestCase({
        id: 'profile', title: 'profile', titlePath: ['User', 'profile'], outcome: 'expected'
      })

      reporter2.onBegin(mockConfig, mockSuite)
      reporter2.onTestEnd(profileTest2, makePlaywrightResult({ status: 'passed', duration: 190, retry: 0 }))

      // Act: Run 2
      vi.stubEnv('GITHUB_SHA', 'run2sha456')
      await reporter2.onEnd(mockFullResult)

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
      await reporter3.onEnd(mockFullResult)

      // Assert: pushToGitHub was called 3 times
      expect(gitOps.pushToGitHub).toHaveBeenCalledTimes(3)

      // Assert: aggregated data shows accumulated counts
      const aggregated = await readAggregatedData()
      const profileStats = aggregated.tests['User > profile']

      expect(aggregated.meta.totalRuns).toBe(3)
      expect(profileStats.totalRuns).toBe(3)
      expect(profileStats.flakyCount).toBe(2) // Flaky in run 1 and 3
      expect(profileStats.passCount).toBe(3)  // All passed (flaky still counts as passed)
    })
  })
})
