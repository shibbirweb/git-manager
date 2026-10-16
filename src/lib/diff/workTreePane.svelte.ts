// The third pane of a commit's (or a compare's) diff: the work tree file against the newer version in the middle,
// so a change can be seen next to the code you have now and taken out of it or into it.
import { api, errorMessage } from "$lib/api";
import type { FileDiff } from "$lib/types";
import { workTreeSide } from "$lib/views/changes/stagingDiffs.svelte";
import { textual } from "./diffSource";

/**
 * The right pane against the middle, whose text must be the left diff's newer side exactly; when the backend read
 * it differently (line endings), the hunks are found again against the middle on screen.
 */
export function rightAgainstMiddle(workTree: FileDiff, middle: string): FileDiff {
  return workTree.modified === middle ? workTree : { ...workTree, modified: middle, hunks: undefined };
}

export class WorkTreePane {
  /** The work tree (original) against the newer revision (modified). */
  side = $state.raw<FileDiff | null>(null);
  /** Which file and revision the pane belongs to. */
  key = $state<string | null>(null);
  error = $state<string | null>(null);
  #token = 0;

  async load(repoRoot: string, filePath: string, revision: string, middle: string): Promise<void> {
    const token = ++this.#token;
    try {
      const result = await api.compareWithRevision(repoRoot, filePath, revision);
      if (token !== this.#token) {
        return;
      }
      if (!textual(result.diff)) {
        this.clear();
        return;
      }
      const next = rightAgainstMiddle(workTreeSide(result.diff), middle);
      // The same texts keep the panes, so a status refresh does not rebuild them.
      const shown = this.side;
      if (!shown || shown.original !== next.original || shown.modified !== next.modified) {
        this.side = next;
      }
      this.key = `${repoRoot}\u0000${filePath}\u0000${revision}`;
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
    this.side = null;
    this.key = null;
  }
}
