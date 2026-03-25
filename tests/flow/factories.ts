/**
 * Data factories for flow tests.
 * Produce valid Playwright TestCase/TestResult objects with sensible defaults.
 * Each test overrides only the fields relevant to its scenario.
 */

import type { TestCase, TestResult as PlaywrightTestResult, FullResult } from '@playwright/test/reporter'

interface TestCaseOptions {
  id?: string
  title?: string
  titlePath?: string[]
  outcome?: 'expected' | 'unexpected' | 'flaky' | 'skipped'
}

interface TestResultOptions {
  status?: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'
  duration?: number
  retry?: number
}

let testIdCounter = 0

export function resetTestIdCounter(): void {
  testIdCounter = 0
}

/**
 * Create a Playwright TestCase with sensible defaults.
 * Override only what matters for your test scenario.
 */
export function makePlaywrightTestCase(options: TestCaseOptions = {}): TestCase {
  const id = options.id ?? `test-${++testIdCounter}`
  const title = options.title ?? 'Test'
  const titlePath = options.titlePath ?? [title]
  const outcome = options.outcome ?? 'expected'

  return {
    id,
    title,
    titlePath: () => titlePath,
    outcome: () => outcome,
    ok: () => outcome === 'expected' || outcome === 'flaky',
    annotations: [],
    expectedStatus: 'passed',
    location: { file: 'test.spec.ts', line: 1, column: 1 },
    parent: null as unknown as TestCase['parent'],
    repeatEachIndex: 0,
    results: [],
    retries: 0,
    tags: [],
    timeout: 30000,
    type: 'test'
  } as TestCase
}

/**
 * Create a Playwright TestResult with sensible defaults.
 * Override only what matters for your test scenario.
 */
export function makePlaywrightResult(options: TestResultOptions = {}): PlaywrightTestResult {
  return {
    status: options.status ?? 'passed',
    duration: options.duration ?? 100,
    retry: options.retry ?? 0,
    attachments: [],
    errors: [],
    startTime: new Date(),
    stderr: [],
    stdout: [],
    steps: [],
    parallelIndex: 0,
    workerIndex: 0,
    annotations: []
  } as PlaywrightTestResult
}

interface FullResultOptions {
  status?: 'passed' | 'failed' | 'timedout' | 'interrupted'
}

/**
 * Create a Playwright FullResult with sensible defaults.
 * Use in Act phase: reporter.onEnd(buildFullResult({ status: 'passed' }))
 */
export function buildFullResult(options: FullResultOptions = {}): FullResult {
  return {
    status: options.status ?? 'passed'
  } as FullResult
}
