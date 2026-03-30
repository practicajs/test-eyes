import {
  parseAndBuildRunData,
  collectFromRunData,
  type CollectResult
} from 'test-processing'

export interface CollectFromJUnitOptions {
  junitPath: string
  dataBranch: string
  commitSha?: string
  prNumber?: number
}

export async function collectFromJUnit(
  options: CollectFromJUnitOptions
): Promise<CollectResult> {
  const { junitPath, dataBranch, commitSha, prNumber } = options

  // Parse JUnit XML using shared parser from test-processing
  console.log(`[test-eyes] Parsing JUnit file: ${junitPath}`)
  const runData = await parseAndBuildRunData(junitPath, { commitSha, prNumber })
  console.log(`[test-eyes] Found ${runData.tests.length} tests`)

  // Use shared collection function (no aggregation - that happens in cron)
  return collectFromRunData({ runData, dataBranch })
}
