// Global Back / Forward navigation between file locations and Log commits (see navHistory.ts).

import { api } from "$lib/api";
import { changesSelection } from "$lib/views/changes/selection.svelte";
import { buildSections, findFile } from "$lib/views/changes/sections";
import { toast } from "$lib/ui/toast.svelte";
import {
  type DiffLocation,
  isMissingFileError,
  type LogLocation,
  type NavLocation,
  NavigationHistory,
  type StopOutcome,
} from "./navHistory";
import { repoStore } from "./repo.svelte";
import { folderFor, relativeTo } from "./workspacePaths";

export interface RevealRequest {
  filePath: string;
  line: number;
  token: number;
}

class NavigationStore {
  canGoBack = $state(false);
  canGoForward = $state(false);
  /** Location the file editor should move to (set by Back / Forward). */
  reveal = $state<RevealRequest | null>(null);
  /** Line the Changes diff should scroll to after Back / Forward. */
  diffReveal = $state<(Omit<DiffLocation, "kind"> & { token: number }) | null>(null);

  private history = new NavigationHistory();
  private token = 0;
  private traveling = false;

  private sync(): void {
    this.canGoBack = this.history.back.length > 0;
    this.canGoForward = this.history.forward.length > 0;
  }

  /** Called by editors and the Changes list whenever the user settles somewhere. */
  record(location: NavLocation): void {
    this.history.record(location);
    this.sync();
  }

  /**
   * Jumps to a commit in the Log (e.g. from blame), recording `from` first so
   * Back returns to exactly where the jump started.
   */
  async openCommit(target: Omit<LogLocation, "kind">, from: NavLocation | null): Promise<void> {
    if (from) {
      this.history.record(from);
    }
    this.history.record({ kind: "log", ...target });
    this.sync();
    await repoStore.showCommit(target.repoRoot, target.commitId, target.filePath, target.line ?? null, target.lineText ?? null);
  }

  async goBack(): Promise<void> {
    await this.travel("back");
  }

  async goForward(): Promise<void> {
    await this.travel("forward");
  }

  /** One step back or forward; stops that no longer exist are dropped and skipped. */
  private async travel(direction: "back" | "forward"): Promise<void> {
    // A step can wait on the backend; overlapping steps would undo each other.
    if (this.traveling) {
      return;
    }
    this.traveling = true;
    let skipped = false;
    let shown: NavLocation | null = null;
    try {
      shown = await this.history.travel(direction, async (target) => {
        const outcome = await this.go(target);
        skipped = skipped || outcome === "gone";
        return outcome;
      });
    } finally {
      this.traveling = false;
    }
    this.sync();
    if (!shown && skipped) {
      toast.info(direction === "back" ? "Nothing left to go back to" : "Nothing left to go forward to", "Those places no longer exist.");
    }
  }

  private async go(target: NavLocation): Promise<StopOutcome> {
    if (target.kind === "log") {
      if (!repoStore.repos.some((repo) => repo.root === target.repoRoot)) {
        return "gone";
      }
      await repoStore.showCommit(target.repoRoot, target.commitId, target.filePath, target.line ?? null, target.lineText ?? null);
      // Not on the Log: the switch was cancelled (e.g. unsaved changes kept).
      return repoStore.view === "log" && repoStore.repo?.root === target.repoRoot ? "shown" : "cancelled";
    }
    if (target.kind === "diff") {
      const selection = { repoRoot: target.repoRoot, path: target.path, area: target.area };
      if (!findFile(buildSections(repoStore.repos, repoStore.statuses), selection)) {
        return "gone";
      }
      this.diffReveal = { ...selection, line: target.line, token: ++this.token };
      changesSelection.pick(selection);
      return "shown";
    }
    if (!(await this.fileExists(target.filePath))) {
      return "gone";
    }
    this.reveal = { filePath: target.filePath, line: target.line, token: ++this.token };
    await repoStore.openFile(target.filePath);
    const opened = repoStore.openFilePath === target.filePath;
    if (!opened) {
      this.reveal = null;
    }
    return opened ? "shown" : "cancelled";
  }

  /**
   * Whether a file stop can still be opened. An open tab watches its own file
   * (and calls `forget` when it disappears); other files are read once.
   */
  private async fileExists(filePath: string): Promise<boolean> {
    if (repoStore.tabs.some((tab) => tab.path === filePath)) {
      return true;
    }
    const folder = folderFor(repoStore.workspace?.folders ?? [], filePath);
    if (!folder) {
      return false;
    }
    try {
      await api.readWorktreeFile(folder.root, relativeTo(folder.root, filePath));
      return true;
    } catch (error) {
      // Other errors (e.g. permissions) are shown by the tab itself.
      return !isMissingFileError(error);
    }
  }

  /** The editor applied a reveal request; returns it when it targets `filePath`. */
  takeReveal(filePath: string): RevealRequest | null {
    const request = this.reveal;
    if (!request || request.filePath !== filePath) {
      return null;
    }
    this.reveal = null;
    return request;
  }

  /** The diff view applied a reveal request; returns it when it targets that selection. */
  takeDiffReveal(repoRoot: string, path: string, area: string): { line: number; token: number } | null {
    const request = this.diffReveal;
    if (!request || request.repoRoot !== repoRoot || request.path !== path || request.area !== area) {
      return null;
    }
    this.diffReveal = null;
    return { line: request.line, token: request.token };
  }

  /** Drops the Back / Forward stops of a file that no longer exists. */
  forget(filePath: string): void {
    this.history.forget(filePath);
    this.sync();
  }

  clear(): void {
    this.history.clear();
    this.reveal = null;
    this.sync();
  }
}

export const navigation = new NavigationStore();
