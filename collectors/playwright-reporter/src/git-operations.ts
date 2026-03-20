import { exec } from 'child_process'
import { promisify } from 'util'
import type { GitConfig } from './types.js'

const execAsync = promisify(exec)
const MAX_BUFFER = 50 * 1024 * 1024 // 50MB

async function run(command: string): Promise<string> {
  const { stdout } = await execAsync(command, { maxBuffer: MAX_BUFFER })
  return stdout.trim()
}

export function getDefaultGitConfig(): GitConfig {
  return {
    userName: 'github-actions[bot]',
    userEmail: 'github-actions[bot]@users.noreply.github.com'
  }
}

export async function configureGit(config: GitConfig): Promise<void> {
  await run(`git config user.name "${config.userName}"`)
  await run(`git config user.email "${config.userEmail}"`)
}

export async function getCurrentSha(): Promise<string> {
  return run('git rev-parse HEAD')
}

export async function getCurrentBranch(): Promise<string> {
  return run('git rev-parse --abbrev-ref HEAD')
}

export async function fetchBranch(branch: string): Promise<boolean> {
  try {
    await run(`git fetch origin ${branch}:${branch}`)
    return true
  } catch {
    return false
  }
}

export async function branchExists(branch: string): Promise<boolean> {
  try {
    await run(`git rev-parse --verify ${branch}`)
    return true
  } catch {
    return false
  }
}

export async function checkoutBranch(branch: string): Promise<void> {
  await run(`git checkout ${branch}`)
}

export async function createOrphanBranch(branch: string): Promise<void> {
  await run(`git checkout --orphan ${branch}`)
  await run('git rm -rf . || true')
}

export async function stageFiles(patterns: string[]): Promise<void> {
  for (const pattern of patterns) {
    await run(`git add ${pattern}`)
  }
}

export async function hasChanges(): Promise<boolean> {
  try {
    const result = await run('git status --porcelain')
    return result.length > 0
  } catch {
    return false
  }
}

export async function commit(message: string): Promise<string | null> {
  try {
    await run(`git commit --no-verify -m "${message}"`)
    return await getCurrentSha()
  } catch {
    return null
  }
}

export async function push(branch: string): Promise<boolean> {
  try {
    await run(`git push origin ${branch} --force`)
    return true
  } catch {
    return false
  }
}
