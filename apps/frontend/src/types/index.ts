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
  lastAggregatedAt: string | null
}

export interface AggregatedData {
  schemaVersion: string
  meta: AggregatedMeta
  tests: Record<string, Omit<TestRow, 'name'>>
}
