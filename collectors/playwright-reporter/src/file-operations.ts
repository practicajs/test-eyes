import fs from 'fs/promises'
import path from 'path'
import type { RunData } from './types.js'

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

export function generateRunId(commitSha: string): string {
  const now = new Date()
  const date = now.toISOString().split('T')[0]
  const time = now.toISOString().split('T')[1].slice(0, 8).replace(/:/g, '')
  const shortSha = commitSha.slice(0, 7)
  return `${date}_${time}_${shortSha}`
}

export function generateFilename(commitSha: string): string {
  return `${generateRunId(commitSha)}.json`
}

export async function saveRunData(
  dataDir: string,
  filename: string,
  data: RunData
): Promise<string> {
  await ensureDir(dataDir)
  const filepath = path.join(dataDir, filename)
  await fs.writeFile(filepath, JSON.stringify(data, null, 2))
  return filepath
}

export async function loadJson<T>(filepath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filepath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

export async function saveJson(filepath: string, data: unknown): Promise<void> {
  await fs.writeFile(filepath, JSON.stringify(data, null, 2))
}

export async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath)
    return true
  } catch {
    return false
  }
}

export async function listJsonFiles(dirPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dirPath)
    return files.filter((f: string) => f.endsWith('.json'))
  } catch {
    return []
  }
}
