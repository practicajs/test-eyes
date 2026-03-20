export interface TestRow {
  name: string
  totalRuns: number
  passCount: number
  failCount: number
  flakyCount: number
  avgDurationMs: number
  p95DurationMs: number
}

export interface AggregatedMeta {
  totalRuns: number
  lastAggregatedAt: string
  processedFiles: string[]
}

export interface AggregatedData {
  schemaVersion: string
  meta: AggregatedMeta
  tests: Record<string, Omit<TestRow, 'name'>>
}
