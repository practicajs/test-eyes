import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { saveTestData, generateTestDataFilename } from '../../src/file-operations.js'
import type { RunData } from '../../src/types.js'

// Mock fs/promises to avoid real file system I/O
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  readFile: vi.fn(async () => '{}'),
  rm: vi.fn(async () => undefined),
  readdir: vi.fn(async () => [])
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true)
}))

const mockRunData: RunData = {
  runId: 'test-run',
  commitSha: 'abc1234',
  branch: 'main',
  timestamp: '2024-01-15T10:30:00.000Z',
  durationMs: 100,
  tests: []
}

describe('file-operations', () => {
  describe('saveTestData', () => {
    it.each([
      ['../evil.json', 'path traversal'],
      ['path/to/evil.json', 'forward slash'],
      ['path\\evil.json', 'backslash']
    ])('When filename has %s (%s), then throws error', async (filename, _description) => {
      await expect(saveTestData('/tmp/test', filename, mockRunData))
        .rejects.toThrow('Invalid filename')
    })
  })

  describe('generateTestDataFilename', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-03-15T10:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('When commitSha is valid, then returns filename with correct date and sha prefix', () => {
      const filename = generateTestDataFilename('abc1234567890')

      expect(filename).toMatch(/^2024-03-15_abc1234_[a-f0-9]{4}\.json$/)
    })

    it('When commitSha is short, then uses available characters', () => {
      const filename = generateTestDataFilename('abc')

      expect(filename).toMatch(/^2024-03-15_abc_[a-f0-9]{4}\.json$/)
    })
  })
})
