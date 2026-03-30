import { exec } from "child_process";
import { promisify } from "util";
import type {
  GitConfig,
  CommitResult,
  PushResult,
  AggregatedData,
  TestHistory,
} from "./types.js";
import { loadAggregatedData as loadFromDisk } from "./file-operations.js";

const execAsync = promisify(exec);

// ============================================================================
// Git Command Executor
// ============================================================================

const EXEC_OPTIONS = { maxBuffer: 50 * 1024 * 1024 }; // 50MB buffer

async function runGit(
  args: string,
  cwd?: string,
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execAsync(`git ${args}`, { cwd, ...EXEC_OPTIONS });
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      message: string;
    };
    throw new Error(
      `Git command failed: git ${args}\n${execError.stderr || execError.message}`,
    );
  }
}

async function runGitSafe(
  args: string,
  cwd?: string,
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const result = await execAsync(`git ${args}`, { cwd, ...EXEC_OPTIONS });
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
  await runGit(`config user.name "${config.userName}"`);
  await runGit(`config user.email "${config.userEmail}"`);
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
  const branchList = branches.join(" ");
  const result = await runGitSafe(`fetch origin ${branchList}`);

  if (!result.success) {
    // Try fetching main only as fallback
    await runGit("fetch origin main");
  }
}

export async function checkoutBranch(
  branch: string,
  createOrphan = false,
): Promise<boolean> {
  if (createOrphan) {
    const result = await runGitSafe(`checkout ${branch}`);
    if (!result.success) {
      await runGit(`checkout --orphan ${branch}`);
      return true; // Created new orphan branch
    }
    return false; // Existing branch
  }

  await runGit(`checkout ${branch}`);
  return false;
}

export async function checkoutOrCreateBranch(branch: string): Promise<boolean> {
  // Try 1: checkout existing local branch
  const result = await runGitSafe(`checkout ${branch}`);
  if (result.success) {
    return false;
  }

  // Try 2: checkout from remote (branch exists on remote but not locally)
  const fromRemote = await runGitSafe(`checkout -b ${branch} origin/${branch}`);
  if (fromRemote.success) {
    return false;
  }

  // Try 3: create new orphan branch
  await runGit(`checkout --orphan ${branch}`);
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

  const result = await runGitSafe(`show origin/${branch}:${filepath}`);

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

  const result = await runGitSafe(`show origin/${branch}:${filepath}`);

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
    await runGit(`add ${pattern}`);
  }
}

export async function stageAll(): Promise<void> {
  await runGit("add .");
}

export async function hasChanges(): Promise<boolean> {
  const result = await runGitSafe("diff --staged --quiet");
  return !result.success; // Exit code 1 means there are changes
}

export async function commit(message: string): Promise<CommitResult> {
  const changes = await hasChanges();

  if (!changes) {
    return { success: false, message: "No changes to commit" };
  }

  try {
    const { stdout } = await runGit(`commit --no-verify -m "${message}"`);
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
    const forceFlag = force ? "--force" : "";
    await runGit(`push origin ${branch} ${forceFlag}`.trim());
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
    await runGitSafe(`pull --rebase origin ${branch}`);
  }

  return { success: false, message: `Failed after ${maxRetries} retries` };
}

export async function pushWithUpstream(
  localBranch: string,
  remoteBranch: string,
  force = false,
): Promise<PushResult> {
  try {
    const forceFlag = force ? "--force" : "";
    await runGit(
      `push origin ${localBranch}:${remoteBranch} ${forceFlag}`.trim(),
    );
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
  await runGitSafe("rm -rf .");
}

export async function getCurrentBranch(): Promise<string> {
  const { stdout } = await runGit("rev-parse --abbrev-ref HEAD");
  return stdout.trim();
}

export async function getCurrentSha(): Promise<string> {
  const { stdout } = await runGit("rev-parse HEAD");
  return stdout.trim();
}

