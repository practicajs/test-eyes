import { useState } from 'react'
import { Title, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@test-eyes/design-system'
import { SearchInput } from './components/SearchInput'
import { Tabs } from './components/Tabs'
import { useTestData } from './hooks/useTestData'
import { useTestFilter } from './hooks/useTestFilter'
import type { TestRow } from './types'

type TabId = 'slowest' | 'fastest' | 'flaky' | 'flaky-by-category'

const tabs = [
  { id: 'slowest' as TabId, label: 'Slowest Tests' },
  { id: 'fastest' as TabId, label: 'Fastest Tests' },
  { id: 'flaky' as TabId, label: 'Flaky Tests' },
  { id: 'flaky-by-category' as TabId, label: 'Flaky by Category' },
]

export default function App() {
  const { data, meta, loading, error } = useTestData()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('slowest')

  const filteredData = useTestFilter(data, searchQuery)

  const flakyTests = filteredData.filter(t => t.flakyCount > 0)
  const tabsWithCounts = tabs.map(tab => ({
    ...tab,
    count: tab.id === 'flaky' || tab.id === 'flaky-by-category' ? flakyTests.length : undefined
  }))

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-6xl px-8 py-4">
          <Title size="h2" className="text-foreground">Test Eyes Dashboard</Title>
          {meta?.lastAggregatedAt && (
            <p className="text-sm text-muted-foreground mt-1">
              Last updated: {new Date(meta.lastAggregatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-8">
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}

        {!loading && !error && data.length > 0 && (
          <>
            <div className="mb-6 max-w-md">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search tests..."
              />
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 pt-4">
                <Tabs tabs={tabsWithCounts} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as TabId)} />
              </div>

              <div className="p-6">
                {activeTab === 'slowest' && <SlowestTable data={filteredData} />}
                {activeTab === 'fastest' && <FastestTable data={filteredData} />}
                {activeTab === 'flaky' && <FlakyTable data={flakyTests} />}
                {activeTab === 'flaky-by-category' && <FlakyByCategoryTable data={flakyTests} />}
              </div>
            </div>

            {filteredData.length === 0 && (
              <p className="text-muted-foreground mt-4">No tests match "{searchQuery}"</p>
            )}
          </>
        )}

        {!loading && !error && data.length === 0 && <EmptyState />}
      </main>
    </div>
  )
}

function LoadingState() {
  return <p className="text-muted-foreground">Loading...</p>
}

function ErrorState({ message }: { message: string }) {
  return <p className="text-destructive">Error: {message}</p>
}

function EmptyState() {
  return <p className="text-muted-foreground mt-4">No test data yet. Run some PRs to collect data.</p>
}

function SlowestTable({ data }: { data: TestRow[] }) {
  const sorted = [...data].sort((a, b) => b.p95DurationMs - a.p95DurationMs)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Test Name</TableHead>
          <TableHead className="text-right">p95 Time</TableHead>
          <TableHead className="text-right">Avg Time</TableHead>
          <TableHead className="text-right">Runs</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map(test => (
          <TableRow key={test.name}>
            <TableCell className="font-medium">{test.name}</TableCell>
            <TableCell className="text-right">{formatDuration(test.p95DurationMs)}</TableCell>
            <TableCell className="text-right text-muted-foreground">{formatDuration(test.avgDurationMs)}</TableCell>
            <TableCell className="text-right text-muted-foreground">{test.totalRuns}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function FastestTable({ data }: { data: TestRow[] }) {
  const sorted = [...data].sort((a, b) => a.p95DurationMs - b.p95DurationMs)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Test Name</TableHead>
          <TableHead className="text-right">p95 Time</TableHead>
          <TableHead className="text-right">Avg Time</TableHead>
          <TableHead className="text-right">Runs</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map(test => (
          <TableRow key={test.name}>
            <TableCell className="font-medium">{test.name}</TableCell>
            <TableCell className="text-right">{formatDuration(test.p95DurationMs)}</TableCell>
            <TableCell className="text-right text-muted-foreground">{formatDuration(test.avgDurationMs)}</TableCell>
            <TableCell className="text-right text-muted-foreground">{test.totalRuns}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function FlakyTable({ data }: { data: TestRow[] }) {
  const sorted = [...data].sort((a, b) => b.flakyCount - a.flakyCount)

  if (sorted.length === 0) {
    return <p className="text-muted-foreground py-8 text-center">No flaky tests detected.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Test Name</TableHead>
          <TableHead className="text-right">Flaky Count</TableHead>
          <TableHead className="text-right">Flaky Rate</TableHead>
          <TableHead className="text-right">Total Runs</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map(test => (
          <TableRow key={test.name}>
            <TableCell className="font-medium">{test.name}</TableCell>
            <TableCell className="text-right">
              <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                {test.flakyCount}
              </span>
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {((test.flakyCount / test.totalRuns) * 100).toFixed(1)}%
            </TableCell>
            <TableCell className="text-right text-muted-foreground">{test.totalRuns}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface CategoryGroup {
  category: string
  tests: TestRow[]
  totalFlaky: number
}

function FlakyByCategoryTable({ data }: { data: TestRow[] }) {
  const groups = groupByCategory(data)

  if (groups.length === 0) {
    return <p className="text-muted-foreground py-8 text-center">No flaky tests detected.</p>
  }

  return (
    <div className="space-y-8">
      {groups.map(group => (
        <div key={group.category}>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-foreground">{group.category}</h3>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              {group.totalFlaky} flaky
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test Name</TableHead>
                <TableHead className="text-right">Flaky Count</TableHead>
                <TableHead className="text-right">Flaky Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.tests.sort((a, b) => b.flakyCount - a.flakyCount).map(test => (
                <TableRow key={test.name}>
                  <TableCell className="font-medium">{getTestShortName(test.name)}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                      {test.flakyCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {((test.flakyCount / test.totalRuns) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function getCategory(name: string): string {
  const separator = name.includes(' > ') ? ' > ' : '/'
  const parts = name.split(separator)
  return parts.length > 1 ? parts[0] : 'Other'
}

function getTestShortName(name: string): string {
  const separator = name.includes(' > ') ? ' > ' : '/'
  const parts = name.split(separator)
  return parts.length > 1 ? parts.slice(1).join(separator) : name
}

function groupByCategory(tests: TestRow[]): CategoryGroup[] {
  const grouped: Record<string, TestRow[]> = {}

  for (const test of tests) {
    const category = getCategory(test.name)
    if (!grouped[category]) grouped[category] = []
    grouped[category].push(test)
  }

  return Object.entries(grouped)
    .map(([category, tests]) => ({
      category,
      tests,
      totalFlaky: tests.reduce((sum, t) => sum + t.flakyCount, 0)
    }))
    .sort((a, b) => b.totalFlaky - a.totalFlaky)
}
