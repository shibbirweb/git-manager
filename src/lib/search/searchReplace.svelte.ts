// Replace in Files from Search Everywhere's Text tab: Replace All (every file) or one file's Replace counts the
// matches first, asks, then writes in the backend. Files open with unsaved edits are never written; a Stop during
// the count drops it, a write already started finishes and reports.
import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { ReplaceOutcome, ReplaceRequest, TextSearchOptions } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { nothingToReplace, replaceConfirm, replaceSummary } from "./replaceModel";
import { nextSearchId } from "./textSearchModel";

export interface ReplaceInput {
  roots: string[];
  query: string;
  options: TextSearchOptions;
  replacement: string;
}

export class SearchReplace {
  /** A Replace All on its way: counting for the confirmation, or writing the files. */
  replacing = $state<"counting" | "writing" | null>(null);
  #replaceId = 0;

  /** `done` runs after a write (search again), `back` when the user said no (focus the Replace field). */
  constructor(
    private readonly closed: () => boolean,
    private readonly done: () => void,
    private readonly back: () => void,
  ) {}

  cancel(): void {
    this.#replaceId = nextSearchId();
    this.replacing = null;
    void api.replaceInFilesCancel(this.#replaceId).catch(() => {});
  }

  /** Replace All (`filePaths` null) or the matches of some files; pressed again while running, it stops. */
  async run(input: ReplaceInput, filePaths: string[] | null): Promise<void> {
    if (this.replacing !== null) {
      this.cancel();
      return;
    }
    const request: ReplaceRequest = {
      query: input.query,
      options: { ...input.options },
      replacement: input.replacement,
      filePaths,
      skipPaths: repoStore.dirtyPaths,
      preview: true,
    };
    const previewId = nextSearchId();
    this.#replaceId = previewId;
    this.replacing = "counting";
    const preview = await this.#call(input.roots, previewId, request);
    if (!preview || this.#replaceId !== previewId || preview.cancelled) {
      return;
    }
    this.replacing = null;
    const question = replaceConfirm(preview, request.replacement);
    if (!question) {
      toast.info("Nothing to replace", nothingToReplace(preview));
      return;
    }
    const ok = await dialogs.confirm({ ...question, danger: true });
    if (this.#replaceId !== previewId || this.replacing !== null) {
      return;
    }
    if (!ok || this.closed()) {
      this.back();
      return;
    }
    const writeId = nextSearchId();
    this.#replaceId = writeId;
    this.replacing = "writing";
    const written = await this.#call(input.roots, writeId, {
      ...request,
      skipPaths: repoStore.dirtyPaths,
      preview: false,
    });
    if (this.#replaceId === writeId) {
      this.replacing = null;
    }
    if (written) {
      this.#report(written);
    }
  }

  async #call(roots: string[], id: number, request: ReplaceRequest): Promise<ReplaceOutcome | null> {
    try {
      return await api.replaceInFiles(roots, id, request);
    } catch (cause) {
      if (this.#replaceId === id) {
        this.replacing = null;
      }
      toast.error("Replace failed", errorMessage(cause));
      return null;
    }
  }

  /** Reported even after a Stop: the files written so far stay written. */
  #report(written: ReplaceOutcome): void {
    const summary = replaceSummary(written);
    if (summary.kind === "error") {
      toast.error(summary.title, summary.detail);
    } else {
      toast.success(summary.title, summary.detail);
    }
    if (written.files.length > 0) {
      void repoStore.filesWritten(written.files.map((replaced) => replaced.path));
    }
    if (!this.closed()) {
      this.done();
    }
  }
}
