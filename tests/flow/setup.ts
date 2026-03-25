/**
 * Shared test setup for flow tests.
 * Runs before all imports via vitest setupFiles.
 * See: https://vitest.dev/config/#setupfiles
 */

import { vi } from 'vitest'

// =============================================================================
// Git Operations Mock - External Boundary
// =============================================================================

vi.mock('../../apps/test-processing/src/git-operations.js', () => ({
  configureGit: vi.fn().mockResolvedValue(undefined),
  getDefaultGitConfig: vi.fn().mockReturnValue({ userName: 'test', userEmail: 'test@test.com' }),
  fetchBranches: vi.fn().mockResolvedValue(undefined),
  checkoutOrCreateBranch: vi.fn().mockResolvedValue(false),
  getCurrentBranch: vi.fn().mockReturnValue('main'),
  fetchAggregatedData: vi.fn().mockResolvedValue({
    schemaVersion: '1.0.0',
    meta: { totalRuns: 0, lastAggregatedAt: null, processedFiles: [] },
    tests: {}
  }),
  pushToGitHub: vi.fn().mockResolvedValue('abc1234'),
  stageFiles: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue({ success: true, commitSha: 'abc1234' }),
  push: vi.fn().mockResolvedValue({ success: true }),
  hasChanges: vi.fn().mockResolvedValue(true)
}))
