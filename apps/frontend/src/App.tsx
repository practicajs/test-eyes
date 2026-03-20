import { useEffect, useState } from 'react'
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender, createColumnHelper } from '@tanstack/react-table'
import type { SortingState } from '@tanstack/react-table'
import { Title } from '@test-eyes/design-system'
import { SearchInput } from './components/SearchInput'
import { useTestFilter } from './hooks/useTestFilter'
import type { TestRow, AggregatedData } from './types'

const columnHelper = createColumnHelper<TestRow>()

const overviewColumns = [
  columnHelper.accessor('name', { header: 'Test Name', cell: info => info.getValue() }),
  columnHelper.accessor('avgDurationMs', {
    header: 'Avg Time (s)',
    cell: info => (info.getValue() / 1000).toFixed(2),
  }),
  columnHelper.accessor('failCount', { header: 'Failures', cell: info => info.getValue() }),
  columnHelper.accessor('flakyCount', { header: 'Flaky', cell: info => info.getValue() }),
  columnHelper.accessor('totalRuns', { header: 'Runs', cell: info => info.getValue() }),
]

const slowestColumns = [
  columnHelper.accessor('name', { header: 'Test Name', cell: info => info.getValue() }),
  columnHelper.accessor('p95DurationMs', {
    header: 'p95 Time (s)',
    cell: info => (info.getValue() / 1000).toFixed(2),
  }),
  columnHelper.accessor('avgDurationMs', {
    header: 'Avg Time (s)',
    cell: info => (info.getValue() / 1000).toFixed(2),
  }),
  columnHelper.accessor('totalRuns', { header: 'Runs', cell: info => info.getValue() }),
]

export default function App() {
  const [data, setData] = useState<TestRow[]>([])
  const [meta, setMeta] = useState<AggregatedData['meta'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [overviewSorting, setOverviewSorting] = useState<SortingState>([])
  const [slowestSorting, setSllowestSorting] = useState<SortingState>([{ id: 'p95DurationMs', desc: true }])

  const filteredData = useTestFilter(data, searchQuery)

  useEffect(() => {
    async function fetchData() {
      try {
        const baseUrl = `${import.meta.env.BASE_URL}data`
        // Yoni: Let's use TanStack Query, then catch+finally are not needed #low
        const res = await fetch(`${baseUrl}/main-test-data.json`)

        if (!res.ok) {
          // Fallback: try old format
          throw new Error('No aggregated data yet - waiting for aggregation to run')
        }

        const aggregated: AggregatedData = await res.json()

        const rows: TestRow[] = Object.entries(aggregated.tests).map(([name, stats]) => ({
          name,
          totalRuns: stats.totalRuns,
          passCount: stats.passCount,
          failCount: stats.failCount,
          flakyCount: stats.flakyCount ?? 0, // backwards compatibility
          avgDurationMs: stats.avgDurationMs,
          p95DurationMs: stats.p95DurationMs
        }))

        setData(rows)
        setMeta(aggregated.meta)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Yoni: Important, a huge file, let's break down into components? #high

  const overviewTable = useReactTable({
    data: filteredData,
    columns: overviewColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: overviewSorting },
    onSortingChange: setOverviewSorting,
  })

  const slowestTable = useReactTable({
    data: filteredData,
    columns: slowestColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: slowestSorting },
    onSortingChange: setSllowestSorting,
  })

  const renderTable = (table: ReturnType<typeof useReactTable<TestRow>>) => (
    // Yoni: The design system already exports Table/TableRow/TableHead/TableCell — use those instead of raw HTML with duplicated styles
    <table className="w-full border-collapse">
      <thead>
        {table.getHeaderGroups().map(hg => (
          <tr key={hg.id} className="border-b border-gray-700">
            {hg.headers.map(h => (
              <th
                key={h.id}
                className="text-left p-3 font-semibold cursor-pointer hover:bg-gray-800"
                onClick={h.column.getToggleSortingHandler()}
              >
                {flexRender(h.column.columnDef.header, h.getContext())}
                {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted() as string] ?? ''}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(row => (
          <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-800">
            {row.getVisibleCells().map(cell => (
              <td key={cell.id} className="p-3">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <Title size="h2" className="mb-2">Test Eyes Dashboard</Title>
      {meta && (
        <p className="text-gray-400 mb-6">
          {meta.totalRuns} runs | Last updated: {new Date(meta.lastAggregatedAt).toLocaleString()}
        </p>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="mb-6 max-w-md">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search tests..."
          />
        </div>
      )}

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-400">Error: {error}</p>}

      {!loading && !error && filteredData.length > 0 && (
        <>
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-4">Test Overview</h2>
            {renderTable(overviewTable)}
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Slowest Tests (by p95)</h2>
            {renderTable(slowestTable)}
          </section>
        </>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-gray-500 mt-4">No test data yet. Run some PRs to collect data.</p>
      )}

      {!loading && !error && data.length > 0 && filteredData.length === 0 && (
        <p className="text-gray-500 mt-4">No tests match "{searchQuery}"</p>
      )}
    </div>
  )
}
