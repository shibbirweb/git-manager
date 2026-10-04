// Local History in the app: which window is open (a file's versions or Recently Deleted),
// the snapshots the editor asks for when a file reloads, and Revert / Restore. The backend
// (local_history/) stores everything; nothing is cached here.

import { api, errorMessage } from "$lib/api";
import { fileCommands } from "$lib/stores/fileCommands.svelte";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import type { Eol } from "$lib/types";
import { toast } from "$lib/ui/toast.svelte";
import { reloadRecords, type ReloadReason } from "./localHistoryModel";

export type LocalHistoryTarget =
  | { kind: "file"; filePath: string; fromDeleted: string[] | null }
  /** Recently Deleted for these folders. */
  | { kind: "deleted"; folderPaths: string[] };

/** How long Revert waits for an editor it opened to load the file. */
const EDITOR_WAIT_MS = 4000;

function fileName(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf("/") + 1);
}

class LocalHistoryStore {
  target = $state.raw<LocalHistoryTarget | null>(null);
  /** Bumped by Clear Local History so an open window reads again. */
  version = $state(0);

  get isOpen(): boolean {
    return this.target !== null;
  }

  openFile(filePath: string, fromDeleted: string[] | null = null): void {
    this.target = { kind: "file", filePath, fromDeleted };
  }

  openDeleted(folderPaths: string[] = (repoStore.workspace?.folders ?? []).map((folder) => folder.root)): void {
    if (folderPaths.length > 0) {
      this.target = { kind: "deleted", folderPaths };
    }
  }

  close(): void {
    this.target = null;
  }

  /** Settings > Editor > Local History, sent to the backend (which prunes once when switched on). */
  configure(enabled: boolean, maxDays: number, maxSizeMb: number): void {
    api.localHistoryConfigure(enabled, maxDays, maxSizeMb).catch(() => undefined);
  }

  /** An open file is about to take the text on disk (see reloadRecords). One call, in the background. */
  noteReload(filePath: string, previousText: string, eol: Eol, reason: ReloadReason): void {
    if (!settings.localHistoryEnabled) {
      return;
    }
    api.localHistoryRecord(reloadRecords(filePath, previousText, eol, reason)).catch(() => undefined);
  }

  /**
   * Puts a version's text in the file's editor as one change, so Undo takes it back. Opens the
   * file first when no editor shows it. True when the editor took it.
   */
  async revert(filePath: string, text: string): Promise<boolean> {
    if (!fileCommands.text(filePath)) {
      await repoStore.openFile(filePath, { pin: true });
      if (!(await this.waitForEditor(filePath))) {
        toast.error("Could not open the file", "Open it, then try Revert again.");
        return false;
      }
    } else {
      await repoStore.openFile(filePath, { pin: true });
    }
    const replaced = fileCommands.replaceText(filePath, text);
    if (!replaced) {
      toast.error("This file cannot be edited here");
      return false;
    }
    toast.success(`Reverted ${fileName(filePath)}`, "Save to keep it, or Undo to go back.");
    return true;
  }

  private async waitForEditor(filePath: string): Promise<boolean> {
    const started = Date.now();
    while (Date.now() - started < EDITOR_WAIT_MS) {
      if (fileCommands.text(filePath) !== null) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  }

  /** Restore Deleted File: writes the version back and offers to open it. */
  async restore(filePath: string, snapshotHash: string): Promise<boolean> {
    try {
      await api.localHistoryRestore(filePath, snapshotHash);
    } catch (error) {
      toast.error("Could not restore the file", errorMessage(error));
      return false;
    }
    toast.successWithAction(`Restored ${fileName(filePath)}`, undefined, {
      label: "Open",
      run: () => void repoStore.openFile(filePath, { pin: true }),
      // Opening is harmless at any time, so the notification list keeps offering it.
      valid: () => repoStore.workspace !== null,
    });
    return true;
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied this version");
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  async clear(): Promise<boolean> {
    try {
      await api.localHistoryClear();
    } catch (error) {
      toast.error("Could not clear Local History", errorMessage(error));
      return false;
    }
    this.version++;
    toast.success("Local History cleared");
    return true;
  }
}

export const localHistory = new LocalHistoryStore();
