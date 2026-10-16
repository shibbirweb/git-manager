// Loads what CommitDetails.svelte shows: the commit's details and the diff of its selected file. Each load has a
// token, so an answer for a commit or file the user already left is dropped; the diff on screen stays while the
// next one loads, so switching files does not flicker.
import { api, errorMessage } from "$lib/api";
import type { PreviewSides } from "$lib/diff/binaryPreview";
import type { CommitDetails, FileDiff } from "$lib/types";
import { parentRevision } from "$lib/views/files/previewSource";
import { type CommitFileRow, commitFileRows, fileRowAt, type MergeView, parentLabel, pickFileRow } from "./commitFiles";

type FileRow = Extract<CommitFileRow, { kind: "file" }>;

export interface ShownDiff {
  key: string;
  path: string;
  label: string;
  /** "Parent", or "Parent 2" for a merge's second parent. */
  parentLabel: string;
  diff: FileDiff;
  /** Where a binary image or PDF comes from: the parent (none for a root commit) and the commit. */
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
  /** A merge lists the files changed on both sides, or every parent's changes. */
  mergeView = $state<MergeView>("merged");
  /** The selected row's key (`fileRowKey`). */
  selectedKey = $state<string | null>(null);
  readonly rows = $derived(this.details ? commitFileRows(this.details, this.mergeView) : []);
  readonly selectedRow = $derived(fileRowAt(this.rows, this.selectedKey));
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
      const preferredPath = want && want.commitId === commitId ? want.path : null;
      this.selectedKey = pickFileRow(commitFileRows(result, this.mergeView), this.selectedKey, preferredPath);
    } catch (error) {
      if (token !== this.#detailsToken) {
        return;
      }
      this.details = null;
      this.shown = null;
      this.selectedKey = null;
      this.detailsError = errorMessage(error);
    }
  }

  /** Selects the first row of the file at `filePath` (its new or old name) if it is listed. */
  selectPath(filePath: string): void {
    const row = this.rows.find(
      (candidate) =>
        candidate.kind === "file" && (candidate.file.path === filePath || candidate.file.origPath === filePath),
    );
    if (row && row.key !== this.selectedKey) {
      this.selectedKey = row.key;
    }
  }

  setMergeView(view: MergeView): void {
    this.mergeView = view;
    this.selectedKey = pickFileRow(this.rows, this.selectedKey, null);
  }

  async loadDiff(repoPath: string, commitId: string, row: FileRow): Promise<void> {
    const { file, parentIndex } = row;
    const token = ++this.#diffToken;
    this.diffLoading = true;
    this.diffError = null;
    try {
      const result = await api.getCommitFileDiff(repoPath, commitId, file.path, file.origPath ?? null, parentIndex);
      if (token !== this.#diffToken) {
        return;
      }
      // loadDiff runs once these details are loaded; their id is the full one the scheme needs.
      const commitFullId = this.details?.id ?? commitId;
      const parentId = this.details?.parents[parentIndex] ?? null;
      const parent = parentId
        ? {
            kind: "revision" as const,
            repoRoot: repoPath,
            revision: parentIndex === 0 ? parentRevision(commitFullId) : parentId,
            filePath: file.origPath ?? file.path,
          }
        : null;
      this.shown = {
        key: `${commitId}:${row.key}`,
        path: file.path,
        label: commitId.slice(0, 8),
        parentLabel: parentLabel(this.details, parentIndex),
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
