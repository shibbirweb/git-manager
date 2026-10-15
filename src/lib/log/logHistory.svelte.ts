// The log's loaded history: pages of commits with their graph rows, read again when the branch tips move. Large logs
// stay outside of runes so they are not proxied; `version` is bumped whenever they change.
import { api, errorMessage } from "$lib/api";
import { GraphBuilder, type GraphRow } from "$lib/log/graph";
import type { CommitSummary } from "$lib/types";
import { toast } from "$lib/ui/toast.svelte";
import { LANE_COLOR_COUNT } from "@git-manager/ui/logic/graphModel";

export const PAGE_SIZE = 300;
/** On reload, refetch up to this many commits so the scroll position survives. */
const RELOAD_CAP = 3000;
/** A commit asked for from elsewhere (blame) loads at most this many more pages. */
const MAX_FIND_PAGES = 20;

export interface LogEntry {
  commit: CommitSummary;
  row: GraphRow;
}

export class LogHistory {
  #entries: LogEntry[] = [];
  #indexById = new Map<string, number>();
  #builder = new GraphBuilder(LANE_COLOR_COUNT);
  #generation = 0;
  /** Branch tips the loaded history was read at, and for which walk; a reload with the same tips walks nothing. */
  #tips: { tips: string; allRefs: boolean } | null = null;

  version = $state(0);
  /** The repository the history belongs to; it changes together with the entries. */
  repoPath = $state<string | null>(null);
  loading = $state(false);
  loaded = $state(false);
  hasMore = $state(true);
  error = $state<string | null>(null);
  laneCount = $state(1);
  selected = $state<string | null>(null);

  /** Every loaded entry; read `version` first to follow changes. */
  get entries(): readonly LogEntry[] {
    return this.#entries;
  }

  entry(commitId: string): LogEntry | null {
    const index = this.#indexById.get(commitId);
    return index === undefined ? null : (this.#entries[index] ?? null);
  }

  #reset(): void {
    this.#entries = [];
    this.#indexById.clear();
    this.#builder = new GraphBuilder(LANE_COLOR_COUNT);
    this.laneCount = 1;
  }

  #append(page: CommitSummary[]): void {
    const rows = this.#builder.push(page);
    for (let index = 0; index < page.length; index++) {
      this.#indexById.set(page[index].id, this.#entries.length);
      this.#entries.push({ commit: page[index], row: rows[index] });
    }
    this.laneCount = Math.max(1, this.#builder.maxWidth);
    this.version++;
  }

  /** Reads the history again on the next reload, even when the tips did not move. */
  forget(): void {
    this.error = null;
    this.#tips = null;
  }

  async reload(target: string | null, allRefs: boolean): Promise<void> {
    const token = ++this.#generation;
    if (!target) {
      this.#reset();
      this.#tips = null;
      this.repoPath = null;
      this.selected = null;
      this.loaded = false;
      this.version++;
      return;
    }
    const sameRepo = target === this.repoPath;
    const count = this.#entries.length;
    const targetCount = sameRepo ? Math.min(Math.max(count, PAGE_SIZE), RELOAD_CAP) : PAGE_SIZE;
    const keepId = sameRepo ? this.selected : null;
    // Only history that loaded without an error may be kept as it is.
    const knownTips = sameRepo && !this.error && this.#tips?.allRefs === allRefs ? this.#tips.tips : null;
    this.loading = true;
    this.error = null;
    try {
      // One call: every topological page walks the whole history first.
      const page = await api.getLogPage(target, 0, targetCount, allRefs, knownTips);
      if (token !== this.#generation) {
        return;
      }
      if (page.commits) {
        this.#tips = { tips: page.tips, allRefs };
        this.#reset();
        this.repoPath = target;
        this.#append(page.commits);
        this.hasMore = page.commits.length >= targetCount;
        this.selected = keepId && this.#indexById.has(keepId) ? keepId : (this.#entries[0]?.commit.id ?? null);
      }
      this.loaded = true;
    } catch (error) {
      if (token !== this.#generation) {
        return;
      }
      this.loaded = true;
      this.error = errorMessage(error);
      this.#tips = null;
      if (!sameRepo) {
        this.#reset();
        this.repoPath = target;
        this.selected = null;
        this.version++;
      }
    } finally {
      if (token === this.#generation) {
        this.loading = false;
      }
    }
  }

  async loadMore(target: string | null, allRefs: boolean): Promise<void> {
    if (!target || this.loading || !this.hasMore || !this.loaded || target !== this.repoPath) {
      return;
    }
    const token = this.#generation;
    this.loading = true;
    try {
      const page = await api.getLog(target, this.#entries.length, PAGE_SIZE, allRefs);
      if (token !== this.#generation) {
        return;
      }
      this.#append(page ?? []);
      this.hasMore = (page?.length ?? 0) >= PAGE_SIZE;
    } catch (error) {
      if (token !== this.#generation) {
        return;
      }
      this.error = errorMessage(error);
      toast.error("Could not load more history", this.error);
    } finally {
      if (token === this.#generation) {
        this.loading = false;
      }
    }
  }

  /** Loads pages until `commitId` shows up; stale when the history was reloaded meanwhile. */
  async find(commitId: string, target: string, allRefs: boolean): Promise<"found" | "missing" | "stale"> {
    const token = this.#generation;
    let pages = 0;
    while (!this.#indexById.has(commitId) && this.hasMore && pages < MAX_FIND_PAGES && token === this.#generation) {
      await this.loadMore(target, allRefs);
      pages++;
    }
    if (token !== this.#generation) {
      return "stale";
    }
    return this.#indexById.has(commitId) ? "found" : "missing";
  }
}
