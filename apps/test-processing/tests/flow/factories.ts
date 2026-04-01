/**
 * Data factories for flow tests.
 *
 * Principle: Only show fields that appear in assertions.
 * Uses production types from test-processing.
 */

import type { RunData, TestResult, RecentExecution } from '../../src/types.js'
import type { TestCase, TestResult as PlaywrightResult } from '@playwright/test/reporter'

// =============================================================================
// Run File Factory
// =============================================================================

/**
 * Factory for run files — uses production RunData type.
 * Only specify what you assert on - factory fills defaults.
 */
export function makeRunFile(overrides: { tests: Partial<TestResult>[] }): RunData {
  return {
    runId: `run-${Date.now()}`,
    prNumber: 0,
    commitSha: 'abc1234',
    createdAt: new Date().toISOString(),
    tests: overrides.tests.map(t => ({
      name: t.name ?? 'Default > test',
      durationMs: t.durationMs ?? 100,
      status: t.status ?? 'passed',
      wasFlaky: t.wasFlaky ?? false,
      ...t
    }))
  }
}

// =============================================================================
// History Entry Factory
// =============================================================================

/**
 * Factory for history entries — uses production RecentExecution type.
 * Only specify what you assert on - factory fills defaults.
 */
export function makeHistoryEntry(overrides: Partial<RecentExecution> = {}): RecentExecution {
  return {
    runId: 'run-1',
    status: 'passed',
    durationMs: 100,
    timestamp: '2026-03-27T10:00:00Z',
    wasFlaky: false,
    ...overrides
  }
}

// =============================================================================
// Playwright Test Factories (for collection flow tests)
// =============================================================================

export function makeTestCase(overrides: Partial<{
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

export function makePlaywrightResult(overrides: Partial<{
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

// =============================================================================
// Playwright Config/Suite/Result Factories
// =============================================================================

import type { FullConfig, Suite, FullResult } from '@playwright/test/reporter'

export function makeFullConfig(): FullConfig {
  return {
    forbidOnly: false,
    fullyParallel: false,
    globalSetup: null,
    globalTeardown: null,
    globalTimeout: 0,
    grep: /.*/,
    grepInvert: null,
    maxFailures: 0,
    metadata: {},
    preserveOutput: 'always',
    projects: [],
    reporter: [],
    reportSlowTests: null,
    rootDir: '/tmp',
    quiet: false,
    shard: null,
    updateSnapshots: 'missing',
    version: '1.0.0',
    workers: 1,
    webServer: null,
    configFile: ''
  } as FullConfig
}

export function makeSuite(): Suite {
  return {
    title: '',
    suites: [],
    tests: [],
    location: undefined,
    parent: undefined,
    allTests: () => [],
    titlePath: () => [],
    entries: () => [],
    project: () => undefined,
    type: 'root'
  } as unknown as Suite
}

export function makeFullResult(status: 'passed' | 'failed' | 'timedout' | 'interrupted' = 'passed'): FullResult {
  return {
    status,
    startTime: new Date(),
    duration: 0
  } as FullResult
}
