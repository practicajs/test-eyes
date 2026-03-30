import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult as PlaywrightTestResult
} from '@playwright/test/reporter'
import type { TestEyesReporterOptions } from './types.js'
import {
  collectFromRunData,
  type TestResult,
  type RunData
} from 'test-processing'

interface TestAttempts {
  test: TestCase
  attempts: PlaywrightTestResult[]
}

export class TestEyesReporter implements Reporter {
  private options: Required<TestEyesReporterOptions>
  private testAttempts = new Map<string, TestAttempts>()
  private startTime = 0

  constructor(options: TestEyesReporterOptions = {}) {
    this.options = {
      dataBranch: options.dataBranch ?? 'gh-data',
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
    this.testAttempts.clear()
    this.log('Starting test collection...')
  }

  onTestEnd(test: TestCase, result: PlaywrightTestResult): void {
    const testId = test.id
    const existing = this.testAttempts.get(testId)

    if (existing) {
      existing.attempts.push(result)
    } else {
      this.testAttempts.set(testId, { test, attempts: [result] })
    }
  }

  async onEnd(_result: FullResult): Promise<void> {
    this.log(`Tests completed in ${Date.now() - this.startTime}ms`)

    const tests = this.buildTestResults()
    this.log(`Collected ${tests.length} test results`)

    const flakyCount = tests.filter(t => t.wasFlaky).length
    if (flakyCount > 0) this.log(`Detected ${flakyCount} flaky tests`)

    if (!this.isCI()) {
      this.log('Not in CI, skipping. Set CI=true to enable.')
      return
    }

    await this.submitData(tests)
  }

  private buildTestResults(): TestResult[] {
    const results: TestResult[] = []

    for (const { test, attempts } of this.testAttempts.values()) {
      const outcome = test.outcome()
      const lastAttempt = attempts[attempts.length - 1]
      const retries = attempts.length - 1

      results.push({
        name: test.titlePath().filter(Boolean).join(' > '),
        durationMs: lastAttempt.duration,
        status: this.mapOutcome(outcome),
        wasFlaky: outcome === 'flaky',
        retries: retries > 0 ? retries : undefined
      })
    }

    return results
  }

  private mapOutcome(outcome: ReturnType<TestCase['outcome']>): 'passed' | 'failed' | 'skipped' {
    if (outcome === 'expected' || outcome === 'flaky') return 'passed'
    if (outcome === 'skipped') return 'skipped'
    return 'failed'
  }

  private async submitData(tests: TestResult[]): Promise<void> {
    try {
      const commitSha = process.env.GITHUB_SHA || await this.getCurrentSha()
      const runData = this.buildRunData(commitSha, tests)

      const result = await collectFromRunData({
        runData,
        dataBranch: this.options.dataBranch
      })

      if (result.success) {
        this.log(result.message)
      } else {
        this.logError(result.message)
      }
    } catch (error) {
      this.logError('Failed to submit data', error)
    }
  }

  private buildRunData(commitSha: string, tests: TestResult[]): RunData {
    return {
      runId: `${commitSha.slice(0, 7)}-${Date.now()}`,
      prNumber: this.options.prNumber,
      commitSha,
      createdAt: new Date().toISOString(),
      tests
    }
  }

  private async getCurrentSha(): Promise<string> {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    const { stdout } = await execAsync('git rev-parse HEAD')
    return stdout.trim()
  }
}
