// Git > Bisect, the bisect banner and the Log's Bisect items. Every step runs `git bisect`
// (commands/bisect.rs); the banner reads the state back through bisectStore.

import { api } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { BisectMark, CommitSummary } from "$lib/types";
import { dialogs, type PickItem } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { bisectStore } from "./bisect.svelte";

/** How many recent commits the pickers list. */
const PICKER_COMMITS = 200;
const HEAD_PICK = "HEAD";

function activeRoot(): string | null {
  return repoStore.repo?.root ?? null;
}

function isBisecting(repoRoot: string): boolean {
  return (repoStore.statuses[repoRoot]?.bisect ?? null) !== null;
}

function commitItems(commits: CommitSummary[], skipId: string | null): PickItem[] {
  return commits
    .filter((commit) => commit.id !== skipId)
    .map((commit) => ({
      value: commit.id,
      label: commit.summary || commit.shortId,
      description: `${commit.shortId}  ${commit.authorName}`,
    }));
}

/** "Found the first bad commit" once git names it. */
function markSuccess(output: string): string | null {
  return /is the first \S+ commit/.test(output) ? "Found the first bad commit" : null;
}

/** Git > Bisect > Start...: the bad commit (HEAD by default), then a good one. */
export async function startBisect(repoRoot: string | null = activeRoot()): Promise<void> {
  if (!repoRoot) {
    return;
  }
  if (isBisecting(repoRoot)) {
    toast.info("A bisect is already running");
    return;
  }
  const commits = await api.getLog(repoRoot, 0, PICKER_COMMITS, false).catch(() => []);
  const bad = await dialogs.pick({
    title: "Bisect: Pick the Bad Commit",
    placeholder: "A commit that has the problem",
    items: [{ value: HEAD_PICK, label: "Current commit (HEAD)", pinned: true }, ...commitItems(commits, null)],
    emptyText: "No commits",
  });
  if (!bad) {
    return;
  }
  const badId = bad === HEAD_PICK ? (commits[0]?.id ?? null) : bad;
  const good = await dialogs.pick({
    title: "Bisect: Pick a Good Commit",
    placeholder: "An older commit without the problem",
    items: commitItems(commits, badId),
    emptyText: "No other commits",
  });
  if (!good) {
    return;
  }
  await repoStore.run("Bisect", (repoPath) => api.bisectStart(repoPath, bad === HEAD_PICK ? "HEAD" : bad, [good]), {
    repoPath: repoRoot,
    success: (output) => markSuccess(output) ?? "Bisect started: test the checked out commit",
  });
}

/** Marks `commitId` (the checked out commit when null). */
export async function markBisect(mark: BisectMark, commitId: string | null = null, repoRoot: string | null = activeRoot()): Promise<void> {
  if (!repoRoot) {
    return;
  }
  await repoStore.run("Bisect", (repoPath) => api.bisectMark(repoPath, mark, commitId), {
    repoPath: repoRoot,
    success: markSuccess,
  });
}

/** The Log's Bisect: Mark as Good / Bad; starts a bisect when none runs. */
export async function markFromLog(repoRoot: string, commitId: string, mark: "good" | "bad"): Promise<void> {
  if (isBisecting(repoRoot)) {
    await markBisect(mark, commitId, repoRoot);
    return;
  }
  await repoStore.run(
    "Bisect",
    (repoPath) => (mark === "bad" ? api.bisectStart(repoPath, commitId, []) : api.bisectStart(repoPath, null, [commitId])),
    {
      repoPath: repoRoot,
      success: mark === "bad" ? "Bisect started: now mark a good commit" : "Bisect started: now mark a bad commit",
    },
  );
}

/** Git > Bisect > Reset: ends the bisect and goes back to where it started. */
export async function resetBisect(repoRoot: string | null = activeRoot()): Promise<void> {
  if (!repoRoot) {
    return;
  }
  const start = bisectStore.forRepo(repoRoot)?.start ?? "";
  await repoStore.run("Bisect reset", (repoPath) => api.bisectReset(repoPath), {
    repoPath: repoRoot,
    success: start ? `Bisect ended, back on ${start.length === 40 ? start.slice(0, 8) : start}` : "Bisect ended",
  });
}

export function showFirstBad(repoRoot: string | null = activeRoot()): void {
  const firstBad = bisectStore.forRepo(repoRoot)?.firstBad ?? null;
  if (repoRoot && firstBad) {
    repoStore.openCommitTab(repoRoot, firstBad.id, { summary: firstBad.summary });
  }
}
