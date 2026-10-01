<!-- Shown where a view needs a git repository but the workspace has none. -->
<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import Icon from "$lib/ui/Icon.svelte";

  let { compact = false }: { compact?: boolean } = $props();
</script>

<div class="no-repo" class:compact>
  <div class="icon"><Icon name="folder-git" size={compact ? 20 : 28} /></div>
  <p class="title">{compact ? "No repository" : "This folder has no git repository"}</p>
  {#if !compact}
    <p class="dim">Initialize one here, or add a repository inside the folder and scan again.</p>
  {/if}
  <div class="actions">
    <button
      class="btn primary"
      class:small={compact}
      onclick={() => repoStore.workspace && void repoStore.initRepository(repoStore.workspace.root)}
    >
      Initialize Repository
    </button>
    <button class="btn" class:small={compact} onclick={() => void repoStore.rediscover()}>Scan Again</button>
  </div>
</div>

<style>
  .no-repo {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
    max-width: 420px;
    text-align: center;
  }

  .no-repo.compact {
    padding: 20px 12px;
  }

  .icon {
    color: var(--text-faint);
  }

  .title {
    margin: 0;
    font-weight: 600;
  }

  p {
    margin: 0;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 6px;
  }
</style>
