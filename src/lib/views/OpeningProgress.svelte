<!-- Progress while a folder opens: the scan for repositories can take a while in a big folder, and there is nothing else to show yet. -->
<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";

  /** Shown only for slow opens, so a quick one does not flash. */
  const SHOW_AFTER_MS = 150;
  const SLOW_AFTER_MS = 4000;

  let visible = $state(false);
  let slow = $state(false);

  $effect(() => {
    const opening = repoStore.opening !== null;
    if (!opening) {
      visible = false;
      slow = false;
      return;
    }
    const showTimer = setTimeout(() => (visible = true), SHOW_AFTER_MS);
    const slowTimer = setTimeout(() => (slow = true), SLOW_AFTER_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(slowTimer);
    };
  });
</script>

{#if repoStore.opening && visible}
  <div class="backdrop" role="presentation">
    <div class="card" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <div class="text">
        <div class="title truncate">{repoStore.opening.title}</div>
        <div class="step truncate">{repoStore.opening.step}</div>
        {#if slow}
          <div class="hint">Big folders take a moment. Folders such as node_modules are skipped.</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay);
    animation: fade-in 0.15s ease-out;
  }

  .card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: min(380px, calc(100vw - 32px));
    padding: 16px 18px;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    box-shadow: var(--shadow);
  }

  .text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .title {
    font-weight: 600;
  }

  .step {
    color: var(--text-dim);
    font-size: 12.5px;
  }

  .hint {
    margin-top: 6px;
    color: var(--text-faint);
    font-size: 12px;
    line-height: 1.4;
  }

  .spinner {
    flex: none;
    width: 18px;
    height: 18px;
    margin-top: 1px;
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

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
</style>
