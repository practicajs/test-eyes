#!/usr/bin/env node
import { parseArgs } from 'util'
import { deployDashboard, aggregateAndSummarize } from '../src/index.js'
import { saveAggregatedData, saveTestHistory } from '../src/file-operations.js'

// ============================================================================
// CLI Commands
// ============================================================================

async function runDeploy(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      'dist-dir': { type: 'string', short: 'd' },
      'data-dir': { type: 'string', default: 'data' },
      'commit-sha': { type: 'string', short: 'c' },
      'target-branch': { type: 'string', short: 't', default: 'gh-pages' }
    },
    allowPositionals: true
  })

  const distDir = values['dist-dir']
  if (!distDir) {
    console.error('Error: --dist-dir is required')
    process.exit(1)
  }

  const commitSha = values['commit-sha'] || process.env.GITHUB_SHA || 'local'

  const result = await deployDashboard({
    distDir,
    dataDir: values['data-dir']!,
    commitSha,
    targetBranch: values['target-branch']
  })

  if (result.success) {
    console.log(`✓ ${result.message}`)
    if (result.url) {
      console.log(`  URL: ${result.url}`)
    }
  } else {
    console.error(`✗ ${result.message}`)
    process.exit(1)
  }
}

async function runAggregate(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      'data-branch': { type: 'string', short: 'b', default: 'gh-data' }
    },
    allowPositionals: true
  })

  const dataDir = args[0] || 'data'
  const dataBranch = values['data-branch']!
  const historyFile = `${dataDir}/test-history.json`
  const summaryFile = `${dataDir}/test-summary.json`

  console.log(`Aggregating data from: ${dataDir}/runs`)
  console.log(`Data branch: ${dataBranch}`)

  const { history, summary } = await aggregateAndSummarize(dataDir, dataBranch)

  // Save both files to disk
  await saveTestHistory(historyFile, history)
  await saveAggregatedData(summaryFile, summary)

  const totalTests = Object.keys(summary.tests).length
  console.log(`✓ Aggregated ${totalTests} tests`)
  console.log(`  History: ${historyFile}`)
  console.log(`  Summary: ${summaryFile}`)
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)

  switch (command) {
    case 'deploy':
      await runDeploy(args)
      break

    case 'aggregate':
      await runAggregate(args)
      break

    case 'help':
    case '--help':
    case '-h':
      printHelp()
      break

    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

function printHelp(): void {
  console.log(`
test-processing CLI

Commands:
  deploy      Deploy dashboard to GitHub Pages
  aggregate   Aggregate test data from run files

Note: For collecting test data, use:
  - @practica/test-eyes (Playwright reporter)
  - @practica/test-eyes-junit (JUnit XML collector)

Examples:
  tsx cli.ts deploy --dist-dir ./dist --data-dir ./data
  tsx cli.ts aggregate ./data --data-branch gh-data

Options:
  deploy:
    --dist-dir, -d      Frontend dist directory (required)
    --data-dir          Data directory (default: data)
    --commit-sha, -c    Commit SHA (default: GITHUB_SHA env)
    --target-branch, -t Target branch (default: gh-pages)

  aggregate:
    --data-branch, -b   Data branch to fetch history from (default: gh-data)
`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
