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

interface SubmitContext {
  commitSha: string
  originalBranch: string
  runData: RunData
}

export class TestEyesReporter implements Reporter {
  private options: Required<TestEyesReporterOptions>
  private tests: TestResult[] = []
  private originalBranch = ''
  private startTime = 0

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
    return parseInt(process.env.GITHUB_PR_NUMBER || process.env.PR_NUMBER || '0', 10) || 0
  }

  private isCI(): boolean {
    return !!(process.env.CI || process.env.GITHUB_ACTIONS)
  }

  private log(message: string): void {
    console.log(`[test-eyes] ${message}`)
  }

  private logError(message: string, error?: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error ?? '')
    console.error(`[test-eyes] ERROR: ${errorMsg ? `${message}: ${errorMsg}` : message}`)
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startTime = Date.now()
    this.tests = []
    this.log('Starting test collection...')
  }

  onTestEnd(test: TestCase, result: PlaywrightTestResult): void {
    this.tests.push({
      name: test.titlePath().filter(Boolean).join(' > '),
      durationMs: result.duration,
      status: this.mapStatus(result.status),
      wasFlaky: result.status === 'passed' && result.retry > 0
    })
  }

  private mapStatus(status: string): 'passed' | 'failed' | 'skipped' {
    if (status === 'passed') return 'passed'
    if (status === 'skipped') return 'skipped'
    return 'failed'
  }

  async onEnd(_result: FullResult): Promise<void> {
    this.log(`Tests completed in ${Date.now() - this.startTime}ms`)
    this.log(`Collected ${this.tests.length} test results`)

    const flakyCount = this.tests.filter(t => t.wasFlaky).length
    if (flakyCount > 0) this.log(`Detected ${flakyCount} flaky tests`)

    if (!this.isCI()) {
      this.log('Not in CI, skipping. Set CI=true to enable.')
      return
    }

    await this.submitData()
  }

  private async submitData(): Promise<void> {
    const context = await this.prepareContext()
    if (!context) return

    const success = await this.saveToDataBranch(context)
    await this.returnToOriginalBranch(context.originalBranch)

    if (success && this.options.deploy) {
      await this.deploy()
    }
  }

  private async prepareContext(): Promise<SubmitContext | null> {
    try {
      await configureGit(getDefaultGitConfig())
      const commitSha = process.env.GITHUB_SHA || await getCurrentSha()
      const originalBranch = await getCurrentBranch()

      return {
        commitSha,
        originalBranch,
        runData: {
          runId: generateRunId(commitSha),
          prNumber: this.options.prNumber,
          commitSha,
          createdAt: new Date().toISOString(),
          tests: this.tests
        }
      }
    } catch (error) {
      this.logError('Failed to prepare context', error)
      return null
    }
  }

  private async saveToDataBranch(ctx: SubmitContext): Promise<boolean> {
    const { dataBranch } = this.options

    try {
      await this.checkoutDataBranch(dataBranch)
      await this.saveData(ctx)
      await this.commitAndPush(ctx.runData.runId, dataBranch)
      return true
    } catch (error) {
      this.logError('Failed to save data', error)
      return false
    }
  }

  private async checkoutDataBranch(branch: string): Promise<void> {
    const exists = await fetchBranch(branch) || await branchExists(branch)
    if (exists) {
      await checkoutBranch(branch)
    } else {
      this.log(`Creating new branch: ${branch}`)
      await createOrphanBranch(branch)
    }
  }

  private async saveData(ctx: SubmitContext): Promise<void> {
    const dataDir = 'data'
    await ensureDir(dataDir)
    await saveRunData(dataDir, generateFilename(ctx.commitSha), ctx.runData)
    this.log(`Saved: ${dataDir}/${generateFilename(ctx.commitSha)}`)

    await aggregate(dataDir)
    this.log('Aggregation complete')
  }

  private async commitAndPush(runId: string, branch: string): Promise<void> {
    await stageFiles(['data/'])
    if (!await hasChanges()) {
      this.log('No changes to commit')
      return
    }

    const sha = await commit(`Add test data: ${runId}`)
    if (sha) this.log(`Committed: ${sha.slice(0, 7)}`)

    const pushed = await push(branch)
    if (pushed) this.log(`Pushed to ${branch}`)
  }

  private async returnToOriginalBranch(branch: string): Promise<void> {
    if (branch && branch !== this.options.dataBranch) {
      try {
        await checkoutBranch(branch)
      } catch (error) {
        this.logError('Failed to return to original branch', error)
      }
    }
  }

  private async deploy(): Promise<void> {
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
