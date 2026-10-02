<script lang="ts">
  import Icon from "$lib/ui/Icon.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { applyStash, dropStash, newBranchFrom } from "./actions";
  import { openNewWorktreeDialog } from "../git/worktrees/worktreeActions";
  import { worktreeLabel, worktreeTooltip } from "../git/worktrees/worktreeModel";
  import type { SidebarRow } from "./tree";

  let { row }: { row: SidebarRow } = $props();

  const busy = $derived(repoStore.busy !== null);

  function stop(event: Event): void {
    event.stopPropagation();
  }

  function localTooltip(): string {
    if (row.kind !== "local") {
      return "";
    }
    const branch = row.branch;
    const parts = [branch.name];
    if (branch.shortId) {
      parts.push(`at ${branch.shortId}`);
    }
    parts.push(branch.upstream ? `tracking ${branch.upstream}` : "no upstream");
    if (branch.ahead > 0) {
      parts.push(`${branch.ahead} ahead`);
    }
    if (branch.behind > 0) {
      parts.push(`${branch.behind} behind`);
    }
    return parts.join(", ");
  }
</script>

{#if row.kind === "section"}
  <span class="chevron"><Icon name={row.expanded ? "chevron-down" : "chevron-right"} size={12} /></span>
  <span class="section-label">{row.label}</span>
  <span class="count">{row.count}</span>
  <span class="spacer"></span>
  {#if row.section === "local"}
    <button
      class="icon-btn row-btn"
      title="New branch from HEAD"
      disabled={busy}
      onclick={(event) => {
        stop(event);
        void newBranchFrom(null);
      }}
      ondblclick={stop}
    >
      <Icon name="plus" size={13} />
    </button>
  {:else if row.section === "worktrees"}
    <button
      class="icon-btn row-btn"
      title="New worktree"
      disabled={busy}
      onclick={(event) => {
        stop(event);
        openNewWorktreeDialog();
      }}
      ondblclick={stop}
    >
      <Icon name="plus" size={13} />
    </button>
  {/if}
{:else if row.kind === "group"}
  <span class="chevron"><Icon name={row.expanded ? "chevron-down" : "chevron-right"} size={12} /></span>
  <span class="icon dim"><Icon name={row.icon} size={14} /></span>
  <span class="label truncate">{row.label}</span>
  <span class="count">{row.count}</span>
{:else if row.kind === "local"}
  <span class="icon" class:current={row.branch.isHead}>
    <Icon name={row.branch.isHead ? "check" : "branch"} size={14} />
  </span>
  <span class="label truncate" class:strong={row.branch.isHead} title={localTooltip()}>{row.label}</span>
  {#if row.branch.ahead > 0 || row.branch.behind > 0}
    <span class="sync dim">
      {#if row.branch.ahead > 0}
        <span title="Commits to push">{row.branch.ahead}<Icon name="arrow-up" size={10} /></span>
      {/if}
      {#if row.branch.behind > 0}
        <span title="Commits to pull">{row.branch.behind}<Icon name="arrow-down" size={10} /></span>
      {/if}
    </span>
  {/if}
{:else if row.kind === "remote"}
  <span class="icon dim"><Icon name="branch" size={14} /></span>
  <span class="label truncate" title={row.branch.name}>{row.label}</span>
{:else if row.kind === "tag"}
  <span class="icon dim"><Icon name="tag" size={14} /></span>
  <span class="label truncate" title={row.tagName}>{row.label}</span>
{:else if row.kind === "stash"}
  <span class="icon dim"><Icon name="stash" size={14} /></span>
  <span class="label truncate" title={row.stash.message}>{row.stash.message}</span>
  <span class="stash-ref dim">stash@&#123;{row.stash.index}&#125;</span>
  <span class="stash-actions">
    <button
      class="icon-btn row-btn"
      title="Apply stash"
      disabled={busy}
      onclick={(event) => {
        stop(event);
        void applyStash(row.stash.index, false);
      }}
      ondblclick={stop}
    >
      <Icon name="check" size={13} />
    </button>
    <button
      class="icon-btn row-btn"
      title="Pop stash (apply and drop)"
      disabled={busy}
      onclick={(event) => {
        stop(event);
        void applyStash(row.stash.index, true);
      }}
      ondblclick={stop}
    >
      <Icon name="arrow-up" size={13} />
    </button>
    <button
      class="icon-btn row-btn danger"
      title="Drop stash"
      disabled={busy}
      onclick={(event) => {
        stop(event);
        void dropStash(row.stash);
      }}
      ondblclick={stop}
    >
      <Icon name="x" size={13} />
    </button>
  </span>
{:else if row.kind === "worktree"}
  <span class="icon" class:current={row.worktree.isCurrent} class:dim={!row.worktree.isCurrent}>
    <Icon name={row.worktree.isCurrent ? "check" : "folder-git"} size={14} />
  </span>
  <span class="label truncate" class:strong={row.worktree.isCurrent} class:gone={row.worktree.prunable} title={worktreeTooltip(row.worktree)}>
    {worktreeLabel(row.worktree)}
    <span class="worktree-path dim">{row.worktree.path}</span>
  </span>
  {#if row.worktree.locked}
    <span class="wt-tag dim" title={row.worktree.lockReason ?? "Locked"}>locked</span>
  {:else if row.worktree.prunable}
    <span class="wt-tag dim" title={row.worktree.prunableReason ?? "Its folder is gone"}>prunable</span>
  {:else if row.worktree.isMain}
    <span class="wt-tag dim">main</span>
  {/if}
{:else}
  <span class="empty dim">{row.label}</span>
{/if}

<style>
  .chevron {
    display: inline-flex;
    width: 14px;
    flex: none;
    color: var(--text-dim);
  }

  .icon {
    display: inline-flex;
    flex: none;
  }

  .icon.current {
    color: var(--accent);
  }

  .label {
    flex: 1;
    min-width: 0;
  }

  .strong {
    font-weight: 600;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .count {
    flex: none;
    font-size: 11px;
    color: var(--text-faint);
  }

  .spacer {
    flex: 1;
  }

  .sync {
    display: inline-flex;
    flex: none;
    gap: 4px;
    font-size: 11px;
  }

  .sync span {
    display: inline-flex;
    align-items: center;
  }

  .stash-ref {
    flex: none;
    font-size: 11px;
  }

  .stash-actions {
    display: none;
    flex: none;
    gap: 1px;
  }

  :global(.sidebar-row:hover) .stash-actions,
  :global(.sidebar-row.selected) .stash-actions {
    display: inline-flex;
  }

  :global(.sidebar-row:hover) .stash-ref,
  :global(.sidebar-row.selected) .stash-ref {
    display: none;
  }

  .row-btn {
    height: 20px;
    min-width: 20px;
    padding: 0 3px;
    color: var(--text-dim);
  }

  .row-btn:hover:not(:disabled) {
    color: var(--text);
  }

  .row-btn.danger:hover:not(:disabled) {
    color: var(--danger);
  }

  .wt-tag {
    flex: none;
    font-size: 11px;
  }

  .worktree-path {
    margin-left: 6px;
    font-size: 11.5px;
  }

  .gone {
    text-decoration: line-through;
    text-decoration-color: var(--text-faint);
  }

  .empty {
    font-style: italic;
    padding-left: 2px;
  }
</style>
