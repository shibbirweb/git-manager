// What a file editor follows while its tab is open: changes on disk, Back / Forward to a line in it, the status
// bar while it is the active tab, and auto save when the focus leaves it. Call it while the component starts.
import { untrack } from "svelte";
import { sharedDocs } from "$lib/editor/sharedDocs";
import { navigation } from "$lib/stores/navigation.svelte";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import type { RepoLocation } from "$lib/stores/workspacePaths";
import type { RepoStatus } from "$lib/types";
import type { FileEditor } from "./fileEditor.svelte";
import { revealLine } from "./filePosition";

export interface FileWatch {
  isActive: () => boolean;
  /** The tab is the one its group shows. */
  shown: () => boolean;
  dirty: () => boolean;
  location: () => RepoLocation | null;
  repoStatus: () => RepoStatus | null;
  reload: (quiet: boolean) => void;
  /** Also scroll the preview to a revealed line. */
  reveal: (line: number) => void;
}

export function watchFile(editor: FileEditor, watch: FileWatch): void {
  const filePath = editor.ctx.filePath;
  const groupId = editor.ctx.groupId;

  // Taking over the status bar when this tab becomes visible.
  $effect(() => {
    if (watch.isActive()) {
      untrack(() => editor.reportStatus());
    }
  });

  // Pick up changes made outside the app while there are no local edits.
  let lastStatus: unknown = null;
  let lastFileVersion = 0;
  let lastOpenFileVersion = 0;
  $effect(() => {
    const location = watch.location();
    // Changes in the owning repository, or anywhere in a folder without git.
    const status = location ? watch.repoStatus() : repoStore.workspaceVersion;
    // An unchanged status keeps its object, so a file edited again outside the app shows here instead.
    const fileVersion = location ? (repoStore.fileVersions[location.repo.root] ?? 0) : 0;
    // A file git ignores (a log) has no status: the watcher reports it as an open file.
    const openFileVersion = repoStore.openFileVersions[filePath] ?? 0;
    const changed = status !== lastStatus || fileVersion !== lastFileVersion || openFileVersion !== lastOpenFileVersion;
    if (lastStatus !== null && changed && !watch.dirty() && !editor.saver.busy) {
      // One editor of a file reads it again; the other follows its text and updates its marks.
      if (sharedDocs.isLeader(filePath, editor.member)) {
        watch.reload(true);
      } else {
        void editor.git.refresh();
      }
    }
    lastStatus = status;
    lastFileVersion = fileVersion;
    lastOpenFileVersion = openFileVersion;
  });

  // Back / Forward to a location in this file while it is already open.
  $effect(() => {
    const request = navigation.reveal;
    if (request && request.filePath === filePath && request.groupId === groupId && editor.view) {
      untrack(() => {
        const taken = navigation.takeReveal(filePath, groupId);
        if (taken && editor.view) {
          if (taken.line !== null) {
            revealLine(editor.view, taken.line, taken.column ?? 0);
            watch.reveal(taken.line);
          }
          editor.view.focus();
        }
      });
    }
  });

  // Leaving this tab for another one is a focus change.
  let wasActive = false;
  $effect(() => {
    const active = watch.shown();
    untrack(() => {
      if (wasActive && !active) {
        void editor.saver.autoSave("focus");
      }
      wasActive = active;
    });
  });

  // So is switching to another app.
  $effect(() => {
    if (settings.autoSave !== "onFocusChange") {
      return;
    }
    const onWindowBlur = () => void editor.saver.autoSave("focus");
    window.addEventListener("blur", onWindowBlur);
    return () => window.removeEventListener("blur", onWindowBlur);
  });
}
