import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult as PlaywrightTestResult
} from '@playwright/test/reporter'
import type { TestEyesReporterOptions, TestResult, RunData } from './types.js'
import {
  generateRunId,
  generateFilename,
  saveRunData,
  ensureDir
} from './file-operations.js'
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

export class TestEyesReporter implements Reporter {
  private options: Required<TestEyesReporterOptions>
  private tests: TestResult[] = []
  private originalBranch: string = ''
  private startTime: number = 0

  constructor(options: TestEyesReporterOptions = {}) {
    this.options = {
      dataBranch: options.dataBranch ?? 'gh-data',
      deployBranch: options.deployBranch ?? 'gh-pages',
      deploy: options.deploy ?? true,
      frontendDistPath: options.frontendDistPath ?? '',
      prNumber: options.prNumber ?? this.getPrNumber()
    }
  }

  private getPrNumber(): number {
    const prNum = process.env.GITHUB_PR_NUMBER || process.env.PR_NUMBER || '0'
    return parseInt(prNum, 10) || 0
  }

  private isCI(): boolean {
    return !!(process.env.CI || process.env.GITHUB_ACTIONS)
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startTime = Date.now()
    this.tests = []
    console.log('\n[test-eyes] Starting test collection...')
  }

  onTestEnd(test: TestCase, result: PlaywrightTestResult): void {
    // Determine if test was flaky (failed at least once but ultimately passed)
    const wasFlaky = result.status === 'passed' && result.retry > 0

    // Calculate total duration across all retries
    const durationMs = result.duration

    // Build full test name: file > suite > test
    const titlePath = test.titlePath().join(' > ')

    // Map Playwright statuses to our simplified model
    let status: 'passed' | 'failed' | 'skipped'
    if (result.status === 'passed') {
      status = 'passed'
    } else if (result.status === 'skipped') {
      status = 'skipped'
    } else {
      status = 'failed' // timedOut, failed, interrupted -> failed
    }

    this.tests.push({
      name: titlePath,
      durationMs,
      status,
      wasFlaky
    })
  }

  async onEnd(result: FullResult): Promise<void> {
    const duration = Date.now() - this.startTime
    console.log(`\n[test-eyes] Tests completed in ${duration}ms`)
    console.log(`[test-eyes] Collected ${this.tests.length} test results`)

    const flakyCount = this.tests.filter(t => t.wasFlaky).length
    if (flakyCount > 0) {
      console.log(`[test-eyes] Detected ${flakyCount} flaky tests`)
    }

    if (!this.isCI()) {
      console.log('[test-eyes] Not in CI environment, skipping data submission')
      console.log('[test-eyes] Set CI=true to enable data collection')
      return
    }

    try {
      await this.submitData()
    } catch (error) {
      console.error('[test-eyes] Failed to submit data:', error)
    }
  }

  private async submitData(): Promise<void> {
    console.log('[test-eyes] Submitting test data...')

    // Configure git
    await configureGit(getDefaultGitConfig())

    // Get current state
    const commitSha = process.env.GITHUB_SHA || await getCurrentSha()
    this.originalBranch = await getCurrentBranch()

    // Build run data
    const runData: RunData = {
      runId: generateRunId(commitSha),
      prNumber: this.options.prNumber,
      commitSha,
      createdAt: new Date().toISOString(),
      tests: this.tests
    }

    // Switch to data branch
    const dataBranch = this.options.dataBranch
    const branchExisted = await fetchBranch(dataBranch)

    if (branchExisted || await branchExists(dataBranch)) {
      await checkoutBranch(dataBranch)
    } else {
      console.log(`[test-eyes] Creating new branch: ${dataBranch}`)
      await createOrphanBranch(dataBranch)
    }

    // Save test data
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
    if (this.originalBranch && this.originalBranch !== dataBranch) {
      await checkoutBranch(this.originalBranch)
    }

    // Deploy if enabled
    if (this.options.deploy) {
      await this.deployDashboard()
    }
  }

  private async deployDashboard(): Promise<void> {
    try {
      await deployDashboard({
        dataBranch: this.options.dataBranch,
        deployBranch: this.options.deployBranch
      })
    } catch (error) {
      console.error('[test-eyes] Deploy failed:', (error as Error).message)
    }
  }
}
