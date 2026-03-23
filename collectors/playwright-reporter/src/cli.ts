#!/usr/bin/env node
import { parseArgs } from 'util'
import { parseJUnitFile } from './junit-parser.js'
import { generateRunId, generateFilename, saveRunData, ensureDir } from './file-operations.js'
import {
  configureGit,
  getDefaultGitConfig,
  getCurrentSha,
  getCurrentBranch,
  fetchBranch,
  branchExists,
  checkoutBranch,
  createOrphanBranch,
  stageFiles,
  hasChanges,
  commit,
  push
} from './git-operations.js'
import { aggregate } from './aggregate.js'
import { deployDashboard } from './deploy.js'
import type { RunData } from './types.js'

function printHelp() {
  console.log(`
test-eyes CLI - Test analytics collector and dashboard

Commands:
  collect    Collect test results from JUnit XML
  deploy     Deploy the dashboard to GitHub Pages

Usage:
  test-eyes collect --junit-path <path> [options]
  test-eyes deploy [options]

Collect Options:
  --junit-path <path>   Path to JUnit XML file (required)
  --data-branch <name>  Git branch for data storage (default: gh-data)
  --commit-sha <sha>    Commit SHA (default: current HEAD)
  --pr-number <num>     PR number (default: 0)
  --deploy              Also deploy dashboard after collecting

Deploy Options:
  --data-branch <name>    Source branch for data (default: gh-data)
  --deploy-branch <name>  Target branch for deployment (default: gh-pages)

General:
  -h, --help            Show this help
`)
}

async function collectCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      'junit-path': { type: 'string' },
      'data-branch': { type: 'string', default: 'gh-data' },
      'commit-sha': { type: 'string' },
      'pr-number': { type: 'string', default: '0' },
      deploy: { type: 'boolean', default: false }
    }
  })

  const junitPath = values['junit-path']
  if (!junitPath) {
    console.error('Error: --junit-path is required')
    process.exit(1)
  }

  const dataBranch = values['data-branch'] || 'gh-data'
  const prNumber = parseInt(values['pr-number'] || '0', 10)

  console.log('[test-eyes] Parsing JUnit XML...')
  const tests = await parseJUnitFile(junitPath)
  console.log(`[test-eyes] Found ${tests.length} tests`)

  // Configure git
  await configureGit(getDefaultGitConfig())

  // Get commit SHA
  const commitSha = values['commit-sha'] || process.env.GITHUB_SHA || await getCurrentSha()
  const originalBranch = await getCurrentBranch()

  // Build run data
  const runData: RunData = {
    runId: generateRunId(commitSha),
    prNumber,
    commitSha,
    createdAt: new Date().toISOString(),
    tests
  }

  // Switch to data branch
  const branchExisted = await fetchBranch(dataBranch)
  if (branchExisted || await branchExists(dataBranch)) {
    await checkoutBranch(dataBranch)
  } else {
    console.log(`[test-eyes] Creating new branch: ${dataBranch}`)
    await createOrphanBranch(dataBranch)
  }

  // Save data
  const dataDir = 'data'
  await ensureDir(dataDir)
  const filename = generateFilename(commitSha)
  await saveRunData(dataDir, filename, runData)
  console.log(`[test-eyes] Saved: ${dataDir}/${filename}`)

  // Aggregate
  await aggregate(dataDir)
  console.log('[test-eyes] Aggregation complete')

  // Commit and push
  await stageFiles(['data/'])
  if (await hasChanges()) {
    const sha = await commit(`Add test data: ${runData.runId}`)
    if (sha) {
      console.log(`[test-eyes] Committed: ${sha.slice(0, 7)}`)
    }
    const pushed = await push(dataBranch)
    if (pushed) {
      console.log(`[test-eyes] Pushed to ${dataBranch}`)
    }
  }

  // Return to original branch
  if (originalBranch && originalBranch !== dataBranch) {
    await checkoutBranch(originalBranch)
  }

  // Deploy if requested
  if (values.deploy) {
    await deployDashboard({ dataBranch })
  }

  console.log('[test-eyes] Done!')
}

async function deployCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      'data-branch': { type: 'string', default: 'gh-data' },
      'deploy-branch': { type: 'string', default: 'gh-pages' }
    }
  })

  await deployDashboard({
    dataBranch: values['data-branch'],
    deployBranch: values['deploy-branch']
  })
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === '-h' || command === '--help') {
    printHelp()
    process.exit(0)
  }

  const commandArgs = args.slice(1)

  switch (command) {
    case 'collect':
      await collectCommand(commandArgs)
      break
    case 'deploy':
      await deployCommand(commandArgs)
      break
    default:
      // Backwards compatibility: if first arg looks like an option, assume collect
      if (command.startsWith('--')) {
        await collectCommand(args)
      } else {
        console.error(`Unknown command: ${command}`)
        printHelp()
        process.exit(1)
      }
  }
}

main().catch(error => {
  console.error('[test-eyes] Error:', error.message)
  process.exit(1)
})
