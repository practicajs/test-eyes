import {
  parseAndBuildRunData,
  collectFromRunData,
  type CollectFromRunDataResult
} from 'test-processing'

export interface CollectFromJUnitOptions {
  junitPath: string
  dataBranch: string
  commitSha?: string
  prNumber?: number
  deployAfterCollect?: boolean
  deployBranch?: string
}

export async function collectFromJUnit(
  options: CollectFromJUnitOptions
): Promise<CollectFromRunDataResult> {
  const {
    junitPath,
    dataBranch,
    commitSha,
    prNumber,
    deployAfterCollect,
    deployBranch
  } = options

  // Parse JUnit XML using shared parser from test-processing
  console.log(`[test-eyes] Parsing JUnit file: ${junitPath}`)
  const runData = await parseAndBuildRunData(junitPath, { commitSha, prNumber })
  console.log(`[test-eyes] Found ${runData.tests.length} tests`)

  // Use shared collection function
  return collectFromRunData({
    runData,
    dataBranch,
    deployAfterCollect,
    deployBranch
  })
}
