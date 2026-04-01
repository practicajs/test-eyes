/**
 * Log an error with full details (stack trace, all properties).
 * Does NOT throw — caller decides what to do.
 */
export function handleError(context: string, error: unknown): void {
  if (error instanceof Error) {
    const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    console.error(`[test-eyes] ${context}:\n${serialized}`)
  } else {
    console.error(`[test-eyes] ${context}: ${String(error)}`)
  }
}
