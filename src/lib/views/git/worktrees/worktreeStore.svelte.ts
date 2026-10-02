// The worktrees of the active repository, for the Branches sidebar. Reloaded
// whenever the sidebar sees the active repository's branches change; only the
// list of the active repository is kept.

import { api } from "$lib/api";
import type { WorktreeInfo } from "$lib/types";
import { sortedWorktrees } from "./worktreeModel";

class WorktreeStore {
  /** Repository the list belongs to. */
  repoRoot = $state<string | null>(null);
  list = $state.raw<WorktreeInfo[]>([]);
  private token = 0;

  /** Reads the list of `repoRoot` (null clears it); a newer call wins. */
  async load(repoRoot: string | null): Promise<void> {
    const token = ++this.token;
    if (!repoRoot) {
      this.repoRoot = null;
      this.list = [];
      return;
    }
    // Quiet: a failed list (an old git, say) only hides the section's entries.
    const list = await api.listWorktrees(repoRoot).catch(() => [] as WorktreeInfo[]);
    if (token === this.token) {
      this.repoRoot = repoRoot;
      this.list = sortedWorktrees(list);
    }
  }

  /** The list for `repoRoot`, loaded now when it is not the one held. */
  async listFor(repoRoot: string): Promise<WorktreeInfo[]> {
    if (this.repoRoot === repoRoot) {
      return this.list;
    }
    return sortedWorktrees(await api.listWorktrees(repoRoot).catch(() => [] as WorktreeInfo[]));
  }
}

export const worktreeStore = new WorktreeStore();
