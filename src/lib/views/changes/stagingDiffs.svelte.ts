// The Changes diff's staging view, like JetBrains IDEs: HEAD | the index | the work tree. Loads both diffs of the
// selected file (HEAD against the index, the index against the work tree) and offers them the way the 3-pane diff
// takes them: each side pane against the index in the middle.
import { api, errorMessage } from "$lib/api";
import { flipHunks } from "$lib/diff/threeWay";
import type { FileDiff, FileStatus } from "$lib/types";

/** A file the staging view can show: a plain modified file in the index, the work tree or both. */
export function stagingViewFits(file: FileStatus | null): boolean {
  if (!file || file.conflicted || file.submodule) {
    return false;
  }
  return [file.staged, file.unstaged].every((kind) => kind === null || kind === "modified");
}

/** The index against the work tree, seen from the work tree: the right pane against the middle. */
export function workTreeSide(unstaged: FileDiff): FileDiff {
  return {
    ...unstaged,
    original: unstaged.modified,
    modified: unstaged.original,
    originalEol: unstaged.modifiedEol,
    modifiedEol: unstaged.originalEol,
    hunks: unstaged.hunks ? flipHunks(unstaged.hunks) : undefined,
  };
}

function textual(diff: FileDiff): boolean {
  return !diff.binary && !diff.tooLarge && !diff.lfs;
}

/** The same texts: the shown diff stays, so a status refresh does not rebuild the panes. */
function sameTexts(shown: FileDiff | null, next: FileDiff): boolean {
  return shown !== null && shown.original === next.original && shown.modified === next.modified;
}

export class StagingDiffs {
  /** HEAD (left) against the index (middle). */
  staged = $state.raw<FileDiff | null>(null);
  /** The work tree (right) against the index (middle). */
  workTree = $state.raw<FileDiff | null>(null);
  /** Which file the diffs belong to. */
  key = $state<string | null>(null);
  error = $state<string | null>(null);
  #token = 0;

  async load(repoRoot: string, filePath: string): Promise<void> {
    const token = ++this.#token;
    try {
      const [staged, unstaged] = await Promise.all([
        api.getFileDiff(repoRoot, filePath, null, "staged"),
        api.getFileDiff(repoRoot, filePath, null, "unstaged"),
      ]);
      if (token !== this.#token) {
        return;
      }
      if (!textual(staged) || !textual(unstaged)) {
        this.clear();
        return;
      }
      const workTree = workTreeSide(unstaged);
      if (!sameTexts(this.staged, staged)) {
        this.staged = staged;
      }
      if (!sameTexts(this.workTree, workTree)) {
        this.workTree = workTree;
      }
      this.key = `${repoRoot}\u0000${filePath}`;
      this.error = null;
    } catch (error) {
      if (token === this.#token) {
        this.clear();
        this.error = errorMessage(error);
      }
    }
  }

  clear(): void {
    this.#token++;
    this.staged = null;
    this.workTree = null;
    this.key = null;
  }
}
