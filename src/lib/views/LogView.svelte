<script lang="ts">
  import { withCommandKeys } from "$lib/commands/commandRuntime";
  import { untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import CommitDetails from "$lib/log/CommitDetails.svelte";
  import { logSelection } from "$lib/log/logSelection.svelte";
  import { startInteractiveRebase } from "./git/gitMenuActions";
  import { bisectStore } from "./git/bisect.svelte";
  import { markFromLog } from "./git/bisectActions";
  import { bisectBadges } from "./git/bisectBanner";
  import { undoAction } from "./git/undoActions";
  import { changesSelection } from "./changes/selection.svelte";
  import { fullDate, relativeTime, sortRefs } from "$lib/log/format";
  import { GraphBuilder, type GraphRow } from "$lib/log/graph";
  import GraphCell, { LANE_COLORS, graphColumnWidth } from "$lib/log/GraphCell.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { CommitSummary, ResetMode } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";

  const PAGE_SIZE = 300;
  const ROW_HEIGHT = 26;
  const OVERSCAN = 12;
  const NEAR_END_ROWS = 80;
  /** On reload, refetch up to this many commits so the scroll position survives. */
  const RELOAD_CAP = 3000;
  const MAX_BADGES = 3;

  // Loaded history is kept outside of runes so large logs are not proxied;
  // `version` is bumped whenever these change.
  const commits: CommitSummary[] = [];
  const rows: GraphRow[] = [];
  const indexById = new Map<string, number>();
  let builder = new GraphBuilder(LANE_COLORS.length);
  let generation = 0;
  let loadedRepoPath: string | null = null;
  /** Branch tips the loaded history was read at, and for which walk; a reload with the same tips walks nothing. */
  let loadedTips: { tips: string; allRefs: boolean } | null = null;
  let firstTrigger = true;

  let version = $state(0);
  let loading = $state(false);
  let initialLoaded = $state(false);
  let hasMore = $state(true);
  let loadError = $state<string | null>(null);
  let laneCount = $state(1);

  let filterText = $state("");
  let selectedId = $state<string | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  let scrollerEl = $state<HTMLDivElement | null>(null);
  let paneEl = $state<HTMLDivElement | null>(null);
  let listFraction = $state(0.55);
  let now = $state(Date.now());

  const repoPath = $derived(repoStore.repo?.root ?? null);
  const bisecting = $derived(repoPath !== null && (repoStore.statuses[repoPath]?.bisect ?? null) !== null);
  /** Good, bad, skipped and tested commits while a bisect runs (BisectBanner keeps the state fresh). */
  const bisectMarks = $derived(bisectBadges(bisecting ? bisectStore.forRepo(repoPath) : null));
  const query = $derived(filterText.trim().toLowerCase());
  const graphWidth = $derived(query ? graphColumnWidth(1) : graphColumnWidth(laneCount));

  /** Indices into `commits` matching the filter, or null when unfiltered. */
  const filtered = $derived.by((): number[] | null => {
    void version;
    if (!query) {
      return null;
    }
    const matches: number[] = [];
    for (let index = 0; index < commits.length; index++) {
      if (matchesQuery(commits[index], query)) {
        matches.push(index);
      }
    }
    return matches;
  });

  const displayCount = $derived.by(() => {
    void version;
    return filtered ? filtered.length : commits.length;
  });

  const selectedPosition = $derived.by(() => {
    void version;
    if (!selectedId) {
      return -1;
    }
    const index = indexById.get(selectedId);
    if (index === undefined) {
      return -1;
    }
    return filtered ? filtered.indexOf(index) : index;
  });

  const range = $derived.by(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(displayCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
    return { start, end };
  });

  const visibleItems = $derived.by(() => {
    void version;
    const items: { position: number; commit: CommitSummary; row: GraphRow }[] = [];
    for (let position = range.start; position < range.end; position++) {
      const index = filtered ? filtered[position] : position;
      const commit = commits[index];
      const row = rows[index];
      if (commit && row) {
        items.push({ position, commit, row });
      }
    }
    return items;
  });

  const countLabel = $derived.by(() => {
    void version;
    const loaded = `${commits.length.toLocaleString()}${hasMore ? "+" : ""}`;
    if (filtered) {
      return `${filtered.length.toLocaleString()} of ${loaded} loaded commits`;
    }
    return `${loaded} ${commits.length === 1 ? "commit" : "commits"}`;
  });

  function matchesQuery(commit: CommitSummary, text: string): boolean {
    return (
      commit.id.startsWith(text) ||
      commit.summary.toLowerCase().includes(text) ||
      commit.authorName.toLowerCase().includes(text) ||
      commit.authorEmail.toLowerCase().includes(text)
    );
  }

  $effect(() => {
    void repoStore.historyVersion;
    void settings.logAllRefs;
    const target = repoPath;
    const immediate = firstTrigger || target !== loadedRepoPath;
    firstTrigger = false;
    const timer = setTimeout(() => void reload(), immediate ? 0 : 150);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const nearEnd = range.end >= displayCount - NEAR_END_ROWS;
    if (initialLoaded && hasMore && !loading && !query && !loadError && nearEnd) {
      untrack(() => void loadMore());
    }
  });

  // The Git menu's Create Patch from Commit and Interactive Rebase start from the selected commit.
  $effect(() => {
    void version;
    const commitId = selectedId;
    const index = commitId ? indexById.get(commitId) : undefined;
    const commit = index === undefined ? null : (commits[index] ?? null);
    logSelection.current =
      commit && repoPath ? { repoRoot: repoPath, commitId: commit.id, shortId: commit.shortId, summary: commit.summary } : null;
  });

  $effect(() => () => {
    logSelection.current = null;
  });

  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });

  $effect(() => {
    const element = scrollerEl;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      viewportHeight = element.clientHeight;
    });
    observer.observe(element);
    viewportHeight = element.clientHeight;
    return () => observer.disconnect();
  });

  function resetData(): void {
    commits.length = 0;
    rows.length = 0;
    indexById.clear();
    builder = new GraphBuilder(LANE_COLORS.length);
    laneCount = 1;
  }

  function append(page: CommitSummary[]): void {
    const pageRows = builder.push(page);
    for (let index = 0; index < page.length; index++) {
      indexById.set(page[index].id, commits.length);
      commits.push(page[index]);
      rows.push(pageRows[index]);
    }
    laneCount = Math.max(1, builder.maxWidth);
    version++;
  }

  async function reload(): Promise<void> {
    const target = repoPath;
    const token = ++generation;
    if (!target) {
      resetData();
      loadedRepoPath = null;
      loadedTips = null;
      selectedId = null;
      initialLoaded = false;
      version++;
      return;
    }
    const allRefs = settings.logAllRefs;
    const sameRepo = target === loadedRepoPath;
    const targetCount = sameRepo ? Math.min(Math.max(commits.length, PAGE_SIZE), RELOAD_CAP) : PAGE_SIZE;
    const keepId = sameRepo ? selectedId : null;
    // Only history that loaded without an error may be kept as it is.
    const knownTips = sameRepo && !loadError && loadedTips?.allRefs === allRefs ? loadedTips.tips : null;
    loading = true;
    loadError = null;

    let fresh: CommitSummary[];
    let more: boolean;
    try {
      // One call: every topological page walks the whole history first.
      const page = await api.getLogPage(target, 0, targetCount, allRefs, knownTips);
      if (token !== generation) {
        return;
      }
      if (!page.commits) {
        // The tips did not move: what is loaded is still the history.
        loading = false;
        return;
      }
      loadedTips = { tips: page.tips, allRefs };
      fresh = page.commits;
      more = fresh.length >= targetCount;
    } catch (error) {
      if (token !== generation) {
        return;
      }
      loading = false;
      initialLoaded = true;
      loadError = errorMessage(error);
      loadedTips = null;
      if (!sameRepo) {
        resetData();
        loadedRepoPath = target;
        selectedId = null;
        version++;
      }
      return;
    }

    resetData();
    if (!sameRepo) {
      selectedId = null;
      if (scrollerEl) {
        scrollerEl.scrollTop = 0;
      }
      scrollTop = 0;
    }
    loadedRepoPath = target;
    append(fresh);
    hasMore = more;
    loading = false;
    initialLoaded = true;
    if (keepId && indexById.has(keepId)) {
      selectedId = keepId;
    } else {
      selectedId = commits[0]?.id ?? null;
    }
  }

  async function loadMore(): Promise<void> {
    const target = repoPath;
    if (!target || loading || !hasMore || !initialLoaded || target !== loadedRepoPath) {
      return;
    }
    const token = generation;
    loading = true;
    try {
      const page = await api.getLog(target, commits.length, PAGE_SIZE, settings.logAllRefs);
      if (token !== generation) {
        return;
      }
      append(page ?? []);
      hasMore = (page?.length ?? 0) >= PAGE_SIZE;
    } catch (error) {
      if (token !== generation) {
        return;
      }
      loadError = errorMessage(error);
      toast.error("Could not load more history", loadError);
    } finally {
      if (token === generation) {
        loading = false;
      }
    }
  }

  function refresh(): void {
    loadError = null;
    // Asked for: read the history again even when the tips did not move.
    loadedTips = null;
    void reload();
  }

  function toggleAllRefs(): void {
    settings.logAllRefs = !settings.logAllRefs;
    settings.save();
  }

  function commitAt(position: number): CommitSummary | null {
    const index = filtered ? filtered[position] : position;
    return index === undefined ? null : (commits[index] ?? null);
  }

  function ensureVisible(position: number): void {
    const element = scrollerEl;
    if (!element || position < 0) {
      return;
    }
    const top = position * ROW_HEIGHT;
    if (top < element.scrollTop) {
      element.scrollTop = top;
    } else if (top + ROW_HEIGHT > element.scrollTop + element.clientHeight) {
      element.scrollTop = top + ROW_HEIGHT - element.clientHeight;
    }
  }

  function selectPosition(position: number): void {
    if (displayCount === 0) {
      return;
    }
    const clamped = Math.max(0, Math.min(displayCount - 1, position));
    const commit = commitAt(clamped);
    if (commit) {
      selectedId = commit.id;
      ensureVisible(clamped);
    }
  }

  function selectCommit(commitId: string): void {
    const index = indexById.get(commitId);
    if (index === undefined) {
      return;
    }
    if (filtered && !filtered.includes(index)) {
      filterText = "";
    }
    selectedId = commitId;
    requestAnimationFrame(() => ensureVisible(selectedPosition));
    scrollerEl?.focus({ preventScroll: true });
  }

  // A commit requested from elsewhere (blame): load history until it shows up.
  const MAX_FOCUS_PAGES = 20;
  let handledFocus = 0;
  let focusFile = $state<{
    commitId: string;
    path: string;
    line: number | null;
    lineText: string | null;
    token: number;
  } | null>(null);

  $effect(() => {
    const focus = repoStore.logFocus;
    void version;
    if (!focus || focus.token === handledFocus || focus.repoRoot !== repoPath) {
      return;
    }
    if (!initialLoaded || loading || loadedRepoPath !== repoPath) {
      return;
    }
    handledFocus = focus.token;
    untrack(() => void focusCommit(focus.commitId, focus.filePath, focus.line, focus.lineText ?? null, focus.token));
  });

  async function focusCommit(
    commitId: string,
    filePath: string | null,
    line: number | null,
    lineText: string | null,
    focusToken: number,
  ): Promise<void> {
    focusFile = filePath ? { commitId, path: filePath, line, lineText, token: focusToken } : null;
    filterText = "";
    let pages = 0;
    const token = generation;
    while (!indexById.has(commitId) && hasMore && pages < MAX_FOCUS_PAGES && token === generation) {
      await loadMore();
      pages++;
    }
    if (token !== generation) {
      return;
    }
    selectedId = commitId;
    if (!indexById.has(commitId)) {
      toast.info("Commit is not in the loaded history", settings.logAllRefs ? undefined : "Try showing all branches.");
      return;
    }
    // Center the commit in the list.
    requestAnimationFrame(() => {
      const element = scrollerEl;
      if (element) {
        element.scrollTop = Math.max(0, selectedPosition * ROW_HEIGHT - element.clientHeight / 2);
      }
    });
  }

  function loadedShortId(commitId: string): string | null {
    void version;
    const index = indexById.get(commitId);
    return index === undefined ? null : (commits[index]?.shortId ?? null);
  }

  /** Opens a commit in its own editor tab, on `filePath` when given. */
  function openInTab(commitId: string, filePath: string | null = null): void {
    if (!repoPath) {
      return;
    }
    const index = indexById.get(commitId);
    const summary = index === undefined ? null : (commits[index]?.summary ?? null);
    repoStore.openCommitTab(repoPath, commitId, { summary, filePath });
  }

  function onListKeydown(event: KeyboardEvent): void {
    const page = Math.max(1, Math.floor(viewportHeight / ROW_HEIGHT) - 1);
    const current = selectedPosition;
    let next: number;
    if (event.key === "Enter" && selectedId) {
      event.preventDefault();
      openInTab(selectedId);
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        next = current + 1;
        break;
      case "ArrowUp":
        next = current === -1 ? 0 : current - 1;
        break;
      case "PageDown":
        next = current + page;
        break;
      case "PageUp":
        next = current - page;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = displayCount - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    selectPosition(next);
  }

  function onFilterKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      filterText = "";
    } else if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      scrollerEl?.focus();
      if (selectedPosition === -1) {
        selectPosition(0);
      }
    }
  }

  function startSplit(event: PointerEvent): void {
    const container = paneEl;
    if (!container) {
      return;
    }
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const bounds = container.getBoundingClientRect();
    const move = (moveEvent: PointerEvent): void => {
      const fraction = (moveEvent.clientY - bounds.top) / Math.max(1, bounds.height);
      listFraction = Math.max(0.15, Math.min(0.85, fraction));
    };
    const stop = (): void => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  async function copyHash(commit: CommitSummary): Promise<void> {
    try {
      await navigator.clipboard.writeText(commit.id);
      toast.success("Copied revision hash", commit.id);
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  async function newBranchAt(commit: CommitSummary): Promise<void> {
    const result = await dialogs.prompt({
      title: "New Branch",
      label: `Branch name (from ${commit.shortId})`,
      placeholder: "feature/my-change",
      confirmLabel: "Create",
      checkbox: { label: "Checkout branch", checked: true },
      validate: (value) => (/\s|\.\.|[~^:?*[\\]/.test(value) ? "Not a valid branch name" : null),
    });
    if (!result) {
      return;
    }
    await repoStore.run(
      "Create branch",
      (targetRepoPath) => api.createBranch(targetRepoPath, result.value, commit.id, result.checked),
      { success: `Created ${result.value}` },
    );
  }

  async function checkoutRevision(commit: CommitSummary): Promise<void> {
    const confirmed = await dialogs.confirm({
      title: "Checkout Revision",
      message: `Check out ${commit.shortId} in detached HEAD state? New commits there will not belong to any branch until you create one.`,
      confirmLabel: "Checkout",
    });
    if (!confirmed) {
      return;
    }
    const undoRoot = repoPath;
    await repoStore.run("Checkout", (targetRepoPath) => api.checkoutCommit(targetRepoPath, commit.id), {
      success: `HEAD is now at ${commit.shortId}`,
      action: () => (undoRoot ? undoAction(undoRoot, ["checkout"]) : null),
    });
  }

  function cherryPick(commit: CommitSummary): void {
    void repoStore.runOp(
      "Cherry-pick",
      (targetRepoPath) => api.cherryPick(targetRepoPath, commit.id),
      `Cherry-picked ${commit.shortId}`,
    );
  }

  function revert(commit: CommitSummary): void {
    void repoStore.runOp(
      "Revert",
      (targetRepoPath) => api.revertCommit(targetRepoPath, commit.id),
      `Reverted ${commit.shortId}`,
    );
  }

  async function resetHere(commit: CommitSummary): Promise<void> {
    const branch = repoStore.status?.head.branch ?? "HEAD";
    const mode = await dialogs.choose<ResetMode>({
      title: `Reset ${branch} to ${commit.shortId}`,
      message: commit.summary,
      options: [
        {
          value: "soft",
          label: "Soft",
          description: "Move the branch only. Changes from later commits stay staged.",
        },
        {
          value: "mixed",
          label: "Mixed",
          description: "Move the branch and reset the index. Changes stay in the working tree, unstaged.",
        },
        {
          value: "hard",
          label: "Hard",
          description: "Move the branch and discard all changes in the index and working tree.",
          danger: true,
        },
        {
          value: "keep",
          label: "Keep",
          description: "Move the branch and reset the files it changes, keeping your local changes.",
        },
      ],
    });
    if (!mode) {
      return;
    }
    if (mode === "hard") {
      const confirmed = await dialogs.confirm({
        title: "Hard Reset",
        message: `Reset ${branch} to ${commit.shortId} and discard all uncommitted changes? This cannot be undone.`,
        confirmLabel: "Reset",
        danger: true,
      });
      if (!confirmed) {
        return;
      }
    }
    const undoRoot = repoPath;
    await repoStore.run("Reset", (targetRepoPath) => api.resetTo(targetRepoPath, commit.id, mode), {
      success: `Reset ${branch} to ${commit.shortId} (${mode})`,
      action: () => (undoRoot ? undoAction(undoRoot, ["reset"]) : null),
    });
  }

  function openCommitMenu(event: MouseEvent, commit: CommitSummary): void {
    selectedId = commit.id;
    const busy = repoStore.busy !== null;
    const isMerge = commit.parents.length > 1;
    const onBranch = repoStore.status?.head.branch != null;
    const operation = (repoStore.status?.op.kind ?? "none") !== "none";
    const items: MenuItem[] = [
      { label: "Open in Tab", hint: "double-click", action: () => openInTab(commit.id) },
      { label: "Copy Revision Hash", action: () => void copyHash(commit) },
      { separator: true },
      { label: "New Branch Here...", disabled: busy, action: () => void newBranchAt(commit) },
      { label: "Checkout Revision", disabled: busy, action: () => void checkoutRevision(commit) },
      { separator: true },
      {
        label: "Cherry-Pick",
        disabled: busy || isMerge,
        hint: isMerge ? "merge commit" : undefined,
        action: () => cherryPick(commit),
      },
      {
        label: "Revert Commit",
        disabled: busy || isMerge,
        hint: isMerge ? "merge commit" : undefined,
        action: () => revert(commit),
      },
      {
        label: "Interactively Rebase from Here...",
        disabled: busy || isMerge || !onBranch || operation,
        hint: isMerge ? "merge commit" : undefined,
        action: () => {
          if (repoPath) {
            void startInteractiveRebase(repoPath, commit.id);
          }
        },
      },
      { separator: true },
      { label: "Reset Current Branch to Here...", disabled: busy, action: () => void resetHere(commit) },
      { separator: true },
      {
        label: "Bisect: Mark as Good",
        disabled: busy || operation,
        hint: bisecting ? undefined : "starts a bisect",
        action: () => {
          if (repoPath) {
            void markFromLog(repoPath, commit.id, "good");
          }
        },
      },
      {
        label: "Bisect: Mark as Bad",
        disabled: busy || operation,
        hint: bisecting ? undefined : "starts a bisect",
        action: () => {
          if (repoPath) {
            void markFromLog(repoPath, commit.id, "bad");
          }
        },
      },
    ];
    contextMenu.open(event, items);
  }

  function onRowMouseDown(event: MouseEvent, commit: CommitSummary): void {
    // Keep focus on the list itself: rows are recycled while scrolling.
    event.preventDefault();
    scrollerEl?.focus({ preventScroll: true });
    selectedId = commit.id;
  }

  function isHeadCommit(commit: CommitSummary): boolean {
    return (commit.refs ?? []).some((ref) => ref.kind === "head");
  }
</script>

<div class="log-view">
  <div class="toolbar">
    <div class="filter">
      <Icon name="search" size={13} />
      <input
        class="input"
        type="text"
        placeholder="Filter by message, author or hash"
        spellcheck="false"
        autocomplete="off"
        bind:value={filterText}
        onkeydown={onFilterKeydown}
      />
      {#if filterText}
        <button class="clear icon-btn" onclick={() => (filterText = "")} title="Clear filter">
          <Icon name="x" size={12} />
        </button>
      {/if}
    </div>
    <button
      class="toggle"
      class:on={settings.logAllRefs}
      onclick={toggleAllRefs}
      aria-pressed={settings.logAllRefs}
      title="Show commits from all local and remote branches"
    >
      <Icon name="branch" size={13} />
      All branches
    </button>
    <button class="icon-btn" onclick={refresh} disabled={loading} title="Refresh history">
      <Icon name="refresh" size={14} />
    </button>
    <div class="spacer-flex"></div>
    {#if loading && initialLoaded}
      <span class="spinner" aria-hidden="true"></span>
    {/if}
    {#if initialLoaded && commits.length > 0}
      <span class="count dim">{countLabel}</span>
    {/if}
    {#if query && hasMore && initialLoaded}
      <button class="btn small" onclick={() => void loadMore()} disabled={loading} title="Load the next page of history to search it">
        Load more
      </button>
    {/if}
    <button class="icon-btn" onclick={() => changesSelection.toggleLog()} title={withCommandKeys("Hide Log", "view.log")} aria-label="Hide log">
      <Icon name="x" size={14} />
    </button>
  </div>

  <div class="panes" bind:this={paneEl}>
    <div class="list" style="height: {selectedId ? `${listFraction * 100}%` : '100%'}">
      <div class="columns dim">
        <div class="col-subject" style="padding-left: {graphWidth + 4}px">Subject</div>
        <div class="col-author">Author</div>
        <div class="col-date">Date</div>
        <div class="col-hash">Hash</div>
      </div>

      {#if !initialLoaded}
        <div class="state dim">
          <span class="spinner" aria-hidden="true"></span>
          Loading history...
        </div>
      {:else if loadError && commits.length === 0}
        <div class="state dim">
          <Icon name="alert" size={16} />
          <span>Could not load history: {loadError}</span>
          <button class="btn small" onclick={refresh}>Retry</button>
        </div>
      {:else if commits.length === 0}
        <div class="state dim">
          <Icon name="commit" size={20} />
          <span>
            {repoStore.status?.head.unborn ? "This repository has no commits yet." : "No commits to show."}
          </span>
        </div>
      {:else}
        <div
          class="scroller"
          role="listbox"
          tabindex="0"
          aria-label="Commits"
          aria-activedescendant={selectedId ? `commit-${selectedId}` : undefined}
          bind:this={scrollerEl}
          onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}
          onkeydown={onListKeydown}
        >
          <div class="spacer" style="height: {displayCount * ROW_HEIGHT}px">
            {#each visibleItems as item (item.commit.id)}
              {@const commit = item.commit}
              {@const refs = sortRefs(commit.refs ?? [])}
              {@const head = isHeadCommit(commit)}
              <div
                id="commit-{commit.id}"
                class="row"
                class:selected={commit.id === selectedId}
                class:head
                role="option"
                tabindex="-1"
                aria-selected={commit.id === selectedId}
                style="transform: translateY({item.position * ROW_HEIGHT}px); height: {ROW_HEIGHT}px"
                onmousedown={(event) => onRowMouseDown(event, commit)}
                ondblclick={() => openInTab(commit.id)}
                oncontextmenu={(event) => openCommitMenu(event, commit)}
              >
                <div class="col-graph" style="width: {graphWidth}px">
                  <GraphCell
                    row={item.row}
                    {laneCount}
                    height={ROW_HEIGHT}
                    isHead={head}
                    isMerge={commit.parents.length > 1}
                    nodeOnly={query !== ""}
                  />
                </div>
                <div class="col-subject">
                  {#each bisectMarks.get(commit.id) ?? [] as mark (mark.kind)}
                    <span class="ref bisect-{mark.kind}" title="Bisect: {mark.label}">{mark.label}</span>
                  {/each}
                  {#each refs.slice(0, MAX_BADGES) as ref (`${ref.kind}:${ref.name}`)}
                    <span class="ref ref-{ref.kind}" title={ref.name}>
                      {#if ref.kind === "tag"}<Icon name="tag" size={10} />{/if}
                      <span class="truncate">{ref.name}</span>
                    </span>
                  {/each}
                  {#if refs.length > MAX_BADGES}
                    <span class="ref ref-more" title={refs.slice(MAX_BADGES).map((ref) => ref.name).join(", ")}>
                      +{refs.length - MAX_BADGES}
                    </span>
                  {/if}
                  <span class="summary truncate" title={`${commit.summary}\nDouble-click to open in a tab`}>{commit.summary}</span>
                </div>
                <div class="col-author truncate" title={commit.authorEmail}>{commit.authorName}</div>
                <div class="col-date truncate" title={fullDate(commit.time)}>{relativeTime(commit.time, now)}</div>
                <div class="col-hash mono">{commit.shortId}</div>
              </div>
            {/each}
          </div>
          {#if query && displayCount === 0}
            <div class="state dim overlay-state">
              No loaded commits match "{filterText.trim()}".
            </div>
          {/if}
        </div>
      {/if}
    </div>

    {#if selectedId && repoPath}
      <div class="split" role="separator" aria-orientation="horizontal" onpointerdown={startSplit}></div>
      <div class="details-pane">
        <CommitDetails
          {repoPath}
          commitId={selectedId}
          {loadedShortId}
          onSelectCommit={selectCommit}
          preferredFile={focusFile}
          onOpenInTab={(filePath) => selectedId && openInTab(selectedId, filePath)}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .log-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }

  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 8px;
    border-bottom: 1px solid var(--border-strong);
  }

  .filter {
    position: relative;
    display: flex;
    align-items: center;
    width: 300px;
    min-width: 140px;
    color: var(--text-dim);
  }

  .filter > :global(svg) {
    position: absolute;
    left: 8px;
    pointer-events: none;
  }

  .filter .input {
    width: 100%;
    height: 26px;
    padding-left: 27px;
    padding-right: 26px;
  }

  .clear {
    position: absolute;
    right: 2px;
    height: 22px;
    min-width: 22px;
    padding: 0;
    color: var(--text-dim);
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 9px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--panel);
    color: var(--text-dim);
    cursor: pointer;
    white-space: nowrap;
  }

  .toggle:hover {
    background: var(--hover);
  }

  .toggle.on {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--border-strong));
    background: color-mix(in srgb, var(--accent) 12%, var(--panel));
    color: var(--text);
  }

  .spacer-flex {
    flex: 1;
  }

  .count {
    font-size: 12px;
    white-space: nowrap;
  }

  .spinner {
    flex: none;
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .panes {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .list {
    flex: none;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .columns {
    flex: none;
    display: flex;
    align-items: center;
    height: 24px;
    padding-right: 20px;
    border-bottom: 1px solid var(--border);
    background: var(--panel-alt);
    font-size: 11.5px;
  }

  .columns .col-subject {
    flex: 1;
  }

  .state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    text-align: center;
  }

  .scroller {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    outline: none;
  }

  .overlay-state {
    position: absolute;
    inset: 0;
  }

  .spacer {
    position: relative;
    width: 100%;
  }

  .row {
    --row-bg: var(--panel);
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    padding-right: 10px;
    background: var(--row-bg);
    white-space: nowrap;
    contain: strict;
  }

  .row:hover {
    --row-bg: var(--hover);
  }

  .row.selected {
    --row-bg: var(--selected-inactive);
  }

  .scroller:focus-within .row.selected {
    --row-bg: var(--selected);
  }

  .col-graph {
    flex: none;
    height: 100%;
    overflow: hidden;
  }

  .col-subject {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding-left: 4px;
  }

  .row.head .summary {
    font-weight: 600;
  }

  .summary {
    min-width: 0;
  }

  .col-author {
    flex: none;
    width: 150px;
    padding-left: 12px;
  }

  .col-date {
    flex: none;
    width: 110px;
    padding-left: 12px;
  }

  .col-hash {
    flex: none;
    width: 82px;
    padding-left: 12px;
  }

  .row .col-author,
  .row .col-date {
    color: var(--text-dim);
  }

  .row .col-hash {
    color: var(--text-faint);
    font-size: 11.5px;
  }

  .ref {
    --ref-color: var(--text-dim);
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    max-width: 180px;
    height: 17px;
    padding: 0 6px;
    border: 1px solid color-mix(in srgb, var(--ref-color) 45%, transparent);
    border-radius: 4px;
    background: color-mix(in srgb, var(--ref-color) 14%, var(--row-bg));
    color: color-mix(in srgb, var(--ref-color) 80%, var(--text));
    font-size: 11px;
    line-height: 15px;
  }

  .ref-head {
    --ref-color: var(--accent);
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 700;
  }

  .ref-local {
    --ref-color: var(--success);
  }

  .ref-remote {
    --ref-color: color-mix(in srgb, var(--accent) 45%, #b04ad8);
  }

  .ref-tag {
    --ref-color: var(--warning);
  }

  .ref-more {
    --ref-color: var(--text-dim);
  }

  .bisect-bad {
    --ref-color: var(--danger);
  }

  .bisect-good {
    --ref-color: var(--success);
  }

  .bisect-skip {
    --ref-color: var(--text-dim);
  }

  .bisect-current {
    --ref-color: var(--warning);
  }

  .split {
    flex: none;
    height: 5px;
    margin: -2px 0;
    position: relative;
    z-index: 1;
    cursor: row-resize;
    background: linear-gradient(to bottom, transparent 2px, var(--border-strong) 2px, var(--border-strong) 3px, transparent 3px);
  }

  .details-pane {
    flex: 1;
    display: flex;
    min-height: 0;
  }
</style>
