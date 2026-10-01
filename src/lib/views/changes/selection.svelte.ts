// Selected change and its diff, shared by the Changes sidebar (which picks a
// file) and the Diff view in the main area (which shows it). Kept at module
// level so hiding the sidebar keeps the selection.

import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { FileDiff, RepoStatus } from "$lib/types";
import { type FileSelection, sameSelection } from "./fileStatus";
import { changesLayout } from "./layout.svelte";
import { buildSections, findFile, resolveSelection, selectableRows } from "./sections";

/** Avoids rebuilding the diff editors when a refresh returns identical content. */
function sameDiff(current: FileDiff | null, next: FileDiff): boolean {
  return (
    current !== null &&
    current.path === next.path &&
    current.binary === next.binary &&
    current.tooLarge === next.tooLarge &&
    current.originalEol === next.originalEol &&
    current.modifiedEol === next.modifiedEol &&
    current.original === next.original &&
    current.modified === next.modified
  );
}

class ChangesSelection {
  selected = $state<FileSelection | null>(null);
  diff = $state.raw<FileDiff | null>(null);
  diffError = $state<string | null>(null);

  private loadToken = 0;
  private lastIndex = 0;
  /** Status the current diff was loaded against; a new status object means reload. */
  private diffStatus: RepoStatus | null = null;
  private stageQueue: Promise<unknown> = Promise.resolve();

  private sections() {
    return buildSections(repoStore.repos, repoStore.statuses);
  }

  /**
   * Keeps the selection valid and its diff fresh; call whenever statuses change.
   * Nothing is selected until the user picks a file, so a closed Diff tab stays closed.
   */
  sync(): void {
    if (!this.selected) {
      return;
    }
    const sections = this.sections();
    const allRows = selectableRows(sections.filter((section) => section.changeCount > 0));
    const next = resolveSelection(this.selected, sections, allRows, this.lastIndex);
    if (next && sameSelection(next, this.selected)) {
      if ((repoStore.statuses[next.repoRoot] ?? null) !== this.diffStatus) {
        void this.loadDiff(next);
      }
      return;
    }
    this.select(next);
  }

  select(selection: FileSelection | null): void {
    const changedSelection = !sameSelection(selection, this.selected);
    this.selected = selection;
    if (!selection) {
      this.loadToken++;
      this.diff = null;
      this.diffError = null;
      this.diffStatus = null;
      return;
    }
    const sections = this.sections();
    const allRows = selectableRows(sections.filter((section) => section.changeCount > 0));
    this.lastIndex = Math.max(
      0,
      allRows.findIndex((row) => sameSelection(row, selection)),
    );
    if (changedSelection) {
      this.diff = null;
      this.diffError = null;
    }
    void this.loadDiff(selection);
  }

  /** A file picked by the user: select it and show the Diff view. */
  pick(selection: FileSelection): void {
    changesLayout.focusRepo(selection.repoRoot);
    this.select(selection);
    if (repoStore.view !== "diff") {
      repoStore.view = "diff";
    }
  }

  private async loadDiff(selection: FileSelection): Promise<void> {
    const file = findFile(this.sections(), selection);
    if (!file) {
      return;
    }
    const repoRoot = selection.repoRoot;
    this.diffStatus = repoStore.statuses[repoRoot] ?? null;
    const token = ++this.loadToken;
    const origPath = selection.area === "staged" ? (file.origPath ?? null) : null;
    try {
      const result = await api.getFileDiff(repoRoot, selection.path, origPath, selection.area);
      if (token !== this.loadToken) {
        return;
      }
      if (!sameDiff(this.diff, result)) {
        this.diff = result;
      }
      this.diffError = null;
    } catch (error) {
      if (token !== this.loadToken) {
        return;
      }
      this.diff = null;
      this.diffError = errorMessage(error);
    }
  }

  /** Hunk staging from the Diff view writes the new side into the index. */
  applyDiffChange(target: "original" | "modified", content: string): void {
    const selection = this.selected;
    const currentDiff = this.diff;
    if (!selection || !currentDiff) {
      return;
    }
    // A side that did not exist has no EOL of its own; follow the other side.
    const eol =
      target === "original"
        ? currentDiff.original === ""
          ? currentDiff.modifiedEol
          : currentDiff.originalEol
        : currentDiff.modified === ""
          ? currentDiff.originalEol
          : currentDiff.modifiedEol;
    const repoRoot = selection.repoRoot;
    const filePath = selection.path;
    const label = target === "original" ? "Stage change" : "Unstage change";
    changesLayout.focusRepo(repoRoot);
    // Serialized so rapid clicks reach the index in order.
    this.stageQueue = this.stageQueue.then(() =>
      repoStore.run(label, (repoPath) => api.stageContent(repoPath, filePath, content, eol), { repoPath: repoRoot }),
    );
  }

  /**
   * The main view actually on screen: the Diff tab exists only while a change
   * is selected and the file tab only while a file is open.
   */
  get shownView(): "diff" | "log" | "file" | "none" {
    if (repoStore.view === "diff" && !this.selected) {
      return repoStore.openFilePath ? "file" : "none";
    }
    if (repoStore.view === "file" && !repoStore.openFilePath) {
      return this.selected ? "diff" : "none";
    }
    return repoStore.view;
  }

  /** Where to go when the Log is hidden: the diff, the open file, or nothing. */
  private fallbackView(): "diff" | "file" | "none" {
    if (this.lastView === "diff" && this.selected) {
      return "diff";
    }
    if (this.lastView === "file" && repoStore.openFilePath) {
      return "file";
    }
    if (this.selected) {
      return "diff";
    }
    return repoStore.openFilePath ? "file" : "none";
  }

  private lastView: "diff" | "file" | "none" = "none";

  /** Activity bar / Shift+Cmd+L: show the Log, or hide it and go back. */
  toggleLog(): void {
    const current = this.shownView;
    if (current === "log") {
      repoStore.view = this.fallbackView();
      return;
    }
    this.lastView = current;
    repoStore.view = "log";
  }

  /** Closes the Diff tab. */
  close(): void {
    this.select(null);
    if (repoStore.view === "diff") {
      repoStore.view = repoStore.openFilePath ? "file" : "none";
    }
  }

  reset(): void {
    this.select(null);
    this.lastIndex = 0;
  }
}

export const changesSelection = new ChangesSelection();
