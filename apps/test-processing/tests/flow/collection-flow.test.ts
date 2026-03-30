/**
 * Collection Flow Tests
 *
 * Entry point: Playwright reporter events (onBegin, onTestEnd, onEnd)
 * Stub boundary: collectFromRunData (captures the RunData that would be pushed)
 * Assert on: RunData content (tests, statuses, durations, flaky flags)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TestEyesReporter } from '../../../../collectors/playwright-reporter/src/reporter.js'
import * as testProcessing from '../../src/index.js'
import type { TestCase, TestResult as PlaywrightResult, FullConfig, Suite, FullResult } from '@playwright/test/reporter'
import type { RunData } from '../../src/types.js'

// ============================================================================
// Test Factories
// ============================================================================

function makeTestCase(overrides: Partial<{
  id: string
  title: string[]
  outcome: 'expected' | 'unexpected' | 'flaky' | 'skipped'
}>): TestCase {
  const { id = 'test-1', title = ['Suite', 'test name'], outcome = 'expected' } = overrides
  return {
    id,
    titlePath: () => title,
    outcome: () => outcome
  } as unknown as TestCase
}

function makePlaywrightResult(overrides: Partial<{
  duration: number
  status: 'passed' | 'failed' | 'timedOut' | 'skipped'
}>): PlaywrightResult {
  return {
    duration: overrides.duration ?? 100,
    status: overrides.status ?? 'passed',
    attachments: [],
    errors: [],
    steps: [],
    retry: 0,
    startTime: new Date()
  } as PlaywrightResult
}

// ============================================================================
// Stub Setup
// ============================================================================

let capturedRunData: RunData | null = null

vi.mock('../../src/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof testProcessing>()
  return {
    ...actual,
    collectFromRunData: vi.fn(async (opts: { runData: RunData }) => {
      capturedRunData = opts.runData
      return { success: true, message: 'Mocked push', runData: opts.runData }
    })
  }
})

// ============================================================================
// Tests
// ============================================================================

describe('Collection Flow', () => {
  let reporter: TestEyesReporter
  const originalCI = process.env.CI
  const originalSHA = process.env.GITHUB_SHA
  const originalGITHUB_ACTIONS = process.env.GITHUB_ACTIONS

  beforeEach(() => {
    capturedRunData = null
    process.env.CI = 'true'
    process.env.GITHUB_SHA = 'abc1234567890'
    reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env.CI = originalCI
    process.env.GITHUB_SHA = originalSHA
    process.env.GITHUB_ACTIONS = originalGITHUB_ACTIONS
  })

  it('10.1 Passed tests are recorded', async () => {
    // WHEN two tests pass with durations 1550ms and 800ms
    reporter.onBegin({} as FullConfig, {} as Suite)

    const test1 = makeTestCase({ id: '1', title: ['Auth', 'login'], outcome: 'expected' })
    const test2 = makeTestCase({ id: '2', title: ['Auth', 'logout'], outcome: 'expected' })

    reporter.onTestEnd(test1, makePlaywrightResult({ duration: 1550 }))
    reporter.onTestEnd(test2, makePlaywrightResult({ duration: 800 }))

    await reporter.onEnd({ status: 'passed' } as FullResult)

    // THEN RunData has 2 tests with status: 'passed' and correct durations
    expect(capturedRunData).not.toBeNull()
    expect(capturedRunData!.tests).toHaveLength(2)
    expect(capturedRunData!.tests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Auth > login', status: 'passed', durationMs: 1550 }),
        expect.objectContaining({ name: 'Auth > logout', status: 'passed', durationMs: 800 })
      ])
    )
  })

  it('10.2 Failed test is recorded', async () => {
    // WHEN two tests fail
    reporter.onBegin({} as FullConfig, {} as Suite)

    const test1 = makeTestCase({ id: '1', title: ['Checkout', 'pay'], outcome: 'unexpected' })
    const test2 = makeTestCase({ id: '2', title: ['Checkout', 'cart'], outcome: 'unexpected' })

    reporter.onTestEnd(test1, makePlaywrightResult({ duration: 200, status: 'failed' }))
    reporter.onTestEnd(test2, makePlaywrightResult({ duration: 150, status: 'failed' }))

    await reporter.onEnd({ status: 'failed' } as FullResult)

    // THEN RunData has 2 tests with status: 'failed'
    expect(capturedRunData).not.toBeNull()
    expect(capturedRunData!.tests).toHaveLength(2)
    expect(capturedRunData!.tests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Checkout > pay', status: 'failed' }),
        expect.objectContaining({ name: 'Checkout > cart', status: 'failed' })
      ])
    )
  })

  it('10.3 Flaky test detected', async () => {
    // WHEN test fails twice, then passes on retry
    reporter.onBegin({} as FullConfig, {} as Suite)

    const test = makeTestCase({ id: '1', title: ['Profile', 'avatar'], outcome: 'flaky' })

    // Simulate 3 attempts: fail, fail, pass
    reporter.onTestEnd(test, makePlaywrightResult({ duration: 100, status: 'failed' }))
    reporter.onTestEnd(test, makePlaywrightResult({ duration: 120, status: 'failed' }))
    reporter.onTestEnd(test, makePlaywrightResult({ duration: 150, status: 'passed' }))

    await reporter.onEnd({ status: 'passed' } as FullResult)

    // THEN RunData has 1 test with wasFlaky: true, status: 'passed', retries: 2
    expect(capturedRunData).not.toBeNull()
    expect(capturedRunData!.tests).toHaveLength(1)
    expect(capturedRunData!.tests[0]).toEqual(
      expect.objectContaining({
        name: 'Profile > avatar',
        status: 'passed',
        wasFlaky: true,
        retries: 2
      })
    )
  })

  it('10.4 Multiple tests with mixed results', async () => {
    // WHEN 3 tests run: one passes, one fails, one flaky
    reporter.onBegin({} as FullConfig, {} as Suite)

    const passTest = makeTestCase({ id: '1', title: ['Auth', 'login'], outcome: 'expected' })
    const failTest = makeTestCase({ id: '2', title: ['Payment', 'charge'], outcome: 'unexpected' })
    const flakyTest = makeTestCase({ id: '3', title: ['Profile', 'update'], outcome: 'flaky' })

    reporter.onTestEnd(passTest, makePlaywrightResult({ duration: 100 }))
    reporter.onTestEnd(failTest, makePlaywrightResult({ duration: 200, status: 'failed' }))
    reporter.onTestEnd(flakyTest, makePlaywrightResult({ duration: 300, status: 'failed' }))
    reporter.onTestEnd(flakyTest, makePlaywrightResult({ duration: 350, status: 'passed' }))

    await reporter.onEnd({ status: 'passed' } as FullResult)

    // THEN RunData has 3 tests, each with correct status
    expect(capturedRunData).not.toBeNull()
    expect(capturedRunData!.tests).toHaveLength(3)
    expect(capturedRunData!.tests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Auth > login', status: 'passed', wasFlaky: false }),
        expect.objectContaining({ name: 'Payment > charge', status: 'failed', wasFlaky: false }),
        expect.objectContaining({ name: 'Profile > update', status: 'passed', wasFlaky: true })
      ])
    )
  })

  it('10.5 Skipped test recorded', async () => {
    // WHEN one test is skipped
    reporter.onBegin({} as FullConfig, {} as Suite)

    const test = makeTestCase({ id: '1', title: ['Admin', 'disabled'], outcome: 'skipped' })
    reporter.onTestEnd(test, makePlaywrightResult({ duration: 0, status: 'skipped' }))

    await reporter.onEnd({ status: 'passed' } as FullResult)

    // THEN RunData has 1 test with status: 'skipped'
    expect(capturedRunData).not.toBeNull()
    expect(capturedRunData!.tests).toHaveLength(1)
    expect(capturedRunData!.tests[0]).toEqual(
      expect.objectContaining({ name: 'Admin > disabled', status: 'skipped' })
    )
  })

  it('10.6 Not in CI — nothing pushed', async () => {
    // WHEN CI environment variable is not set
    delete process.env.CI
    delete process.env.GITHUB_ACTIONS

    reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
    reporter.onBegin({} as FullConfig, {} as Suite)

    const test = makeTestCase({ id: '1', title: ['Test', 'one'], outcome: 'expected' })
    reporter.onTestEnd(test, makePlaywrightResult({ duration: 100 }))

    await reporter.onEnd({ status: 'passed' } as FullResult)

    // THEN push function is NOT called
    expect(testProcessing.collectFromRunData).not.toHaveBeenCalled()
    expect(capturedRunData).toBeNull()
  })

  it('10.7 Retry uses last attempt duration', async () => {
    // WHEN test fails at 300ms (retry 0), passes at 180ms (retry 1)
    reporter.onBegin({} as FullConfig, {} as Suite)

    const test = makeTestCase({ id: '1', title: ['Search', 'query'], outcome: 'flaky' })

    reporter.onTestEnd(test, makePlaywrightResult({ duration: 300, status: 'failed' }))
    reporter.onTestEnd(test, makePlaywrightResult({ duration: 180, status: 'passed' }))

    await reporter.onEnd({ status: 'passed' } as FullResult)

    // THEN RunData has durationMs: 180 (last attempt), retries: 1
    expect(capturedRunData).not.toBeNull()
    expect(capturedRunData!.tests).toHaveLength(1)
    expect(capturedRunData!.tests[0]).toEqual(
      expect.objectContaining({
        name: 'Search > query',
        durationMs: 180,
        retries: 1
      })
    )
  })
})
