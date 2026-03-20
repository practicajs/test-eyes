import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import {
  ensureDir,
  generateRunId,
  generateFilename,
  saveRunData,
  loadJson,
  fileExists
} from '../src/file-operations.js'

const TEST_DIR = '.test-files'

describe('file-operations', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('ensureDir', () => {
    it('should create directory if not exists', async () => {
      const newDir = path.join(TEST_DIR, 'new-dir')
      await ensureDir(newDir)

      const stats = await fs.stat(newDir)
      expect(stats.isDirectory()).toBe(true)
    })

    it('should not fail if directory exists', async () => {
      await ensureDir(TEST_DIR)
      // Should not throw
    })
  })

  describe('generateRunId', () => {
    it('should generate run id with date and short sha', () => {
      const runId = generateRunId('abc123456789')

      expect(runId).toMatch(/^\d{4}-\d{2}-\d{2}_abc1234$/)
    })
  })

  describe('generateFilename', () => {
    it('should generate filename with .json extension', () => {
      const filename = generateFilename('abc123456789')

      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}_abc1234\.json$/)
    })
  })

  describe('saveRunData', () => {
    it('should save run data as JSON', async () => {
      const runData = {
        runId: 'test-run',
        prNumber: 1,
        commitSha: 'abc123',
        createdAt: '2024-01-01T00:00:00Z',
        tests: []
      }

      await saveRunData(TEST_DIR, 'test.json', runData)

      const saved = JSON.parse(
        await fs.readFile(path.join(TEST_DIR, 'test.json'), 'utf-8')
      )
      expect(saved.runId).toBe('test-run')
    })
  })

  describe('loadJson', () => {
    it('should load JSON file', async () => {
      const data = { foo: 'bar' }
      await fs.writeFile(
        path.join(TEST_DIR, 'data.json'),
        JSON.stringify(data)
      )

      const loaded = await loadJson<{ foo: string }>(
        path.join(TEST_DIR, 'data.json')
      )

      expect(loaded?.foo).toBe('bar')
    })

    it('should return null for non-existent file', async () => {
      const loaded = await loadJson(path.join(TEST_DIR, 'missing.json'))
      expect(loaded).toBeNull()
    })
  })

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'exists.txt'), 'content')

      const exists = await fileExists(path.join(TEST_DIR, 'exists.txt'))
      expect(exists).toBe(true)
    })

    it('should return false for non-existent file', async () => {
      const exists = await fileExists(path.join(TEST_DIR, 'missing.txt'))
      expect(exists).toBe(false)
    })
  })
})
