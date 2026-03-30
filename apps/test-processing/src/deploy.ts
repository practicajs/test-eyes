import path from 'path'
import type { DeployConfig, DeployResult } from './types.js'
import {
  prepareSiteDir,
  copyDir,
  copyFile,
  ensureDir,
  createNoJekyllFile
} from './file-operations.js'
import {
  configureGit,
  getDefaultGitConfig,
  checkoutOrCreateBranch,
  removeAllTracked,
  stageAll,
  commit,
  pushWithUpstream
} from './git-operations.js'

// ============================================================================
// Site Preparation
// ============================================================================

export async function prepareSite(
  distDir: string,
  dataFile: string,
  siteDir: string
): Promise<void> {
  await prepareSiteDir(siteDir)

  // Copy frontend dist
  await copyDir(distDir, siteDir)

  // Copy aggregated data
  const dataDestDir = path.join(siteDir, 'data')
  await ensureDir(dataDestDir)
  await copyFile(dataFile, path.join(dataDestDir, 'test-summary.json'))
}

// ============================================================================
// Git Deploy
// ============================================================================

export async function deployToGitHubPages(config: DeployConfig): Promise<DeployResult> {
  const { sourceDir, dataFile, targetBranch, commitSha } = config
  const siteDir = '_site'
  const deployBranch = `${targetBranch}-deploy`

  try {
    // Configure git
    await configureGit(getDefaultGitConfig())

    // Prepare site directory
    await prepareSite(sourceDir, dataFile, siteDir)

    // Create orphan branch for deployment
    await checkoutOrCreateBranch(deployBranch)

    // Remove all tracked files
    await removeAllTracked()

    // Copy site files to root
    await copyDir(siteDir, '.')

    // Create .nojekyll file
    await createNoJekyllFile('.')

    // Stage all files
    await stageAll()

    // Commit
    const shortSha = commitSha.slice(0, 7)
    const commitResult = await commit(`Deploy dashboard for ${shortSha}`)

    if (!commitResult.success) {
      return { success: false, message: commitResult.message }
    }

    // Push to target branch (force)
    const pushResult = await pushWithUpstream(deployBranch, targetBranch, true)

    if (!pushResult.success) {
      return { success: false, message: pushResult.message }
    }

    return {
      success: true,
      message: `Deployed to ${targetBranch}`,
      url: `https://github.com/${process.env.GITHUB_REPOSITORY}/pages`
    }
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message
    }
  }
}

// ============================================================================
// High-Level Deploy Function
// ============================================================================

export interface DeployDashboardOptions {
  distDir: string
  dataDir: string
  commitSha: string
  targetBranch?: string
}

export async function deployDashboard(options: DeployDashboardOptions): Promise<DeployResult> {
  const {
    distDir,
    dataDir,
    commitSha,
    targetBranch = 'gh-pages'
  } = options

  const dataFile = path.join(dataDir, 'test-summary.json')

  return deployToGitHubPages({
    sourceDir: distDir,
    dataFile,
    targetBranch,
    commitSha
  })
}
