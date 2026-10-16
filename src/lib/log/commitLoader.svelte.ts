// Loads what CommitDetails.svelte shows: the commit's details and the diff of its selected file. Each load has a
// token, so an answer for a commit or file the user already left is dropped; the diff on screen stays while the
// next one loads, so switching files does not flicker.
import { api, errorMessage } from "$lib/api";
import type { PreviewSides } from "$lib/diff/binaryPreview";
import type { ChangedFile, CommitDetails, FileDiff } from "$lib/types";
import { parentRevision } from "$lib/views/files/previewSource";

export interface ShownDiff {
  key: string;
  path: string;
  label: string;
  diff: FileDiff;
  /** Where a binary image or PDF comes from: the first parent (none for a root commit) and the commit. */
  previewSides: PreviewSides;
}

/** The file to open when a commit loads (from blame, or Back and Forward). */
export interface PreferredFile {
  commitId: string;
  path: string;
}

export class CommitLoader {
  details = $state<CommitDetails | null>(null);
  detailsError = $state<string | null>(null);
  selectedPath = $state<string | null>(null);
  shown = $state.raw<ShownDiff | null>(null);
  diffError = $state<string | null>(null);
  diffLoading = $state(false);
  #detailsToken = 0;
  #diffToken = 0;

  async loadDetails(repoPath: string, commitId: string, preferredFile: () => PreferredFile | null): Promise<void> {
    const token = ++this.#detailsToken;
    this.detailsError = null;
    try {
      const result = await api.getCommitDetails(repoPath, commitId);
      if (token !== this.#detailsToken) {
        return;
      }
      this.details = result;
      const want = preferredFile();
      const preferred =
        want && want.commitId === commitId
          ? result.files.find((file) => file.path === want.path || file.origPath === want.path)
          : undefined;
      const keep = result.files.some((file) => file.path === this.selectedPath);
      if (preferred) {
        this.selectedPath = preferred.path;
      } else if (!keep) {
        this.selectedPath = result.files[0]?.path ?? null;
      }
    } catch (error) {
      if (token !== this.#detailsToken) {
        return;
      }
      this.details = null;
      this.shown = null;
      this.selectedPath = null;
      this.detailsError = errorMessage(error);
    }
  }

  async loadDiff(repoPath: string, commitId: string, file: ChangedFile): Promise<void> {
    const token = ++this.#diffToken;
    this.diffLoading = true;
    this.diffError = null;
    try {
      const result = await api.getCommitFileDiff(repoPath, commitId, file.path, file.origPath ?? null);
      if (token !== this.#diffToken) {
        return;
      }
      // loadDiff runs once these details are loaded; their id is the full one the scheme needs.
      const commitFullId = this.details?.id ?? commitId;
      const hasParent = (this.details?.parents.length ?? 0) > 0;
      const parent = hasParent
        ? {
            kind: "revision" as const,
            repoRoot: repoPath,
            revision: parentRevision(commitFullId),
            filePath: file.origPath ?? file.path,
          }
        : null;
      this.shown = {
        key: `${commitId}:${file.path}`,
        path: file.path,
        label: commitId.slice(0, 8),
        diff: result,
        previewSides: {
          original: parent,
          modified: { kind: "revision", repoRoot: repoPath, revision: commitFullId, filePath: file.path },
        },
      };
    } catch (error) {
      if (token !== this.#diffToken) {
        return;
      }
      this.shown = null;
      this.diffError = errorMessage(error);
    } finally {
      if (token === this.#diffToken) {
        this.diffLoading = false;
      }
    }
  }

  /** No file is selected: nothing to show. */
  clearDiff(): void {
    this.shown = null;
    this.diffError = null;
    this.diffLoading = false;
  }
}
