import { readFile } from 'fs/promises'
import type { TestResult } from './types.js'

// JUnit XML types
interface JUnitTestCase {
  '@_classname'?: string
  '@_name': string
  '@_time'?: string
  failure?: unknown
  error?: unknown
  skipped?: unknown
}

interface JUnitTestSuite {
  '@_name'?: string
  testcase?: JUnitTestCase | JUnitTestCase[]
}

interface JUnitReport {
  testsuites?: { testsuite: JUnitTestSuite | JUnitTestSuite[] }
  testsuite?: JUnitTestSuite
}

function normalizeToArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function getTestStatus(testCase: JUnitTestCase): TestResult['status'] {
  if (testCase.skipped !== undefined) return 'skipped'
  if (testCase.failure !== undefined || testCase.error !== undefined) return 'failed'
  return 'passed'
}

function parseTestCase(testCase: JUnitTestCase): TestResult {
  const className = testCase['@_classname'] || ''
  const testName = testCase['@_name'] || 'unknown'
  const name = className ? `${className} ${testName}` : testName

  return {
    name: name.trim(),
    durationMs: Math.round(parseFloat(testCase['@_time'] || '0') * 1000),
    status: getTestStatus(testCase)
  }
}

export function parseJUnitXml(xml: string): TestResult[] {
  const tests: TestResult[] = []

  // Match testcase with content: <testcase ...>...</testcase>
  // Negative lookbehind (?<!/) ensures we don't match self-closing tags
  const withContentRegex = /<testcase\s+([^>]*?)(?<!\/)>([\s\S]*?)<\/testcase>/g
  let match

  while ((match = withContentRegex.exec(xml)) !== null) {
    const attrs = match[1]
    const content = match[2]
    tests.push(parseTestAttrs(attrs, content))
  }

  // Match self-closing: <testcase ... />
  const selfClosingRegex = /<testcase\s+([^>]*?)\/>/g
  while ((match = selfClosingRegex.exec(xml)) !== null) {
    const attrs = match[1]
    tests.push(parseTestAttrs(attrs, ''))
  }

  return tests
}

function parseTestAttrs(attrs: string, content: string): TestResult {
  const nameMatch = attrs.match(/name=["']([^"']+)["']/)
  const classnameMatch = attrs.match(/classname=["']([^"']+)["']/)
  const timeMatch = attrs.match(/time=["']([^"']+)["']/)

  const name = nameMatch?.[1] || 'unknown'
  const classname = classnameMatch?.[1] || ''
  const time = timeMatch?.[1] || '0'

  let status: TestResult['status'] = 'passed'
  if (content.includes('<skipped') || attrs.includes('skipped')) {
    status = 'skipped'
  } else if (content.includes('<failure') || content.includes('<error')) {
    status = 'failed'
  }

  return {
    name: classname ? `${classname} ${name}` : name,
    durationMs: Math.round(parseFloat(time) * 1000),
    status
  }
}

export async function parseJUnitFile(filepath: string): Promise<TestResult[]> {
  const xml = await readFile(filepath, 'utf-8')
  return parseJUnitXml(xml)
}
