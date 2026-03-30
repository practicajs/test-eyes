#!/usr/bin/env node
import { collectFromJUnit } from './collect.js'

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: test-eyes-junit <junit-path> [options]

Options:
  --data-branch <branch>   Branch to store test data (default: gh-data)
  --commit-sha <sha>       Git commit SHA (default: GITHUB_SHA or git rev-parse)
  --pr-number <number>     PR number (default: GITHUB_PR_NUMBER or 0)
  --help, -h               Show this help message

Examples:
  test-eyes-junit ./test-results.xml
  test-eyes-junit ./results.xml --data-branch test-data
`)
    process.exit(0)
  }

  const junitPath = args[0]
  const dataBranch = getArg(args, '--data-branch') ?? 'gh-data'
  const commitSha = getArg(args, '--commit-sha') ?? process.env.GITHUB_SHA
  const prNumber = parseInt(getArg(args, '--pr-number') ?? process.env.GITHUB_PR_NUMBER ?? '0', 10)

  try {
    const result = await collectFromJUnit({
      junitPath,
      dataBranch,
      commitSha,
      prNumber
    })

    if (result.success) {
      console.log(`[test-eyes] ${result.message}`)
      if (result.runData) {
        console.log(`[test-eyes] Tests collected: ${result.runData.tests.length}`)
      }
    } else {
      console.error(`[test-eyes] Error: ${result.message}`)
      process.exit(1)
    }
  } catch (error) {
    console.error(`[test-eyes] Fatal error: ${(error as Error).message}`)
    process.exit(1)
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index !== -1 ? args[index + 1] : undefined
}

main()
