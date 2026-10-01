<script lang="ts">
  import { api } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";

  const op = $derived(repoStore.status?.op);
  const conflicts = $derived(repoStore.conflictCount);

  async function continueOp(): Promise<void> {
    await repoStore.runOp("Continue", (repoPath) => api.continueOperation(repoPath), "Operation completed");
  }

  async function abortOp(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "Abort Operation",
      message: `${op?.description ?? "The current operation"} will be aborted and your branch restored to its state before it started.`,
      confirmLabel: "Abort",
      danger: true,
    });
    if (ok) {
      await repoStore.runOp("Abort", (repoPath) => api.abortOperation(repoPath), "Aborted");
    }
  }

  async function skip(): Promise<void> {
    await repoStore.runOp("Skip commit", (repoPath) => api.skipRebaseCommit(repoPath));
  }
</script>

{#if op && op.kind !== "none"}
  <div class="banner" class:has-conflicts={conflicts > 0}>
    <Icon name={conflicts > 0 ? "alert" : "merge"} size={15} />
    <span class="text">
      <strong>{op.description}</strong>
      {#if conflicts > 0}
        <span class="dim">&middot; {conflicts} {conflicts === 1 ? "file has" : "files have"} conflicts</span>
      {:else}
        <span class="dim">&middot; all conflicts resolved</span>
      {/if}
    </span>
    <div class="actions">
      {#if conflicts > 0}
        <button class="btn small primary" onclick={() => repoStore.openConflicts()}>Resolve Conflicts...</button>
      {:else if op.kind !== "other"}
        <button class="btn small primary" onclick={continueOp}>Continue</button>
      {/if}
      {#if op.kind === "rebase"}
        <button class="btn small" onclick={skip}>Skip Commit</button>
      {/if}
      {#if op.kind !== "other"}
        <button class="btn small" onclick={abortOp}>Abort</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: color-mix(in srgb, var(--accent) 12%, var(--panel));
    border-bottom: 1px solid var(--border-strong);
    color: var(--accent);
  }

  .banner.has-conflicts {
    background: color-mix(in srgb, var(--danger) 10%, var(--panel));
    color: var(--danger);
  }

  .text {
    flex: 1;
    min-width: 0;
    color: var(--text);
  }

  .actions {
    display: flex;
    gap: 6px;
  }
</style>
