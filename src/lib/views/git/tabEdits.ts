// The Changes tab's edits. Its staging view writes the index pane's text (stage or unstage one change). Its diff
// compares with HEAD, so Revert puts HEAD's lines back in the work tree (the index stays), with Undo.
import { api } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { FileDiff, LineSelection } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { linesText } from "../changes/selection.svelte";
import { indexEol } from "../changes/stagingDiffs.svelte";
import type { ChangesTabFile } from "./changesTab";

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

export async function revertToHead(repoRoot: string, file: ChangesTabFile, selection: LineSelection): Promise<void> {
  const fileName = file.path.split("/").pop() ?? file.path;
  const confirmed = await dialogs.confirm({
    title: "Revert Change",
    message: `Revert this change in ${fileName}? Its lines go back to the last commit.`,
    confirmLabel: "Revert",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  const outcome = await repoStore.run(
    "Revert change",
    (repoPath) => api.applySelectedLines(repoPath, file.path, file.origPath, "revertToHead", selection, null),
    { repoPath: repoRoot },
  );
  const patch = outcome?.patch;
  if (!outcome || !patch) {
    return;
  }
  toast.successWithAction(`Reverted ${linesText(outcome.lines)}`, fileName, {
    label: "Undo",
    run: () => {
      void repoStore.run("Undo revert", (repoPath) => api.restoreDiscardedLines(repoPath, patch), {
        repoPath: repoRoot,
        success: "Restored the reverted lines",
      });
    },
  });
}
