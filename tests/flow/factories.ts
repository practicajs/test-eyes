/**
 * Data factories for flow tests.
 *
 * Principle: Only show fields that appear in assertions.
 * Uses production types from Playwright and test-processing.
 */

import type { TestCase, TestResult as PlaywrightTestResult, FullResult } from '@playwright/test/reporter'
import type { AggregatedData, TestStats } from '../../apps/test-processing/src/types.js'

// =============================================================================
// Playwright Factories (using production types)
// =============================================================================

let testIdCounter = 0

export function resetTestIdCounter(): void {
  testIdCounter = 0
}

/**
 * Build expected test name from titlePath.
 * Keeps assertions in sync with test data.
 */
export function testName(titlePath: string[]): string {
  return titlePath.join(' > ')
}

/**
 * Create a Playwright TestCase.
 * Uses real Playwright types - only override what matters for your test.
 */
export function makeTest(
  titlePath: string[],
  outcome: 'expected' | 'flaky' | 'unexpected' = 'expected'
): TestCase {
  const title = titlePath[titlePath.length - 1]

  // Build a minimal TestCase that satisfies Playwright's interface
  return {
    id: `test-${++testIdCounter}`,
    title,
    titlePath: () => titlePath,
    outcome: () => outcome,
    ok: () => outcome !== 'unexpected',
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
 * Create a Playwright TestResult.
 * Uses real Playwright types.
 */
export function makeResult(
  status: PlaywrightTestResult['status'],
  duration: number,
  retry = 0
): PlaywrightTestResult {
  return {
    status,
    duration,
    retry,
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

/**
 * Create a Playwright FullResult for onEnd.
 * Uses real Playwright types.
 */
export function endRun(status: FullResult['status'] = 'passed'): FullResult {
  return { status } as FullResult
}

// =============================================================================
// History Factories (using production types from test-processing)
// =============================================================================

/**
 * Create history with specific test stats.
 * Uses real AggregatedData and TestStats types.
 * Only specify what you assert on - factory fills defaults.
 */
export function makeHistory(
  tests: Record<string, Partial<TestStats>>,
  totalRuns?: number
): AggregatedData {
  const calculatedRuns = totalRuns ?? Object.values(tests)[0]?.totalRuns ?? 1

  const fullTests: Record<string, TestStats> = {}
  for (const [name, partial] of Object.entries(tests)) {
    fullTests[name] = {
      totalRuns: partial.totalRuns ?? calculatedRuns,
      passCount: partial.passCount ?? 0,
      failCount: partial.failCount ?? 0,
      flakyCount: partial.flakyCount ?? 0,
      avgDurationMs: partial.avgDurationMs ?? 100,
      p95DurationMs: partial.p95DurationMs ?? 100
    }
  }

  return {
    schemaVersion: '1.0.0',
    meta: {
      totalRuns: calculatedRuns,
      lastAggregatedAt: '2024-01-01',
      processedFiles: []
    },
    tests: fullTests
  }
}

/**
 * Empty history (no previous runs).
 * Returns valid AggregatedData structure.
 */
export function emptyHistory(): AggregatedData {
  return {
    schemaVersion: '1.0.0',
    meta: { totalRuns: 0, lastAggregatedAt: null, processedFiles: [] },
    tests: {}
  }
}
