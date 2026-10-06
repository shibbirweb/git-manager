<script lang="ts">
  // The repository row actions: branch, Sync, Commit, Refresh and "...".
  import { repoStore } from "$lib/stores/repo.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { commitDraft } from "./commitDraft.svelte";
  import { branchDecorations, branchTooltip, commitButtonTooltip, commitPlan } from "./repoMenu";
  import { commitFromRow, openBranchPicker, refreshRepoRow, repoMenuFor, stateOf, syncFromRow } from "./repoActions";
  import { branchLabel, type RepoSection } from "./sections";
  import { rowSync, rowSyncBadge, rowSyncTooltip } from "./sync";

  interface Props {
    section: RepoSection;
    /** Show the Commit (check) button; clean repositories leave it out. */
    showCommit?: boolean;
  }

  let { section, showCommit = true }: Props = $props();

  const repoRoot = $derived(section.repo.root);
  const head = $derived(section.status?.head ?? null);
  const busy = $derived(repoStore.busy !== null);
  const branchText = $derived(branchLabel(head));
  const decorations = $derived(branchDecorations(section));
  const sync = $derived(rowSync(head));
  const syncBadge = $derived(rowSyncBadge(sync));
  // Clean rows have no Commit button, so they do not create a draft.
  const plan = $derived.by(() => {
    if (!showCommit) {
      return null;
    }
    const draft = commitDraft.for(repoRoot);
    return commitPlan(stateOf(section), { message: draft.isBlank() ? "" : draft.message, amend: draft.amend });
  });
  let refreshing = $state(false);

  async function refresh(): Promise<void> {
    refreshing = true;
    try {
      await refreshRepoRow(repoRoot);
    } finally {
      refreshing = false;
    }
  }

  async function openMore(event: MouseEvent): Promise<void> {
    const anchor = event.currentTarget as HTMLElement;
    // A click from Enter or Space has no pointer position (detail 0).
    const keyboard = event.detail === 0;
    const items = await repoMenuFor(repoRoot);
    if (items.length > 0 && anchor.isConnected) {
      contextMenu.openBelow(anchor, items, { keyboard, alignEnd: true });
    }
  }
</script>

<span class="repo-row-actions">
  {#if section.status}
    <button
      class="action branch"
      class:detached={!head?.branch}
      onclick={() => void openBranchPicker(repoRoot)}
      disabled={busy}
      title={branchTooltip(branchText, section, head?.upstream ?? null)}
      aria-label="Checkout branch or tag, current {branchText}{decorations}"
    >
      <Icon name="branch" size={12} />
      <span class="branch-text truncate">{branchText}</span>
      {#if decorations}
        <span class="decorations">{decorations}</span>
      {/if}
    </button>
  {/if}
  {#if sync.kind !== "hidden"}
    <button
      class="action sync"
      onclick={() => void syncFromRow(repoRoot)}
      disabled={busy || (section.status?.op?.kind ?? "none") !== "none"}
      title={rowSyncTooltip(sync)}
      aria-label={sync.kind === "publish" ? "Publish Branch" : rowSyncTooltip(sync)}
    >
      <Icon name={sync.kind === "publish" ? "cloud-upload" : "sync"} size={13} />
      {#if syncBadge}
        <span class="sync-badge">{syncBadge}</span>
      {/if}
    </button>
  {/if}
  {#if plan}
    <button
      class="action"
      onclick={() => void commitFromRow(repoRoot)}
      disabled={busy || plan.kind === "blocked"}
      title={commitButtonTooltip(plan)}
      aria-label="Commit"
    >
      <Icon name="check" size={14} />
    </button>
  {/if}
  <button
    class="action"
    class:spinning={refreshing}
    onclick={() => void refresh()}
    title="Refresh"
    aria-label="Refresh {section.repo.name}"
  >
    <Icon name="refresh" size={13} />
  </button>
  <button
    class="action"
    onclick={(event) => void openMore(event)}
    title="More Actions..."
    aria-label="More actions for {section.repo.name}"
    aria-haspopup="menu"
  >
    <Icon name="more" size={14} />
  </button>
</span>

<style>
  .repo-row-actions {
    flex: 0 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .action {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 20px;
    height: 20px;
    padding: 0 3px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .action:hover:not(:disabled) {
    background: var(--border-strong);
    color: var(--text);
  }

  .action:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /*
   * A grid, so the name's track can shrink to nothing and the row's min-content leaves it out.
   * No width cap: a long name takes all the room the row leaves it, up to the repository name.
   */
  .branch {
    flex: 0 1 auto;
    display: inline-grid;
    grid-auto-flow: column;
    grid-template-columns: auto minmax(0, max-content);
    min-width: 20px;
    padding: 0 4px;
    font-size: 12px;
  }

  .branch-text {
    grid-area: 1 / 2;
    min-width: 0;
  }

  .branch.detached .branch-text {
    font-style: italic;
  }

  .decorations {
    grid-area: 1 / 3;
    font-weight: 600;
  }

  .sync-badge {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .spinning :global(svg) {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* A narrow sidebar drops the branch name first, then the sync counts. */
  @container repo-row (max-width: 300px) {
    .branch-text {
      display: none;
    }
  }

  @container repo-row (max-width: 220px) {
    .sync-badge {
      display: none;
    }
  }
</style>
