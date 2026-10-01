// A lazily filled map of per-repository drafts, keyed by repository root.

export class DraftBook<T> {
  private readonly drafts = new Map<string, T>();
  private readonly create: () => T;

  constructor(create: () => T) {
    this.create = create;
  }

  get size(): number {
    return this.drafts.size;
  }

  /** The draft of `repoRoot`, created on first use. */
  get(repoRoot: string): T {
    let draft = this.drafts.get(repoRoot);
    if (draft === undefined) {
      draft = this.create();
      this.drafts.set(repoRoot, draft);
    }
    return draft;
  }

  peek(repoRoot: string): T | null {
    return this.drafts.get(repoRoot) ?? null;
  }

  /** Drops drafts of repositories that no longer exist; returns how many were dropped. */
  prune(repoRoots: Iterable<string>): number {
    const keep = new Set(repoRoots);
    let removed = 0;
    for (const repoRoot of [...this.drafts.keys()]) {
      if (!keep.has(repoRoot)) {
        this.drafts.delete(repoRoot);
        removed++;
      }
    }
    return removed;
  }

  clear(): void {
    this.drafts.clear();
  }
}
