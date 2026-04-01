/**
 * Collection Flow Tests
 *
 * Entry point: Playwright reporter events (onBegin, onTestEnd, onEnd)
 * Stub boundary: pushRunDataToGit (captures the actual RunData being pushed)
 * Assert on: RunData content (tests, statuses, durations, flaky flags)
 *
 * This tests the full flow: Reporter → collectFromRunData → pushRunDataToGit (mock)
 * The mock receives the actual DATA, not file paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TestEyesReporter } from '../../../../collectors/playwright-reporter/src/reporter.js'
import * as gitOps from '../../src/git-operations.js'
import { makeTestCase, makePlaywrightResult, makeFullConfig, makeSuite, makeFullResult } from './factories.js'
import type { RunData } from '../../src/types.js'

// ============================================================================
// Stub Setup - Mock pushRunDataToGit
// ============================================================================

vi.mock('../../src/git-operations.js', async (importOriginal) => {
  const actual = await importOriginal<typeof gitOps>()
  return {
    ...actual,
    getCurrentBranch: vi.fn(async () => 'main'),
    checkoutOrCreateBranch: vi.fn(async () => false),
    pushRunDataToGit: vi.fn(async () => ({ success: true, message: 'Mocked push' }))
  }
})

function getCapturedRunData(): RunData | null {
  const mock = vi.mocked(gitOps.pushRunDataToGit)
  if (mock.mock.calls.length === 0) return null
  return mock.mock.calls[0][0].runData
}

// ============================================================================
// Tests
// ============================================================================

describe('Collection Flow', () => {
  let reporter: TestEyesReporter

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CI', 'true')
    vi.stubEnv('GITHUB_SHA', 'abc1234567890')
    vi.stubEnv('GITHUB_ACTIONS', '')
    reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('When tests pass, then RunData contains tests with passed status', async () => {
    reporter.onBegin(makeFullConfig(), makeSuite())
    reporter.onTestEnd(
      makeTestCase({ id: '1', title: ['Auth', 'login'], outcome: 'expected' }),
      makePlaywrightResult({ duration: 1550 })
    )
    reporter.onTestEnd(
      makeTestCase({ id: '2', title: ['Auth', 'logout'], outcome: 'expected' }),
      makePlaywrightResult({ duration: 800 })
    )
    await reporter.onEnd(makeFullResult())

    const runData = getCapturedRunData()
    expect(runData?.tests).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Auth > login', status: 'passed', durationMs: 1550 }),
      expect.objectContaining({ name: 'Auth > logout', status: 'passed', durationMs: 800 })
    ]))
  })

  it('When tests fail, then RunData contains tests with failed status', async () => {
    reporter.onBegin(makeFullConfig(), makeSuite())
    reporter.onTestEnd(
      makeTestCase({ id: '1', title: ['Checkout', 'pay'], outcome: 'unexpected' }),
      makePlaywrightResult({ duration: 200, status: 'failed' })
    )
    reporter.onTestEnd(
      makeTestCase({ id: '2', title: ['Checkout', 'cart'], outcome: 'unexpected' }),
      makePlaywrightResult({ duration: 150, status: 'failed' })
    )
    await reporter.onEnd(makeFullResult('failed'))

    const runData = getCapturedRunData()
    expect(runData?.tests).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Checkout > pay', status: 'failed' }),
      expect.objectContaining({ name: 'Checkout > cart', status: 'failed' })
    ]))
  })

  it('When test fails then passes on retry, then RunData marks it as flaky', async () => {
    reporter.onBegin(makeFullConfig(), makeSuite())
    const test = makeTestCase({ id: '1', title: ['Profile', 'avatar'], outcome: 'flaky' })
    reporter.onTestEnd(test, makePlaywrightResult({ duration: 100, status: 'failed' }))
    reporter.onTestEnd(test, makePlaywrightResult({ duration: 120, status: 'failed' }))
    reporter.onTestEnd(test, makePlaywrightResult({ duration: 150, status: 'passed' }))
    await reporter.onEnd(makeFullResult())

    const runData = getCapturedRunData()
    expect(runData?.tests[0]).toEqual(expect.objectContaining({
      name: 'Profile > avatar',
      status: 'passed',
      wasFlaky: true,
      retries: 2
    }))
  })

  it('When tests have mixed results, then RunData contains correct status for each', async () => {
    reporter.onBegin(makeFullConfig(), makeSuite())
    const flakyTest = makeTestCase({ id: '3', title: ['Profile', 'update'], outcome: 'flaky' })
    reporter.onTestEnd(makeTestCase({ id: '1', title: ['Auth', 'login'], outcome: 'expected' }), makePlaywrightResult({ duration: 100 }))
    reporter.onTestEnd(makeTestCase({ id: '2', title: ['Payment', 'charge'], outcome: 'unexpected' }), makePlaywrightResult({ status: 'failed' }))
    reporter.onTestEnd(flakyTest, makePlaywrightResult({ status: 'failed' }))
    reporter.onTestEnd(flakyTest, makePlaywrightResult({ status: 'passed' }))
    await reporter.onEnd(makeFullResult())

    const runData = getCapturedRunData()
    expect(runData?.tests).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Auth > login', status: 'passed' }),
      expect.objectContaining({ name: 'Payment > charge', status: 'failed' }),
      expect.objectContaining({ name: 'Profile > update', wasFlaky: true })
    ]))
  })

  it('When test is skipped, then RunData contains test with skipped status', async () => {
    reporter.onBegin(makeFullConfig(), makeSuite())
    reporter.onTestEnd(
      makeTestCase({ id: '1', title: ['Admin', 'disabled'], outcome: 'skipped' }),
      makePlaywrightResult({ duration: 0, status: 'skipped' })
    )
    await reporter.onEnd(makeFullResult())

    const runData = getCapturedRunData()
    expect(runData?.tests[0]).toEqual(expect.objectContaining({ name: 'Admin > disabled', status: 'skipped' }))
  })

  it('When test retries, then RunData uses last attempt duration', async () => {
    reporter.onBegin(makeFullConfig(), makeSuite())
    const test = makeTestCase({ id: '1', title: ['Search', 'query'], outcome: 'flaky' })
    reporter.onTestEnd(test, makePlaywrightResult({ duration: 300, status: 'failed' }))
    reporter.onTestEnd(test, makePlaywrightResult({ duration: 180, status: 'passed' }))
    await reporter.onEnd(makeFullResult())

    const runData = getCapturedRunData()
    expect(runData?.tests[0]).toEqual(expect.objectContaining({ durationMs: 180, retries: 1 }))
  })
})

describe('Collection Flow (non-CI)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CI', '')
    vi.stubEnv('GITHUB_ACTIONS', '')
    vi.stubEnv('GITHUB_SHA', 'abc1234567890')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('When not in CI environment, then nothing is pushed', async () => {
    const reporter = new TestEyesReporter({ dataBranch: 'gh-data' })
    reporter.onBegin(makeFullConfig(), makeSuite())
    reporter.onTestEnd(makeTestCase({ id: '1', title: ['Test', 'one'], outcome: 'expected' }), makePlaywrightResult({}))
    await reporter.onEnd(makeFullResult())

    expect(gitOps.pushRunDataToGit).not.toHaveBeenCalled()
  })
})

describe('Reporter Validation', () => {
  it('When dataBranch is not a string, then throws error', () => {
    expect(() => new TestEyesReporter({ dataBranch: 123 as unknown as string }))
      .toThrow('dataBranch must be a string')
  })

  it('When dataBranch is empty string, then throws error', () => {
    expect(() => new TestEyesReporter({ dataBranch: '' }))
      .toThrow('dataBranch must not be empty')
  })

  it('When prNumber is not a number, then throws error', () => {
    expect(() => new TestEyesReporter({ prNumber: '123' as unknown as number }))
      .toThrow('prNumber must be a number')
  })
})
