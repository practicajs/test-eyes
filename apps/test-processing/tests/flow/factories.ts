/**
 * Data factories for flow tests.
 *
 * Principle: Only show fields that appear in assertions.
 * Uses production types from test-processing.
 */

import type { RunData, TestResult, RecentExecution } from '../../src/types.js'

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
