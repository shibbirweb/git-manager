// Selected change and its diff, shared by the Changes sidebar (which picks a
// file) and the Diff view in the main area (which shows it). Kept at module
// level so hiding the sidebar keeps the selection.

import { api, errorMessage } from "$lib/api";
import { selectionSize } from "$lib/diff/lineSelection";
import { repoStore } from "$lib/stores/repo.svelte";
import type { FileDiff, LineAction, LineSelection, RepoStatus } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
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

const LINE_LABELS: Record<LineAction, string> = {
  stage: "Stage lines",
  unstage: "Unstage lines",
  discard: "Discard lines",
};

function linesText(count: number): string {
  return count === 1 ? "1 changed line" : `${count} changed lines`;
}

function diffKey(selection: FileSelection, origPath: string | null): string {
  return `${selection.repoRoot}\0${selection.area}\0${selection.path}\0${origPath ?? ""}`;
}

class ChangesSelection {
  selected = $state<FileSelection | null>(null);
  diff = $state.raw<FileDiff | null>(null);
  diffError = $state<string | null>(null);

  private loadToken = 0;
  private lastIndex = 0;
  /** Which file, area and rename the diff on screen belongs to. */
  private diffKey = "";
  /** Status the current diff was loaded against; a new status object means reload. */
  private diffStatus: RepoStatus | null = null;
  /** The repository's file version the diff was loaded at (`repoStore.fileVersions`). */
  private diffFileVersion = 0;
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
      const fileVersion = repoStore.fileVersions[next.repoRoot] ?? 0;
      if ((repoStore.statuses[next.repoRoot] ?? null) !== this.diffStatus || fileVersion !== this.diffFileVersion) {
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
    // Also focuses the first editor group, which shows the Diff tab.
    repoStore.view = "diff";
  }

  private async loadDiff(selection: FileSelection): Promise<void> {
    const file = findFile(this.sections(), selection);
    if (!file) {
      return;
    }
    const repoRoot = selection.repoRoot;
    this.diffStatus = repoStore.statuses[repoRoot] ?? null;
    this.diffFileVersion = repoStore.fileVersions[repoRoot] ?? 0;
    const token = ++this.loadToken;
    const origPath = selection.area === "staged" ? (file.origPath ?? null) : null;
    // The diff on screen is this file's: ask whether it changed instead of reading it again.
    const shown = this.diff;
    const known = shown && shown.path === selection.path && this.diffKey === diffKey(selection, origPath) ? (shown.version ?? null) : null;
    try {
      const result = await api.getFileDiffIfChanged(repoRoot, selection.path, origPath, selection.area, known);
      if (token !== this.loadToken) {
        return;
      }
      if (result && !sameDiff(this.diff, result)) {
        this.diff = result;
      }
      if (result) {
        this.diffKey = diffKey(selection, origPath);
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
      repoStore.run(label, (repoPath) => api.stageContent(repoPath, filePath, content, eol), {
        repoPath: repoRoot,
        refresh: "status",
      }),
    );
  }

  /**
   * Stage, Unstage or Discard Selected Lines from the Diff view. The backend builds and
   * applies the partial patch; Discard asks first and offers Undo for a while after.
   */
  async applyLines(action: LineAction, lineSelection: LineSelection): Promise<void> {
    const selection = this.selected;
    const currentDiff = this.diff;
    const file = selection ? findFile(this.sections(), selection) : null;
    if (!selection || !currentDiff || !file || repoStore.busy !== null) {
      return;
    }
    const repoRoot = selection.repoRoot;
    const filePath = selection.path;
    const fileName = filePath.split("/").pop() ?? filePath;
    const kind = selection.area === "staged" ? file.staged : file.unstaged;
    if (kind === "deleted") {
      await this.applyWholeDeletion(action, repoRoot, filePath, fileName);
      return;
    }
    const count = selectionSize(lineSelection);
    if (action === "discard") {
      const confirmed = await dialogs.confirm({
        title: "Discard Selected Lines",
        message: `Discard ${linesText(count)} in ${fileName}? The work tree goes back to the staged version of these lines.`,
        confirmLabel: "Discard",
        danger: true,
      });
      if (!confirmed) {
        return;
      }
    }
    const origPath = selection.area === "staged" ? (file.origPath ?? null) : null;
    const knownVersion = currentDiff.version ?? null;
    changesLayout.focusRepo(repoRoot);
    const work = (repoPath: string) => api.applySelectedLines(repoPath, filePath, origPath, action, lineSelection, knownVersion);
    // Serialized with hunk staging so quick actions reach the index in order.
    const done = this.stageQueue.then(() => repoStore.run(LINE_LABELS[action], work, { repoPath: repoRoot }));
    this.stageQueue = done;
    const outcome = await done;
    if (action === "discard" && outcome?.patch) {
      const patch = outcome.patch;
      toast.successWithAction(`Discarded ${linesText(outcome.lines)}`, fileName, {
        label: "Undo",
        run: () => {
          void repoStore.run("Undo discard", (repoPath) => api.restoreDiscardedLines(repoPath, patch), {
            repoPath: repoRoot,
            success: "Restored the discarded lines",
          });
        },
      });
    }
  }

  /** A deleted file has no lines to pick: offer the whole file instead. */
  private async applyWholeDeletion(action: LineAction, repoRoot: string, filePath: string, fileName: string): Promise<void> {
    const choices = {
      stage: { title: "Stage Deletion", question: "Stage the deletion of the whole file?", label: "Stage" },
      unstage: { title: "Unstage Deletion", question: "Unstage the deletion of the whole file?", label: "Unstage" },
      discard: { title: "Restore File", question: "Restore the whole file from the staged version?", label: "Restore" },
    };
    const choice = choices[action];
    const confirmed = await dialogs.confirm({
      title: choice.title,
      message: `${fileName} was deleted, so its lines cannot be picked one by one. ${choice.question}`,
      confirmLabel: choice.label,
    });
    if (!confirmed) {
      return;
    }
    const work = (repoPath: string): Promise<void> => {
      if (action === "stage") {
        return api.stageFiles(repoPath, [filePath]);
      }
      if (action === "unstage") {
        return api.unstageFiles(repoPath, [filePath]);
      }
      return api.discardFiles(repoPath, [filePath], []);
    };
    await repoStore.run(choice.title, work, { repoPath: repoRoot });
  }

  /**
   * The main view of the focused editor group: the first group shows the Diff tab, the Log,
   * a file tab or nothing; the other groups always show a tab.
   */
  get shownView(): "diff" | "log" | "file" | "none" {
    if (repoStore.focusedGroupId !== repoStore.primaryGroupId) {
      return repoStore.openFilePath ? "file" : "none";
    }
    return this.primaryView;
  }

  /**
   * What the first editor group actually shows: the Diff tab exists only while a change
   * is selected and the file tab only while a file is open there.
   */
  get primaryView(): "diff" | "log" | "file" | "none" {
    const active = repoStore.primaryActive;
    if (repoStore.view === "diff" && !this.selected) {
      return active ? "file" : "none";
    }
    if (repoStore.view === "file" && !active) {
      return this.selected ? "diff" : "none";
    }
    return repoStore.view;
  }

  /** The Log is on screen (in the first group), whichever group has the focus. */
  get logShown(): boolean {
    return this.primaryView === "log";
  }

  /** `tabPath` is the tab `groupId` shows now. */
  tabShown(groupId: number, tabPath: string): boolean {
    const group = repoStore.groupById(groupId);
    if (!group || group.active !== tabPath) {
      return false;
    }
    return groupId !== repoStore.primaryGroupId || this.primaryView === "file";
  }

  /** Some group shows `tabPath` now. */
  tabOnScreen(tabPath: string): boolean {
    return repoStore.groups.some((group) => this.tabShown(group.id, tabPath));
  }

  /** Where to go when the Log is hidden: the diff, the open file, or nothing. */
  private fallbackView(): "diff" | "file" | "none" {
    const active = repoStore.primaryActive;
    if (this.lastView === "diff" && this.selected) {
      return "diff";
    }
    if (this.lastView === "file" && active) {
      return "file";
    }
    if (this.selected) {
      return "diff";
    }
    return active ? "file" : "none";
  }

  private lastView: "diff" | "file" | "none" = "none";

  /** Activity bar / Shift+Cmd+L: show the Log, or hide it and go back. */
  toggleLog(): void {
    const current = this.primaryView;
    if (current === "log") {
      repoStore.view = this.fallbackView();
      // An empty first group was only kept for the Log.
      repoStore.tidyGroups();
      return;
    }
    this.lastView = current;
    repoStore.view = "log";
  }

  /** Closes the Diff tab. */
  close(): void {
    this.select(null);
    if (repoStore.view === "diff") {
      repoStore.view = repoStore.primaryActive ? "file" : "none";
    }
    repoStore.tidyGroups();
  }

  reset(): void {
    this.select(null);
    this.lastIndex = 0;
  }
}

export const changesSelection = new ChangesSelection();

// A selected change keeps the first editor group open for its Diff tab.
repoStore.setPrimaryContent(() => changesSelection.selected !== null);
