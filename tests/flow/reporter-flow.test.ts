/**
 * Flow tests for the Playwright Reporter.
 *
 * Strategy: All our code runs for real. Only the external boundary (git operations)
 * is stubbed. We verify the data that would be pushed to GitHub.
 *
 * Flow: Reporter → collectFromRunData → aggregate → pushToGitHub (stubbed)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TestEyesReporter } from '../../collectors/playwright-reporter/src/reporter.js'
import { makePlaywrightTestCase, makePlaywrightResult, resetTestIdCounter } from './factories.js'
import { aggregate, saveTestData, ensureDir } from '../../apps/test-processing/src/index.js'
import type { FullConfig, Suite } from '@playwright/test/reporter'
import type { RunData, AggregatedData } from '../../apps/test-processing/src/types.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// Stub only git operations - the external boundary
// All our code (reporter, aggregation, file ops) runs for real
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

const mockConfig = {} as FullConfig
const mockSuite = {} as Suite

describe('Reporter Flow Tests', () => {
  let tempDir: string

  beforeEach(async () => {
    resetTestIdCounter()
    vi.stubEnv('CI', 'true')
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    vi.stubEnv('GITHUB_SHA', 'abc1234567890')
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-eyes-flow-'))
    vi.clearAllMocks()
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('Test 1: Flaky detection with retries', () => {
    it('when 2 of 4 test attempts fail then pass, the test is marked as flaky with correct retry count', () => {
      // Arrange: Create reporter and simulate Playwright calling onTestEnd for each attempt
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      reporter.onBegin(mockConfig, mockSuite)

      const flakyTest = makePlaywrightTestCase({
        id: 'flaky-test-1',
        title: 'checkout flow',
        titlePath: ['E2E', 'checkout flow'],
        outcome: 'flaky'
      })

      // Act: Simulate 3 attempts (fail, fail, pass) - retries: 2
      reporter.onTestEnd(flakyTest, makePlaywrightResult({ status: 'failed', duration: 1200, retry: 0 }))
      reporter.onTestEnd(flakyTest, makePlaywrightResult({ status: 'failed', duration: 1150, retry: 1 }))
      reporter.onTestEnd(flakyTest, makePlaywrightResult({ status: 'passed', duration: 1100, retry: 2 }))

      // Assert: Verify RunData that would be sent to collectFromRunData
      const results = (reporter as any).buildTestResults()

      expect(results).toHaveLength(1) // ONE result per logical test, not 3
      expect(results[0]).toMatchObject({
        name: 'E2E > checkout flow',
        status: 'passed',
        wasFlaky: true,
        retries: 2,
        durationMs: 1100
      })
    })
  })

  describe('Test 2: Slow test aggregation', () => {
    it('when a test is consistently slow, aggregated stats reflect high duration', async () => {
      // Arrange: Create 3 runs with durations 1500ms, 1600ms, 1550ms
      await ensureDir(tempDir)

      const runs: RunData[] = [
        { runId: 'run-1', prNumber: 0, commitSha: 'aaa1111', createdAt: '2024-01-01T10:00:00Z',
          tests: [{ name: 'database query test', durationMs: 1500, status: 'passed' }] },
        { runId: 'run-2', prNumber: 0, commitSha: 'bbb2222', createdAt: '2024-01-01T11:00:00Z',
          tests: [{ name: 'database query test', durationMs: 1600, status: 'passed' }] },
        { runId: 'run-3', prNumber: 0, commitSha: 'ccc3333', createdAt: '2024-01-01T12:00:00Z',
          tests: [{ name: 'database query test', durationMs: 1550, status: 'passed' }] }
      ]

      // Act: Save runs and aggregate (file ops + aggregation run for real)
      for (let i = 0; i < runs.length; i++) {
        await saveTestData(tempDir, `run-${i + 1}.json`, runs[i])
      }
      await aggregate(tempDir)

      // Assert: Verify aggregated statistics
      const aggregatedPath = path.join(tempDir, 'main-test-data.json')
      const aggregatedData: AggregatedData = JSON.parse(await fs.readFile(aggregatedPath, 'utf-8'))
      const testStats = aggregatedData.tests['database query test']

      expect(testStats.totalRuns).toBe(3)
      expect(testStats.avgDurationMs).toBeCloseTo(1550, -1) // ~1550ms
      expect(testStats.p95DurationMs).toBe(1600) // Highest value with 3 samples
    })
  })

  describe('Test 3: Mixed test statuses in one run', () => {
    it('when mixing passed, failed, and flaky tests in one run, each gets the correct status and counts', async () => {
      // Arrange: Create reporter with 3 tests
      const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
      reporter.onBegin(mockConfig, mockSuite)

      // Login test: passes first attempt (200ms)
      const loginTest = makePlaywrightTestCase({
        id: 'login', title: 'login', titlePath: ['Auth', 'login'], outcome: 'expected'
      })
      reporter.onTestEnd(loginTest, makePlaywrightResult({ status: 'passed', duration: 200, retry: 0 }))

      // Payment test: fails all retries (500ms)
      const paymentTest = makePlaywrightTestCase({
        id: 'payment', title: 'process payment', titlePath: ['Checkout', 'process payment'], outcome: 'unexpected'
      })
      reporter.onTestEnd(paymentTest, makePlaywrightResult({ status: 'failed', duration: 500, retry: 0 }))
      reporter.onTestEnd(paymentTest, makePlaywrightResult({ status: 'failed', duration: 520, retry: 1 }))

      // Profile test: flaky - fails then passes
      const profileTest = makePlaywrightTestCase({
        id: 'profile', title: 'update profile', titlePath: ['User', 'update profile'], outcome: 'flaky'
      })
      reporter.onTestEnd(profileTest, makePlaywrightResult({ status: 'failed', duration: 300, retry: 0 }))
      reporter.onTestEnd(profileTest, makePlaywrightResult({ status: 'passed', duration: 280, retry: 1 }))

      // Act: Build test results and aggregate
      const results = (reporter as any).buildTestResults()

      // Assert: Verify RunData structure
      expect(results).toHaveLength(3)

      const login = results.find((r: any) => r.name.includes('login'))
      const payment = results.find((r: any) => r.name.includes('payment'))
      const profile = results.find((r: any) => r.name.includes('profile'))

      expect(login).toMatchObject({ status: 'passed', wasFlaky: false, durationMs: 200 })
      expect(payment).toMatchObject({ status: 'failed', wasFlaky: false, retries: 1 })
      expect(profile).toMatchObject({ status: 'passed', wasFlaky: true, retries: 1 })

      // Verify aggregation counts
      await ensureDir(tempDir)
      const runData: RunData = {
        runId: 'mixed-run', prNumber: 0, commitSha: 'mixed123',
        createdAt: new Date().toISOString(), tests: results
      }
      await saveTestData(tempDir, 'mixed-run.json', runData)
      await aggregate(tempDir)

      const aggregatedData: AggregatedData = JSON.parse(
        await fs.readFile(path.join(tempDir, 'main-test-data.json'), 'utf-8')
      )

      // Sum counts across all tests
      const totals = Object.values(aggregatedData.tests).reduce(
        (acc, stats) => ({
          pass: acc.pass + stats.passCount,
          fail: acc.fail + stats.failCount,
          flaky: acc.flaky + stats.flakyCount
        }),
        { pass: 0, fail: 0, flaky: 0 }
      )

      expect(totals.pass).toBe(2)  // login + profile
      expect(totals.fail).toBe(1)  // payment
      expect(totals.flaky).toBe(1) // profile
    })
  })

  describe('Test 4: Multi-run flaky accumulation', () => {
    it('when multiple runs are aggregated, flakyCount accumulates across runs', async () => {
      // Arrange: 4 runs where profile test is flaky in 2, passes cleanly in 2
      await ensureDir(tempDir)

      const runs: RunData[] = [
        { runId: 'run-1', prNumber: 1, commitSha: 'aaa1111', createdAt: '2024-01-01T10:00:00Z',
          tests: [{ name: 'profile test', durationMs: 200, status: 'passed', wasFlaky: true }] },
        { runId: 'run-2', prNumber: 1, commitSha: 'bbb2222', createdAt: '2024-01-01T11:00:00Z',
          tests: [{ name: 'profile test', durationMs: 180, status: 'passed', wasFlaky: false }] },
        { runId: 'run-3', prNumber: 1, commitSha: 'ccc3333', createdAt: '2024-01-01T12:00:00Z',
          tests: [{ name: 'profile test', durationMs: 210, status: 'passed', wasFlaky: true }] },
        { runId: 'run-4', prNumber: 1, commitSha: 'ddd4444', createdAt: '2024-01-01T13:00:00Z',
          tests: [{ name: 'profile test', durationMs: 195, status: 'passed', wasFlaky: false }] }
      ]

      // Act: Save all runs and aggregate
      for (let i = 0; i < runs.length; i++) {
        await saveTestData(tempDir, `run-${i + 1}.json`, runs[i])
      }
      await aggregate(tempDir)

      // Assert: Verify accumulated flaky count
      const aggregatedData: AggregatedData = JSON.parse(
        await fs.readFile(path.join(tempDir, 'main-test-data.json'), 'utf-8')
      )

      expect(aggregatedData.meta.totalRuns).toBe(4)

      const profileStats = aggregatedData.tests['profile test']
      expect(profileStats.totalRuns).toBe(4)
      expect(profileStats.flakyCount).toBe(2)  // Flaky in runs 1 and 3
      expect(profileStats.passCount).toBe(4)   // All passed (flaky still counts as passed)
      expect(profileStats.failCount).toBe(0)
    })
  })
})
