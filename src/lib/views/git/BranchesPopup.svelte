<!-- JetBrains' Branches popup: a filter, New Branch and Checkout Tag or Revision, then the
     local and remote branches. A branch opens its submenu (Checkout, Compare, Merge, Update,
     Push...) on click, Enter or Right; Up and Down move through the list. -->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { Refs } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { checkoutTo, loadDetails } from "../changes/repoActions";
  import { newBranchFrom, repoTarget } from "../sidebar/actions";
  import { filterBranches, trackingHint } from "./branchPopup";
  import { branchMenuItems, type PopupBranch } from "./branchPopupActions";
  import GitDialogFrame from "./GitDialogFrame.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";

  interface Props {
    repoRoot: string;
  }

  let { repoRoot }: Props = $props();

  let refs = $state.raw<Refs | null>(null);
  let query = $state("");
  let highlighted = $state(0);
  let listEl = $state<HTMLDivElement | null>(null);

  const status = $derived(repoStore.statuses[repoRoot] ?? null);
  const repoName = $derived(repoStore.repos.find((repo) => repo.root === repoRoot)?.name ?? "repository");
  const list = $derived(filterBranches(refs, query));
  const rows = $derived<PopupBranch[]>([
    ...list.local.map((branch) => ({ kind: "local" as const, branch })),
    ...list.remote.map((remoteBranch) => ({ kind: "remote" as const, remoteBranch })),
  ]);
  const context = $derived({
    current: status?.head.branch ?? null,
    busy: repoStore.busy !== null,
    operation: (status?.op.kind ?? "none") !== "none",
    hasRemotes: (refs?.remotes.length ?? 0) > 0,
  });

  onMount(() => {
    void loadDetails(repoRoot).then((details) => {
      refs = details.refs;
    });
  });

  // The active repository's branches stay fresh after an action elsewhere.
  $effect(() => {
    if (repoRoot === repoStore.repo?.root && repoStore.refs) {
      refs = repoStore.refs;
    }
  });

  $effect(() => {
    void query;
    highlighted = 0;
  });

  function close(): void {
    gitDialogs.close();
  }

  function target() {
    return repoTarget(repoRoot, refs);
  }

  function rowKey(row: PopupBranch): string {
    return row.kind === "local" ? `local:${row.branch.name}` : `remote:${row.remoteBranch.name}`;
  }

  function openSubmenu(index: number, keyboard: boolean): void {
    const row = rows[index];
    const element = listEl?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!row || !element) {
      return;
    }
    highlighted = index;
    const rect = element.getBoundingClientRect();
    const anchor = new MouseEvent("contextmenu", { clientX: rect.right - 4, clientY: rect.top });
    contextMenu.open(anchor, branchMenuItems(row, context, target(), repoRoot), { keyboard });
  }

  async function moveHighlight(step: number): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    highlighted = Math.max(0, Math.min(rows.length - 1, highlighted + step));
    await tick();
    listEl?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function onFilterKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      void moveHighlight(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" || (event.key === "ArrowRight" && query === "")) {
      event.preventDefault();
      openSubmenu(highlighted, true);
    }
  }

  function newBranch(): void {
    close();
    void newBranchFrom(null, "", target());
  }

  function checkoutRevision(): void {
    close();
    void checkoutTo(target(), repoRoot);
  }
</script>

<GitDialogFrame title="Branches ({repoName})" width={480} onCancel={close}>
  <input
    class="input filter"
    bind:value={query}
    onkeydown={onFilterKeydown}
    placeholder="Filter branches"
    spellcheck="false"
    autocomplete="off"
    aria-label="Filter branches"
    data-autofocus
  />
  <div class="actions-list">
    <button type="button" class="action" onclick={newBranch} disabled={context.busy || (status?.head.unborn ?? false)}>
      <Icon name="plus" size={13} /> New Branch...
    </button>
    <button type="button" class="action" onclick={checkoutRevision} disabled={context.busy || context.operation}>
      <Icon name="tag" size={13} /> Checkout Tag or Revision...
    </button>
  </div>
  <div class="branches" bind:this={listEl} role="listbox" aria-label="Branches">
    {#if refs === null}
      <div class="hint empty">Loading...</div>
    {:else if rows.length === 0}
      <div class="hint empty">No branches match</div>
    {/if}
    {#each rows as row, index (rowKey(row))}
      {#if index === 0 && row.kind === "local"}
        <div class="group">Local</div>
      {:else if row.kind === "remote" && (index === 0 || rows[index - 1].kind === "local")}
        <div class="group">Remote</div>
      {/if}
      <div
        class="branch"
        class:highlighted={index === highlighted}
        data-index={index}
        role="option"
        tabindex="-1"
        aria-selected={index === highlighted}
        onclick={() => openSubmenu(index, false)}
        onmouseenter={() => (highlighted = index)}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            openSubmenu(index, true);
          }
        }}
      >
        <Icon name={row.kind === "local" && row.branch.isHead ? "check" : "branch"} size={13} />
        {#if row.kind === "local"}
          <span class="name truncate" class:current={row.branch.isHead}>{row.branch.name}</span>
          <span class="hint truncate">{trackingHint(row.branch)}</span>
        {:else}
          <span class="name truncate">{row.remoteBranch.name}</span>
          <span class="hint"></span>
        {/if}
        <Icon name="chevron-right" size={12} />
      </div>
    {/each}
  </div>

  {#snippet footer()}
    <span class="hint">Enter or Right opens the branch's actions</span>
    <span class="spacer"></span>
    <button type="button" class="btn" onclick={close}>Close</button>
  {/snippet}
</GitDialogFrame>

<style>
  .filter {
    width: 100%;
  }

  .actions-list {
    display: flex;
    flex-direction: column;
  }

  .action {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border: none;
    border-radius: var(--radius);
    background: none;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .action:hover:not(:disabled) {
    background: var(--hover);
  }

  .action:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .branches {
    max-height: 46vh;
    overflow-y: auto;
    border-top: 1px solid var(--border);
    padding-top: 4px;
  }

  .group {
    padding: 6px 8px 2px;
    color: var(--text-faint);
    font-size: 11.5px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .branch {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) minmax(0, auto) 14px;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: var(--radius);
    cursor: pointer;
  }

  .branch.highlighted {
    background: var(--selected);
  }

  .name.current {
    font-weight: 600;
  }

  .branch .hint {
    max-width: 200px;
  }

  .empty {
    padding: 8px;
  }
</style>
