import type { TestCase, TestResult as PlaywrightTestResult } from '@playwright/test/reporter'

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

export function makePlaywrightTestCase(options: TestCaseOptions = {}): TestCase {
  const id = options.id ?? `test-${++testIdCounter}`
  const title = options.title ?? 'Test'
  const titlePath = options.titlePath ?? ['Suite', title]
  const outcome = options.outcome ?? 'expected'

  return {
    id,
    title,
    titlePath: () => titlePath,
    outcome: () => outcome,
    // Minimal implementation of other required fields
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

export function makePlaywrightResult(options: TestResultOptions = {}): PlaywrightTestResult {
  return {
    status: options.status ?? 'passed',
    duration: options.duration ?? 100,
    retry: options.retry ?? 0,
    // Minimal implementation of other required fields
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

export function resetTestIdCounter(): void {
  testIdCounter = 0
}
