import { exec } from "child_process";
import { promisify } from "util";
import type {
  GitConfig,
  CommitResult,
  PushResult,
  RunData,
  AggregatedData,
} from "./types.js";
import {
  saveTestData,
  saveAggregatedData,
  ensureDir,
} from "./file-operations.js";

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

// ============================================================================
// Push to GitHub (Stubbable Boundary for Testing)
// ============================================================================

export interface PushTestDataOptions {
  branch: string;
  message: string;
  runData: RunData;
  runDataFilename: string;
  aggregatedData: AggregatedData;
}

/**
 * Stubbable boundary for testing. Accepts data directly for type safety.
 * Handles file writing + git stage + commit + push.
 * Flow tests stub only this function while running all upstream code for real.
 */
export async function pushToGitHub(
  options: PushTestDataOptions,
): Promise<string | null> {
  const { branch, message, runData, runDataFilename, aggregatedData } = options;

  // Write data to files
  const dataDir = "data";
  await ensureDir(dataDir);
  await saveTestData(dataDir, runDataFilename, runData);
  await saveAggregatedData(`${dataDir}/main-test-data.json`, aggregatedData);

  // Stage, commit, push
  await stageFiles([dataDir]);

  if (!(await hasChanges())) {
    return null;
  }

  const result = await commit(message);
  if (!result.success || !result.commitSha) {
    return null;
  }

  await push(branch);
  return result.commitSha;
}
