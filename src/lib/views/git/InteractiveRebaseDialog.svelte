<!-- The interactive rebase dialog: one row per commit, oldest at the top, each with
     its action (letter keys on a focused row), reorder by drag and drop or Option+Up / Down,
     reword and squash messages edited in place, and Reset to start over. With merge commits
     the rows follow the --rebase-merges todo, grouped by branch (see rebaseModel.ts). -->
<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import { api } from "$lib/api";
  import { relativeTime } from "$lib/log/format";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { RebaseAction, RebasePlan } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { autoScrollStep, pastDragThreshold } from "../files/dragDrop";
  import GitDialogFrame from "./GitDialogFrame.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";
  import {
    actionForKey,
    allowedActions,
    deadCommits,
    dropTarget,
    initialRows,
    isMessageSquash,
    moveRow,
    REBASE_ACTIONS,
    rebaseEntries,
    rebaseTitle,
    type RebaseRow,
    rowsChanged,
    setAction,
    segmentTitles,
    setMessage,
    validateRows,
  } from "./rebaseModel";

  interface Props {
    repoRoot: string;
    plan: RebasePlan;
  }

  let { repoRoot, plan }: Props = $props();

  const original = untrack(() => initialRows(plan.commits, plan.steps));
  const withMerges = untrack(() => plan.steps.length > 0);
  let rows = $state.raw<RebaseRow[]>(original);
  let dragIndex = $state<number | null>(null);
  let dropIndex = $state<number | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  const now = Date.now();

  const error = $derived(validateRows(rows, plan.steps));
  const dead = $derived(deadCommits(rows, plan.steps));
  const changed = $derived(rowsChanged(rows, original));
  const canStart = $derived(error === null && changed && repoStore.busy === null);
  const baseLabel = $derived(plan.ontoName ?? (plan.base ? plan.base.slice(0, 8) : "the root"));
  const titles = $derived(segmentTitles(plan.steps, plan.commits, baseLabel));
  const branch = $derived(repoStore.statuses[repoRoot]?.head.branch ?? "HEAD");

  function close(): void {
    gitDialogs.close();
  }

  function rowElement(index: number): HTMLElement | null {
    return listEl?.querySelector<HTMLElement>(`[data-row="${index}"]`) ?? null;
  }

  async function focusRow(index: number): Promise<void> {
    await tick();
    rowElement(index)?.focus();
  }

  function changeAction(index: number, action: RebaseAction): void {
    rows = setAction(rows, index, action);
  }

  async function move(index: number, to: number): Promise<void> {
    const next = moveRow(rows, index, to);
    if (next !== rows) {
      rows = next;
      await focusRow(Math.max(0, Math.min(rows.length - 1, to)));
    }
  }

  function onRowKeydown(event: KeyboardEvent, index: number): void {
    // Keys typed in the action menu or a message box stay there.
    if (event.target !== event.currentTarget || event.metaKey || event.ctrlKey) {
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const step = event.key === "ArrowUp" ? -1 : 1;
      if (event.altKey) {
        void move(index, index + step);
      } else {
        void focusRow(Math.max(0, Math.min(rows.length - 1, index + step)));
      }
      return;
    }
    // Option changes the typed character on macOS: match the physical key.
    const letter = event.code.startsWith("Key") ? event.code.slice(3) : event.key;
    const action = event.altKey ? null : actionForKey(letter);
    if (action) {
      event.preventDefault();
      changeAction(index, action);
    }
  }

  // Reordering by drag uses mouse events, not HTML5 drag and drop: Tauri's window answers
  // every native drag itself (to report Finder files), so HTML5 drop events never reach the
  // page there. Listeners live only from a press on a row until the button goes up.
  let pending: { index: number; x: number; y: number } | null = null;
  let pointerY: number | null = null;
  let scrollFrame = 0;

  /** The row under the pointer, by its wrapper (which also holds a message box). */
  function rowAt(x: number, y: number): number | null {
    const element = document.elementFromPoint(x, y);
    const wrap = element && listEl?.contains(element) ? element.closest<HTMLElement>("[data-drop]") : null;
    return wrap ? Number(wrap.dataset.drop) : null;
  }

  function onRowMouseDown(event: MouseEvent, index: number): void {
    // The action menu keeps its own clicks.
    const control = (event.target as Element | null)?.closest("select, textarea, input, button");
    if (event.button !== 0 || control) {
      return;
    }
    pending = { index, x: event.clientX, y: event.clientY };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
    window.addEventListener("keydown", onDragKey, true);
  }

  function onDragMove(event: MouseEvent): void {
    if (dragIndex === null) {
      if (!pending || !pastDragThreshold(pending, { x: event.clientX, y: event.clientY })) {
        return;
      }
      dragIndex = pending.index;
    }
    pointerY = event.clientY;
    dropIndex = dropTarget(rows, dragIndex, rowAt(event.clientX, event.clientY));
    if (!scrollFrame) {
      scrollFrame = requestAnimationFrame(autoScroll);
    }
  }

  /** Scrolls the list while the pointer is near its top or bottom edge. */
  function autoScroll(): void {
    scrollFrame = 0;
    if (dragIndex === null || pointerY === null || !listEl) {
      return;
    }
    const rect = listEl.getBoundingClientRect();
    const step = autoScrollStep(pointerY, rect.top, rect.bottom);
    if (step !== 0) {
      listEl.scrollTop += step;
    }
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  function onDragEnd(): void {
    const from = dragIndex;
    const to = dropIndex;
    stopDrag();
    if (from !== null && to !== null) {
      void move(from, to);
    }
  }

  /** Escape cancels the drag without closing the dialog. */
  function onDragKey(event: KeyboardEvent): void {
    if (dragIndex !== null && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      stopDrag();
    }
  }

  function stopDrag(): void {
    pending = null;
    dragIndex = null;
    dropIndex = null;
    pointerY = null;
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
    window.removeEventListener("keydown", onDragKey, true);
  }

  onDestroy(stopDrag);

  function reset(): void {
    rows = original;
  }

  async function start(): Promise<void> {
    if (!canStart) {
      return;
    }
    if (plan.pushedTo) {
      const confirmed = await dialogs.confirm({
        title: "Rewrite Pushed Commits",
        message: `These commits are already on ${plan.pushedTo}; rewriting them needs a force push.`,
        confirmLabel: "Rebase Anyway",
        danger: true,
      });
      if (!confirmed) {
        return;
      }
    }
    let autostash = false;
    if (plan.dirty) {
      const choice = await dialogs.choose<"stash">({
        title: "Uncommitted Changes",
        message: "The rebase needs a clean working tree. Stash the changes, rebase, then bring them back?",
        options: [{ value: "stash", label: "Stash and Rebase", description: "git rebase -i --autostash" }],
      });
      if (choice !== "stash") {
        return;
      }
      autostash = true;
    }
    const entries = rebaseEntries(rows);
    const base = plan.base;
    const count = rows.filter((row) => row.action !== "drop").length;
    close();
    const outcome = await repoStore.runOp(
      "Rebase",
      (repoPath) => api.interactiveRebase(repoPath, base, entries, autostash),
      undefined,
      repoRoot,
    );
    if (outcome && !outcome.conflicts) {
      // An Edit row stops the rebase on purpose; the banner and the Git menu offer Continue.
      const stopped = (repoStore.statuses[repoRoot]?.op.kind ?? "none") === "rebase";
      toast.success(
        stopped ? "Rebase stopped for editing: amend, then Continue Rebase" : `Rebased ${branch}: ${count} ${count === 1 ? "commit" : "commits"}`,
      );
    }
  }
</script>

<GitDialogFrame title="{rebaseTitle(rows.length)} onto {baseLabel}" width={760} onCancel={close} onSubmit={() => void start()}>
  <div class="hint">
    Oldest commit at the top. Pick an action, or press P, R, E, S, F or D on a row; Option+Up and Option+Down or drag to reorder.
  </div>
  {#if withMerges}
    <div class="hint">
      Merge commits are recreated (--rebase-merges): pick or drop each one, and dropping it drops the branch it merged.
      Commits move only within their part of a branch.
    </div>
  {/if}
  <div class="rows" class:dragging={dragIndex !== null} bind:this={listEl} role="list" aria-label="Commits to rebase">
    {#each rows as row, index (row.commit.id)}
      {@const messageBox = !dead.has(row.commit.id) && (row.action === "reword" || isMessageSquash(rows, index))}
      {@const unused = dead.has(row.commit.id)}
      {#if row.segment !== undefined && row.segment !== rows[index - 1]?.segment}
        <div class="segment-title">{titles[row.segment] ?? ""}</div>
      {/if}
      <div
        class="row-wrap"
        class:drop-target={dropIndex === index}
        role="listitem"
        data-drop={index}
      >
        <div
          class="commit"
          class:dropped={row.action === "drop" || unused}
          class:merge={row.commit.isMerge}
          class:melded={row.action === "squash" || row.action === "fixup"}
          class:dragging={dragIndex === index}
          data-row={index}
          tabindex="0"
          role="button"
          aria-label="{row.action} {row.commit.shortId} {row.commit.summary}"
          onmousedown={(event) => onRowMouseDown(event, index)}
          onkeydown={(event) => onRowKeydown(event, index)}
        >
          <span class="grip" aria-hidden="true">&#8942;&#8942;</span>
          <select
            class="input action"
            disabled={unused}
            title={unused ? "Dropped with the merge that brought it in" : undefined}
            value={row.action}
            onchange={(event) => changeAction(index, event.currentTarget.value as RebaseAction)}
            aria-label="Action for {row.commit.shortId}"
          >
            {#each REBASE_ACTIONS.filter((action) => allowedActions(row).includes(action.value)) as action (action.value)}
              <option value={action.value} title={action.description}>{action.label}</option>
            {/each}
          </select>
          <span class="hash mono">{row.commit.shortId}</span>
          <span class="subject truncate" title={row.commit.message}>
            {#if row.commit.isMerge}<span class="badge">merge</span>{/if}
            {row.commit.summary}
          </span>
          <span class="author truncate dim">{row.commit.authorName}</span>
          <span class="when dim">{relativeTime(row.commit.time, now)}</span>
        </div>
        {#if messageBox}
          <textarea
            class="input message"
            rows={Math.min(8, Math.max(3, row.message.split("\n").length))}
            value={row.message}
            oninput={(event) => (rows = setMessage(rows, index, event.currentTarget.value))}
            aria-label={row.action === "reword" ? `New message for ${row.commit.shortId}` : "Message of the squashed commit"}
            spellcheck="true"
          ></textarea>
        {/if}
      </div>
    {/each}
  </div>
  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#snippet footer()}
    <button type="button" class="btn" onclick={reset} disabled={!changed}>Reset</button>
    <span class="spacer"></span>
    <span class="hint">&#8984;Enter to start</span>
    <button type="button" class="btn" onclick={close}>Cancel</button>
    <button type="button" class="btn primary" disabled={!canStart} onclick={() => void start()}>Start Rebasing</button>
  {/snippet}
</GitDialogFrame>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    max-height: 52vh;
    overflow-y: auto;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--editor-bg);
  }

  .row-wrap {
    border-bottom: 1px solid var(--border);
    border-top: 2px solid transparent;
  }

  .row-wrap.drop-target {
    border-top-color: var(--accent);
  }

  .commit {
    display: grid;
    grid-template-columns: 14px 96px 70px minmax(0, 1fr) 120px 80px;
    align-items: center;
    gap: 8px;
    padding: 4px 10px 4px 6px;
    outline: none;
    cursor: grab;
  }

  .commit:focus-visible,
  .commit:focus {
    background: var(--selected);
  }

  .commit.dragging {
    opacity: 0.5;
  }

  .rows.dragging,
  .rows.dragging .commit {
    cursor: grabbing;
  }

  .grip {
    color: var(--text-faint);
    font-size: 10px;
    letter-spacing: -2px;
  }

  .action {
    height: 24px;
    padding: 0 4px;
    font-size: 12px;
  }

  .hash {
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .dropped .subject,
  .dropped .hash,
  .dropped .author {
    text-decoration: line-through;
    color: var(--text-faint);
  }

  .melded .subject {
    padding-left: 14px;
  }

  .segment-title {
    padding: 5px 10px 3px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-dim);
    background: var(--panel-alt);
    border-bottom: 1px solid var(--border);
  }

  .badge {
    margin-right: 4px;
    padding: 0 5px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    font-size: 10.5px;
    color: var(--text-dim);
  }

  .when {
    font-size: 12px;
    text-align: right;
  }

  .message {
    display: block;
    width: calc(100% - 20px);
    margin: 0 10px 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    resize: vertical;
  }
</style>
