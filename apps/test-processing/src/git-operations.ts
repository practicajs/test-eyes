import { execFile } from "child_process";
import { promisify } from "util";
import type {
  GitConfig,
  CommitResult,
  PushResult,
  AggregatedData,
  TestHistory,
  RunData,
} from "./types.js";
import {
  loadAggregatedData as loadFromDisk,
  saveTestData,
  generateTestDataFilename,
  ensureDir,
  saveAggregatedData,
  saveTestHistory,
} from "./file-operations.js";

const execFileAsync = promisify(execFile);

// ============================================================================
// Git Command Executor
// ============================================================================

const EXEC_OPTIONS = { maxBuffer: 50 * 1024 * 1024 }; // 50MB buffer

async function runGit(
  args: string[],
  cwd?: string,
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync("git", args, { cwd, ...EXEC_OPTIONS });
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      message: string;
    };
    throw new Error(
      `Git command failed: git ${args.join(" ")}\n${execError.stderr || execError.message}`,
    );
  }
}

async function runGitSafe(
  args: string[],
  cwd?: string,
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const result = await execFileAsync("git", args, { cwd, ...EXEC_OPTIONS });
    return { ...result, success: true };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string };
    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || "",
      success: false,
    };
  }
}

// ============================================================================
// Configuration
// ============================================================================

export async function configureGit(config: GitConfig): Promise<void> {
  await runGit(["config", "user.name", config.userName]);
  await runGit(["config", "user.email", config.userEmail]);
}

export function getDefaultGitConfig(): GitConfig {
  return {
    userName: "github-actions[bot]",
    userEmail: "github-actions[bot]@users.noreply.github.com",
  };
}

// ============================================================================
// Fetch & Checkout
// ============================================================================

export async function fetchBranches(branches: string[]): Promise<void> {
  const result = await runGitSafe(["fetch", "origin", ...branches]);

  if (!result.success) {
    // Try fetching main only as fallback
    await runGit(["fetch", "origin", "main"]);
  }
}

export async function checkoutBranch(
  branch: string,
  createOrphan = false,
): Promise<boolean> {
  if (createOrphan) {
    const result = await runGitSafe(["checkout", branch]);
    if (!result.success) {
      await runGit(["checkout", "--orphan", branch]);
      return true; // Created new orphan branch
    }
    return false; // Existing branch
  }

  await runGit(["checkout", branch]);
  return false;
}

export async function checkoutOrCreateBranch(branch: string): Promise<boolean> {
  // Try 1: checkout existing local branch (force to discard local changes)
  const result = await runGitSafe(["checkout", "-f", branch]);
  if (result.success) {
    return false;
  }

  // Try 2: checkout from remote (branch exists on remote but not locally)
  const fromRemote = await runGitSafe(["checkout", "-b", branch, `origin/${branch}`]);
  if (fromRemote.success) {
    return false;
  }

  // Try 3: create new orphan branch (only if branch doesn't exist)
  const branchExists = await runGitSafe(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  if (branchExists.success) {
    // Branch exists but checkout failed - force checkout
    await runGit(["checkout", "-f", branch]);
    return false;
  }

  await runGit(["checkout", "--orphan", branch]);
  return true;
}

const EMPTY_AGGREGATED_DATA: AggregatedData = {
  schemaVersion: "1.0.0",
  meta: {
    lastAggregatedAt: null,
  },
  tests: {},
};

const EMPTY_TEST_HISTORY: TestHistory = {
  schemaVersion: "1.0.0",
  tests: {},
};

/**
 * Fetches aggregated data directly from a git branch using `git show`.
 * No checkout required - reads file content directly from remote.
 * This is the stubbable boundary for testing history scenarios.
 *
 * If branch is empty, falls back to reading from disk.
 */
export async function fetchAggregatedData(
  branch: string,
  filepath: string = "data/test-summary.json",
): Promise<AggregatedData> {
  // Fallback to disk if no branch specified
  if (!branch) {
    return loadFromDisk(filepath);
  }

  const result = await runGitSafe(["show", `origin/${branch}:${filepath}`]);

  if (!result.success || !result.stdout.trim()) {
    return { ...EMPTY_AGGREGATED_DATA };
  }

  try {
    return JSON.parse(result.stdout) as AggregatedData;
  } catch {
    return { ...EMPTY_AGGREGATED_DATA };
  }
}

/**
 * Fetches test history directly from a git branch using `git show`.
 * No checkout required - reads file content directly from remote.
 */
export async function fetchTestHistory(
  branch: string,
  filepath: string = "data/test-history.json",
): Promise<TestHistory> {
  if (!branch) {
    return { ...EMPTY_TEST_HISTORY };
  }

  const result = await runGitSafe(["show", `origin/${branch}:${filepath}`]);

  if (!result.success || !result.stdout.trim()) {
    return { ...EMPTY_TEST_HISTORY };
  }

  try {
    return JSON.parse(result.stdout) as TestHistory;
  } catch {
    return { ...EMPTY_TEST_HISTORY };
  }
}

// ============================================================================
// Staging & Committing
// ============================================================================

export async function stageFiles(patterns: string[]): Promise<void> {
  for (const pattern of patterns) {
    await runGit(["add", pattern]);
  }
}

export async function stageAll(): Promise<void> {
  await runGit(["add", "."]);
}

export async function hasChanges(): Promise<boolean> {
  const result = await runGitSafe(["diff", "--staged", "--quiet"]);
  return !result.success; // Exit code 1 means there are changes
}

export async function commit(message: string): Promise<CommitResult> {
  const changes = await hasChanges();

  if (!changes) {
    return { success: false, message: "No changes to commit" };
  }

  try {
    const { stdout } = await runGit(["commit", "--no-verify", "-m", message]);
    const shaMatch = stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);
    const commitSha = shaMatch?.[1];

    return { success: true, commitSha, message: "Committed successfully" };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

// ============================================================================
// Push
// ============================================================================

export async function push(branch: string, force = false): Promise<PushResult> {
  try {
    const args = force
      ? ["push", "--force", "origin", branch]
      : ["push", "origin", branch];
    await runGit(args);
    return { success: true, message: `Pushed to ${branch}` };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

/**
 * Push with retry on conflict. Uses rebase to resolve conflicts.
 * Safe because run files have unique names (no actual merge conflicts).
 */
export async function pushWithRetry(
  branch: string,
  maxRetries: number = 3,
): Promise<PushResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await push(branch);
    if (result.success) {
      return result;
    }

    // Pull latest and rebase before retry
    await runGitSafe(["pull", "--rebase", "origin", branch]);
  }

  return { success: false, message: `Failed after ${maxRetries} retries` };
}

export async function pushWithUpstream(
  localBranch: string,
  remoteBranch: string,
  force = false,
): Promise<PushResult> {
  try {
    const args = force
      ? ["push", "--force", "origin", `${localBranch}:${remoteBranch}`]
      : ["push", "origin", `${localBranch}:${remoteBranch}`];
    await runGit(args);
    return {
      success: true,
      message: `Pushed ${localBranch} to ${remoteBranch}`,
    };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

// ============================================================================
// Cleanup
// ============================================================================

export async function removeAllTracked(): Promise<void> {
  await runGitSafe(["rm", "-rf", "."]);
}

export async function getCurrentBranch(): Promise<string> {
  const { stdout } = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  return stdout.trim();
}

export async function getCurrentSha(): Promise<string> {
  const { stdout } = await runGit(["rev-parse", "HEAD"]);
  return stdout.trim();
}

// ============================================================================
// High-Level Push (Stubbable Boundaries for Testing)
// ============================================================================

export interface PushRunDataOptions {
  branch: string;
  runData: RunData;
}

/**
 * Stubbable boundary for collection flow.
 * Receives RunData, writes file, and pushes to git.
 * Mock this in tests to capture the actual data being pushed.
 */
export async function pushRunDataToGit(
  options: PushRunDataOptions,
): Promise<PushResult> {
  const { branch, runData } = options;

  await configureGit(getDefaultGitConfig());
  await fetchBranches([branch]);
  await checkoutOrCreateBranch(branch);

  // Write run file
  const runsDir = "data/runs";
  const filename = generateTestDataFilename(runData.commitSha);
  await ensureDir(runsDir);
  await saveTestData(runsDir, filename, runData);

  // Stage, commit, push
  await stageFiles([runsDir]);
  const commitResult = await commit(`Add test run: ${runData.runId}`);
  if (!commitResult.success) {
    return { success: false, message: commitResult.message };
  }

  return await pushWithRetry(branch);
}

export interface PushAggregatedDataOptions {
  branch: string;
  summary: AggregatedData;
  history: TestHistory;
}

/**
 * Stubbable boundary for aggregation flow.
 * Receives AggregatedData and TestHistory, writes files, and pushes to git.
 * Mock this in tests to capture the actual data being pushed.
 */
export async function pushAggregatedDataToGit(
  options: PushAggregatedDataOptions,
): Promise<PushResult> {
  const { branch, summary, history } = options;

  await configureGit(getDefaultGitConfig());
  await fetchBranches([branch]);
  await checkoutOrCreateBranch(branch);

  // Write summary and history files
  await ensureDir("data");
  await saveAggregatedData("data/test-summary.json", summary);
  await saveTestHistory("data/test-history.json", history);

  // Stage, commit, push
  await stageFiles(["data/test-summary.json", "data/test-history.json"]);
  const commitResult = await commit("Update aggregated test data");
  if (!commitResult.success) {
    return { success: false, message: commitResult.message };
  }

  return await pushWithRetry(branch);
}

