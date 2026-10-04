// Recent Files (JetBrains' Cmd+E): the open workspace's list, kept in state.json by
// stores/recentFiles.ts, and whether the popup (RecentFiles.svelte) shows. The list follows
// the editor: the tab on screen moves to the top, a file with unsaved edits counts as edited.
// With Settings > Editor > Recent Files off, nothing is followed and the list stays empty;
// the saved lists are kept for when it is turned on again.

import { untrack } from "svelte";
import { type RecentFile, markEdited, removeRecent, touchRecent } from "$lib/stores/recentFiles";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { folderFor } from "$lib/stores/workspacePaths";

class RecentFilesStore {
  /** The open workspace's files, most recent first. */
  files = $state.raw<readonly RecentFile[]>([]);
  /** The popup shows. */
  isOpen = $state(false);
  private workspaceId: string | null = null;
  private previousFocus: HTMLElement | null = null;

  /** Follows the open workspace and its editor; call once from the workspace's component. */
  follow(): void {
    $effect(() => {
      const workspaceId = settings.recentFiles ? (repoStore.workspace?.id ?? null) : null;
      untrack(() => this.load(workspaceId));
    });
    $effect(() => {
      const filePath = settings.recentFiles ? repoStore.openFilePath : null;
      untrack(() => {
        if (filePath !== null && this.inWorkspace(filePath)) {
          this.update(touchRecent(this.files, filePath));
        }
      });
    });
    $effect(() => {
      const dirtyPaths = settings.recentFiles ? repoStore.dirtyPaths : [];
      untrack(() => {
        let next = this.files;
        for (const filePath of dirtyPaths) {
          if (this.inWorkspace(filePath)) {
            next = markEdited(next, filePath);
          }
        }
        this.update(next);
      });
    });
  }

  /** The files, most recent first (Quick Open and Search Everywhere list them too). */
  filePaths(): string[] {
    return this.files.map((file) => file.filePath);
  }

  /** Takes the file off the list (Delete in the popup, or a file that is gone). */
  remove(filePath: string): void {
    this.update(removeRecent(this.files, filePath));
  }

  open(): void {
    const active = typeof document === "undefined" ? null : document.activeElement;
    this.previousFocus = active instanceof HTMLElement ? active : null;
    this.isOpen = true;
    // The popup loads on first use: keys typed meanwhile must not reach the editor.
    this.previousFocus?.blur();
  }

  close(): void {
    this.isOpen = false;
  }

  /** Gives the focus back to what had it before the popup opened. */
  restoreFocus(): void {
    const focus = this.previousFocus;
    this.previousFocus = null;
    if (focus?.isConnected) {
      focus.focus();
    }
  }

  /** Forgets the captured focus, so a removed element is not kept alive. */
  release(): void {
    if (!this.isOpen) {
      this.previousFocus = null;
    }
  }

  private load(workspaceId: string | null): void {
    this.workspaceId = workspaceId;
    this.files = workspaceId === null ? [] : (settings.recentFileLists[workspaceId] ?? []);
    this.isOpen = false;
  }

  /** A file of another workspace (a tab left from the last one) never joins this list. */
  private inWorkspace(filePath: string): boolean {
    return folderFor(repoStore.workspace?.folders ?? [], filePath) !== null;
  }

  private update(next: readonly RecentFile[]): void {
    if (next === this.files) {
      return;
    }
    this.files = next;
    if (this.workspaceId !== null) {
      settings.rememberRecentFiles(this.workspaceId, next);
    }
  }
}

export const recentFilesStore = new RecentFilesStore();
