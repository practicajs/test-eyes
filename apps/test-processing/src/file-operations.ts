import { readFile, writeFile, readdir, mkdir, cp, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import type { RunData, AggregatedData } from './types.js'

// ============================================================================
// Directory Operations
// ============================================================================

export async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true })
  }
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest)
  await cp(src, dest, { recursive: true })
}

export async function copyFile(src: string, dest: string): Promise<void> {
  const destDir = path.dirname(dest)
  await ensureDir(destDir)
  await cp(src, dest)
}

export async function removeDir(dirPath: string): Promise<void> {
  if (existsSync(dirPath)) {
    await rm(dirPath, { recursive: true, force: true })
  }
}

// ============================================================================
// Test Data Files
// ============================================================================

export function generateTestDataFilename(commitSha: string): string {
  const date = new Date().toISOString().split('T')[0]
  const shortSha = commitSha.slice(0, 7)
  const timestamp = Date.now()
  return `${date}_${shortSha}_${timestamp}.json`
}

export async function saveTestData(dataDir: string, filename: string, data: RunData): Promise<string> {
  await ensureDir(dataDir)
  const filepath = path.join(dataDir, filename)
  await writeFile(filepath, JSON.stringify(data, null, 2))
  return filepath
}

export async function loadTestData(filepath: string): Promise<RunData | null> {
  try {
    const content = await readFile(filepath, 'utf-8')
    return JSON.parse(content) as RunData
  } catch {
    return null
  }
}

// ============================================================================
// Aggregated Data Files
// ============================================================================

export async function loadAggregatedData(filepath: string): Promise<AggregatedData> {
  if (!existsSync(filepath)) {
    return {
      schemaVersion: '1.0.0',
      meta: {
        totalRuns: 0,
        lastAggregatedAt: null,
        processedFiles: []
      },
      tests: {}
    }
  }

  const content = await readFile(filepath, 'utf-8')
  return JSON.parse(content) as AggregatedData
}

export async function saveAggregatedData(filepath: string, data: AggregatedData): Promise<void> {
  const dir = path.dirname(filepath)
  await ensureDir(dir)
  await writeFile(filepath, JSON.stringify(data, null, 2))
}

// ============================================================================
// Data Directory Scanning
// ============================================================================

export async function findJsonFiles(dataDir: string, exclude: string[] = []): Promise<string[]> {
  if (!existsSync(dataDir)) {
    return []
  }

  const files = await readdir(dataDir)
  const excludeSet = new Set(exclude)

  return files.filter(
    (f: string) => f.endsWith('.json') && !excludeSet.has(f)
  )
}

export async function findUnprocessedFiles(
  dataDir: string,
  processedFiles: Set<string>
): Promise<string[]> {
  const allFiles = await findJsonFiles(dataDir, ['main-test-data.json', 'index.json'])
  return allFiles.filter((f: string) => !processedFiles.has(f))
}

// ============================================================================
// Temp Directory
// ============================================================================

export async function copyToTemp(src: string, name: string): Promise<string> {
  const tempPath = path.join('/tmp', name)
  await copyDir(src, tempPath)
  return tempPath
}

// ============================================================================
// Deploy Files
// ============================================================================

export async function prepareSiteDir(siteDir: string): Promise<void> {
  await removeDir(siteDir)
  await ensureDir(siteDir)
}

export async function createNoJekyllFile(dir: string): Promise<void> {
  await writeFile(path.join(dir, '.nojekyll'), '')
}
