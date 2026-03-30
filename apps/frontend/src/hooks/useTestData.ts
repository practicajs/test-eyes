import { useEffect, useState } from 'react'
import type { TestRow, AggregatedData, AggregatedMeta } from '../types'

interface UseTestDataResult {
  data: TestRow[]
  meta: AggregatedMeta | null
  loading: boolean
  error: string | null
}

export function useTestData(): UseTestDataResult {
  const [data, setData] = useState<TestRow[]>([])
  const [meta, setMeta] = useState<AggregatedMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTestData()
      .then(({ rows, meta }) => {
        setData(rows)
        setMeta(meta)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Unknown error')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { data, meta, loading, error }
}

async function fetchTestData() {
  const baseUrl = `${import.meta.env.BASE_URL}data`
  const res = await fetch(`${baseUrl}/test-summary.json`)

  if (!res.ok) {
    throw new Error('No aggregated data yet')
  }

  const aggregated: AggregatedData = await res.json()

  const rows: TestRow[] = Object.entries(aggregated.tests).map(
    ([name, stats]) => ({ name, ...stats })
  )

  return { rows, meta: aggregated.meta }
}
