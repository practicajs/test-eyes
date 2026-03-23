import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import {
  configureGit,
  getDefaultGitConfig,
  fetchBranch,
  branchExists,
  checkoutBranch,
  createOrphanBranch,
  stageFiles,
  hasChanges,
  commit,
  push,
  getCurrentBranch
} from './git-operations.js'
import { ensureDir, fileExists } from './file-operations.js'

const execAsync = promisify(exec)

export interface DeployOptions {
  dataBranch?: string
  deployBranch?: string
  dashboardUrl?: string
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }
  const buffer = await response.arrayBuffer()
  await fs.writeFile(dest, Buffer.from(buffer))
}

async function copyDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest)
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

async function copyFile(src: string, dest: string): Promise<void> {
  await fs.copyFile(src, dest)
}

export async function deployDashboard(options: DeployOptions = {}): Promise<void> {
  const dataBranch = options.dataBranch ?? 'gh-data'
  const deployBranch = options.deployBranch ?? 'gh-pages'

  console.log('[test-eyes] Starting dashboard deployment...')

  await configureGit(getDefaultGitConfig())
  const originalBranch = await getCurrentBranch()

  // Step 1: Fetch aggregated data from data branch
  console.log(`[test-eyes] Fetching data from ${dataBranch}...`)
  await fetchBranch(dataBranch)
  await checkoutBranch(dataBranch)

  const dataFile = 'data/main-test-data.json'
  if (!await fileExists(dataFile)) {
    throw new Error(`No aggregated data found at ${dataFile}`)
  }

  // Copy data to temp location
  const tempDir = '.test-eyes-deploy'
  await ensureDir(tempDir)
  await copyFile(dataFile, path.join(tempDir, 'main-test-data.json'))

  // Step 2: Check if we have local frontend dist (in test-eyes repo)
  const localDist = 'apps/frontend/dist'
  let hasFrontend = false

  // Return to original branch to check for frontend
  await checkoutBranch(originalBranch)

  if (await fileExists(localDist)) {
    console.log('[test-eyes] Using local frontend dist...')
    await copyDir(localDist, path.join(tempDir, 'site'))
    hasFrontend = true
  } else {
    // Try to download from GitHub releases (future feature)
    console.log('[test-eyes] No local frontend found.')
    console.log('[test-eyes] For external repos, use the test-eyes GitHub Action for deployment.')
    await fs.rm(tempDir, { recursive: true, force: true })
    return
  }

  // Step 3: Copy data into site
  await ensureDir(path.join(tempDir, 'site', 'data'))
  await copyFile(
    path.join(tempDir, 'main-test-data.json'),
    path.join(tempDir, 'site', 'data', 'main-test-data.json')
  )

  // Step 4: Deploy to gh-pages
  console.log(`[test-eyes] Deploying to ${deployBranch}...`)

  const branchExisted = await fetchBranch(deployBranch)
  if (branchExisted || await branchExists(deployBranch)) {
    await checkoutBranch(deployBranch)
    // Clean existing files
    const files = await fs.readdir('.')
    for (const file of files) {
      if (file !== '.git' && file !== tempDir) {
        await fs.rm(file, { recursive: true, force: true })
      }
    }
  } else {
    await createOrphanBranch(deployBranch)
  }

  // Copy site files
  const siteDir = path.join(tempDir, 'site')
  const siteFiles = await fs.readdir(siteDir)
  for (const file of siteFiles) {
    const src = path.join(siteDir, file)
    const stats = await fs.stat(src)
    if (stats.isDirectory()) {
      await copyDir(src, file)
    } else {
      await copyFile(src, file)
    }
  }

  // Create .nojekyll
  await fs.writeFile('.nojekyll', '')

  // Commit and push
  await stageFiles(['.'])
  if (await hasChanges()) {
    const sha = await commit('Deploy dashboard')
    if (sha) {
      console.log(`[test-eyes] Committed: ${sha.slice(0, 7)}`)
    }
    const pushed = await push(deployBranch)
    if (pushed) {
      console.log(`[test-eyes] Pushed to ${deployBranch}`)
    }
  }

  // Cleanup
  await checkoutBranch(originalBranch)
  await fs.rm(tempDir, { recursive: true, force: true })

  console.log('[test-eyes] Dashboard deployed successfully!')
}
