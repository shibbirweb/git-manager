<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { abortOperation, continueOperation, skipRebaseCommit } from "./git/operationActions";

  const op = $derived(repoStore.status?.op);
  const conflicts = $derived(repoStore.conflictCount);
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
        <button class="btn small primary" onclick={() => void continueOperation()}>Continue</button>
      {/if}
      {#if op.kind === "rebase"}
        <button class="btn small" onclick={() => void skipRebaseCommit()}>Skip Commit</button>
      {/if}
      {#if op.kind !== "other"}
        <button class="btn small" onclick={() => void abortOperation()}>Abort</button>
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
