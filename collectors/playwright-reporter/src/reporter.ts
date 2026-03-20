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
  private errors: string[] = []

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

  private log(message: string): void {
    console.log(`[test-eyes] ${message}`)
  }

  private logError(message: string, error?: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error ?? '')
    const fullMsg = errorMsg ? `${message}: ${errorMsg}` : message
    console.error(`[test-eyes] ERROR: ${fullMsg}`)
    this.errors.push(fullMsg)
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startTime = Date.now()
    this.tests = []
    this.errors = []
    this.log('Starting test collection...')
  }

  onTestEnd(test: TestCase, result: PlaywrightTestResult): void {
    const wasFlaky = result.status === 'passed' && result.retry > 0
    const durationMs = result.duration
    const titlePath = test.titlePath().join(' > ')

    let status: 'passed' | 'failed' | 'skipped'
    if (result.status === 'passed') {
      status = 'passed'
    } else if (result.status === 'skipped') {
      status = 'skipped'
    } else {
      status = 'failed'
    }

    this.tests.push({ name: titlePath, durationMs, status, wasFlaky })
  }

  async onEnd(_result: FullResult): Promise<void> {
    const duration = Date.now() - this.startTime
    this.log(`Tests completed in ${duration}ms`)
    this.log(`Collected ${this.tests.length} test results`)

    const flakyCount = this.tests.filter(t => t.wasFlaky).length
    if (flakyCount > 0) {
      this.log(`Detected ${flakyCount} flaky tests`)
    }

    if (!this.isCI()) {
      this.log('Not in CI environment, skipping data submission')
      this.log('Set CI=true to enable data collection')
      return
    }

    await this.submitData()

    if (this.errors.length > 0) {
      this.log(`Completed with ${this.errors.length} error(s)`)
    }
  }

  private async submitData(): Promise<void> {
    this.log('Submitting test data...')

    // Step 1: Configure git
    try {
      await configureGit(getDefaultGitConfig())
    } catch (error) {
      this.logError('Failed to configure git', error)
      return
    }

    // Step 2: Get current state
    let commitSha: string
    try {
      commitSha = process.env.GITHUB_SHA || await getCurrentSha()
      this.originalBranch = await getCurrentBranch()
    } catch (error) {
      this.logError('Failed to get git state', error)
      return
    }

    // Step 3: Build run data
    const runData: RunData = {
      runId: generateRunId(commitSha),
      prNumber: this.options.prNumber,
      commitSha,
      createdAt: new Date().toISOString(),
      tests: this.tests
    }

    // Step 4: Switch to data branch
    const dataBranch = this.options.dataBranch
    try {
      const branchExisted = await fetchBranch(dataBranch)
      if (branchExisted || await branchExists(dataBranch)) {
        await checkoutBranch(dataBranch)
      } else {
        this.log(`Creating new branch: ${dataBranch}`)
        await createOrphanBranch(dataBranch)
      }
    } catch (error) {
      this.logError(`Failed to checkout branch ${dataBranch}`, error)
      return
    }

    // Step 5: Save test data
    const dataDir = 'data'
    const filename = generateFilename(commitSha)
    try {
      await ensureDir(dataDir)
      await saveRunData(dataDir, filename, runData)
      this.log(`Saved: ${dataDir}/${filename}`)
    } catch (error) {
      this.logError('Failed to save test data', error)
      await this.returnToOriginalBranch()
      return
    }

    // Step 6: Aggregate
    try {
      await aggregate(dataDir)
      this.log('Aggregation complete')
    } catch (error) {
      this.logError('Failed to aggregate data', error)
      // Continue - we still want to commit what we have
    }

    // Step 7: Commit and push
    try {
      await stageFiles(['data/'])
      if (await hasChanges()) {
        const sha = await commit(`Add test data: ${runData.runId}`)
        if (sha) {
          this.log(`Committed: ${sha.slice(0, 7)}`)
        }
        const pushed = await push(dataBranch)
        if (pushed) {
          this.log(`Pushed to ${dataBranch}`)
        } else {
          this.logError('Failed to push to remote')
        }
      } else {
        this.log('No changes to commit')
      }
    } catch (error) {
      this.logError('Failed to commit/push', error)
    }

    // Step 8: Return to original branch
    await this.returnToOriginalBranch()

    // Step 9: Deploy if enabled
    if (this.options.deploy) {
      await this.deployDashboard()
    }
  }

  private async returnToOriginalBranch(): Promise<void> {
    if (this.originalBranch && this.originalBranch !== this.options.dataBranch) {
      try {
        await checkoutBranch(this.originalBranch)
      } catch (error) {
        this.logError('Failed to return to original branch', error)
      }
    }
  }

  private async deployDashboard(): Promise<void> {
    try {
      await deployDashboard({
        dataBranch: this.options.dataBranch,
        deployBranch: this.options.deployBranch
      })
    } catch (error) {
      this.logError('Deploy failed', error)
    }
  }
}
