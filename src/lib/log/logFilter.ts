// The log's filter and the words around it: which loaded commits match, the count in the toolbar, and the ref
// chips a row has room for.
import type { CommitSummary, RefLabel } from "$lib/types";

/** A filter matches the start of the hash, or the subject, author name or email anywhere (`query` is lowercase). */
export function matchesQuery(commit: CommitSummary, query: string): boolean {
  return (
    commit.id.startsWith(query) ||
    commit.summary.toLowerCase().includes(query) ||
    commit.authorName.toLowerCase().includes(query) ||
    commit.authorEmail.toLowerCase().includes(query)
  );
}

/** The entries whose commit matches, or null when there is no filter. */
export function matchingEntries<T extends { commit: CommitSummary }>(entries: readonly T[], query: string): T[] | null {
  return query ? entries.filter((entry) => matchesQuery(entry.commit, query)) : null;
}

/** "300+ commits", or "4 of 300+ loaded commits" while filtered. */
export function countLabel(loaded: number, hasMore: boolean, matched: number | null): string {
  const total = `${loaded.toLocaleString()}${hasMore ? "+" : ""}`;
  if (matched !== null) {
    return `${matched.toLocaleString()} of ${total} loaded commits`;
  }
  return `${total} ${loaded === 1 ? "commit" : "commits"}`;
}

/** The refs drawn as chips, and the rest folded into one "+N" chip whose tooltip names them. */
export function refChips(
  refs: RefLabel[],
  max: number,
): { shown: RefLabel[]; more: { count: number; names: string } | null } {
  if (refs.length <= max) {
    return { shown: refs, more: null };
  }
  const rest = refs.slice(max);
  return {
    shown: refs.slice(0, max),
    more: { count: rest.length, names: rest.map((ref) => ref.name).join(", ") },
  };
}
