// State of the AI panel: the worktrees of each project and which rows are collapsed. Worktrees are read when the
// panel opens, on Refresh and after the panel changes them; nothing polls.

import { api } from "$lib/api";
import type { WorktreeInfo } from "$lib/types";

class AiStore {
  /** `git worktree list` of each project's repository, by its root; missing until read. */
  worktrees = $state.raw<Record<string, WorktreeInfo[]>>({});
  /** Keys of collapsed rows (see projects.ts); for this session only. */
  collapsed = $state.raw<ReadonlySet<string>>(new Set());
  loading = $state(false);
  private token = 0;
  private repoRoots: readonly string[] = [];

  /** Reads the worktrees of `repoRoots`; a newer call wins. A list that fails to read stays empty. */
  async loadWorktrees(repoRoots: readonly string[]): Promise<void> {
    const token = ++this.token;
    this.repoRoots = repoRoots;
    this.loading = true;
    const lists = await Promise.all(
      repoRoots.map((repoRoot) => api.listWorktrees(repoRoot).catch(() => [] as WorktreeInfo[])),
    );
    if (token !== this.token) {
      return;
    }
    this.worktrees = Object.fromEntries(repoRoots.map((repoRoot, index) => [repoRoot, lists[index] ?? []]));
    this.loading = false;
  }

  /** Reads the same projects' worktrees again, after the panel changed them. */
  reload(): Promise<void> {
    return this.loadWorktrees(this.repoRoots);
  }

  toggle(rowKey: string): void {
    this.setExpanded(rowKey, this.collapsed.has(rowKey));
  }

  setExpanded(rowKey: string, expanded: boolean): void {
    const next = new Set(this.collapsed);
    if (expanded) {
      next.delete(rowKey);
    } else {
      next.add(rowKey);
    }
    this.collapsed = next;
  }

  collapseAll(rowKeys: readonly string[]): void {
    this.collapsed = new Set([...this.collapsed, ...rowKeys]);
  }
}

export const aiStore = new AiStore();
