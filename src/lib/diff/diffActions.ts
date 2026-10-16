// The changes a diff's buttons make, the same in every place that shows one: the staging view writes the index
// pane's text (stage or unstage one change), and Revert or Apply takes a change out of or into the work tree file
// (the index stays), with Undo in the toast.
import { api } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { FileDiff, LineSelection } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { linesText } from "$lib/views/changes/selection.svelte";
import { indexEol } from "$lib/views/changes/stagingDiffs.svelte";
import type { ChangeRevisions } from "./diffSource";

let stageQueue: Promise<unknown> = Promise.resolve();

/** Writes the index pane's new text; serialized so rapid clicks reach the index in order. */
export function writeIndex(
  repoRoot: string,
  filePath: string,
  content: string,
  staged: FileDiff,
  stage: boolean,
): void {
  const label = stage ? "Stage change" : "Unstage change";
  const write = (repoPath: string) => api.stageContent(repoPath, filePath, content, indexEol(staged));
  stageQueue = stageQueue.then(() => repoStore.run(label, write, { repoPath: repoRoot, refresh: "status" }));
}

/**
 * Revert (`reverse`) or Apply one change between `revisions` in the work tree file. Revert asks first, as it
 * takes lines out; both offer Undo.
 */
export async function changeWorkTree(
  revisions: ChangeRevisions,
  selection: LineSelection,
  reverse: boolean,
): Promise<void> {
  const { repoRoot, filePath, origPath, oldRevision, newRevision } = revisions;
  const fileName = filePath.split("/").pop() ?? filePath;
  if (reverse) {
    const confirmed = await dialogs.confirm({
      title: "Revert Change",
      message: `Revert this change in ${fileName}? Its lines go back to the older version in your working tree.`,
      confirmLabel: "Revert",
      danger: true,
    });
    if (!confirmed) {
      return;
    }
  }
  const outcome = await repoStore.run(
    reverse ? "Revert change" : "Apply change",
    (repoPath) => api.applyRevisionLines(repoPath, filePath, origPath, oldRevision, newRevision, selection, reverse),
    { repoPath: repoRoot },
  );
  const patch = outcome?.patch;
  if (!outcome || !patch) {
    return;
  }
  const done = reverse ? "Reverted" : "Applied";
  toast.successWithAction(`${done} ${linesText(outcome.lines)}`, fileName, {
    label: "Undo",
    run: () => {
      void repoStore.run(
        `Undo ${done.toLowerCase()} change`,
        (repoPath) => api.restoreDiscardedLines(repoPath, patch, !reverse),
        {
          repoPath: repoRoot,
          success: reverse ? "Restored the reverted lines" : "Took the applied lines back out",
        },
      );
    },
  });
}
