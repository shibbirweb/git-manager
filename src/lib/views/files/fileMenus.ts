// File > Revert, Resolve in Merge Tool and Copy Path for a file editor; the first two ask first when unsaved edits
// would be lost.
import { errorMessage } from "$lib/api";
import { relativeTo } from "$lib/stores/workspacePaths";
import { dialogs } from "$lib/ui/dialog.svelte";
import { localHistory } from "$lib/localHistory/localHistory.svelte";
import { repoStore } from "$lib/stores/repo.svelte";
import { toast } from "$lib/ui/toast.svelte";
import type { FileEditor } from "./fileEditor.svelte";
import type { FileTone } from "./tones";

export interface FileMenuState {
  dirty: () => boolean;
  tone: () => FileTone | null;
  /** Reads the file again; quiet for a refresh. */
  reload: (quiet: boolean) => Promise<void>;
}

export function fileMenus(editor: FileEditor, state: FileMenuState) {
  const filePath = editor.ctx.filePath;
  const name = filePath.split("/").pop() ?? filePath;

  async function revert(): Promise<void> {
    if (state.dirty()) {
      const ok = await dialogs.confirm({
        title: "Revert File",
        message: `Discard your unsaved changes to ${name}?`,
        confirmLabel: "Discard",
        danger: true,
      });
      if (!ok) {
        return;
      }
      // Local History keeps the edits being thrown away.
      if (editor.view && editor.file) {
        localHistory.noteReload(filePath, editor.view.state.doc.toString(), editor.file.eol, "revert");
      }
    }
    repoStore.setDirty(filePath, false);
    await state.reload(false);
  }

  async function openMergeTool(): Promise<void> {
    if (state.tone() !== "conflict") {
      toast.info("Git does not list this file as conflicted", "Resolve the markers here, then save.");
      return;
    }
    if (state.dirty()) {
      const ok = await dialogs.confirm({
        title: "Open Merge Tool",
        message: "The merge tool starts from git's versions of the file, so your unsaved edits here will be discarded.",
        confirmLabel: "Discard and Open",
        danger: true,
      });
      if (!ok) {
        return;
      }
      repoStore.setDirty(filePath, false);
    }
    const location = editor.ctx.location();
    if (location) {
      void repoStore.openMerge(location.repoPath, location.repo.root);
    }
  }

  /** The path inside its workspace folder. */
  async function copyPath(): Promise<void> {
    const folder = editor.ctx.folder();
    try {
      await navigator.clipboard.writeText(folder ? relativeTo(folder.root, filePath) : filePath);
      toast.success("Copied relative path");
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  return { revert, openMergeTool, copyPath };
}
