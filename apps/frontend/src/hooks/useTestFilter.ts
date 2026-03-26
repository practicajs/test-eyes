import { useMemo } from 'react'
import type { TestRow } from '../types'

export function useTestFilter(tests: TestRow[], query: string): TestRow[] {
  return useMemo(() => {
    if (!query.trim()) {
      return tests
    }

    const lowerQuery = query.toLowerCase().trim()

    return tests.filter((test) =>
      test.name.toLowerCase().includes(lowerQuery)
    )
  }, [tests, query])
}
