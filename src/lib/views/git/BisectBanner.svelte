<!-- Shown while the active repository is bisecting: how far along it is, the marks for the
     checked out commit and, once git names it, the first bad commit. -->
<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { bisectStore } from "./bisect.svelte";
  import { markBisect, resetBisect, showFirstBad } from "./bisectActions";
  import { bisectBannerText } from "./bisectBanner";

  const repoRoot = $derived(repoStore.repo?.root ?? null);
  const fingerprint = $derived(repoRoot ? (repoStore.statuses[repoRoot]?.bisect ?? null) : null);
  const bisect = $derived(fingerprint !== null ? bisectStore.forRepo(repoRoot) : null);
  const busy = $derived(repoStore.busy !== null);
  const currentShort = $derived(bisect?.current?.slice(0, 8) ?? null);

  $effect(() => {
    if (repoRoot) {
      void bisectStore.sync(repoRoot, fingerprint);
    }
  });
</script>

{#if bisect}
  <div class="banner" class:found={bisect.firstBad !== null}>
    <Icon name="bug" size={15} />
    <span class="text">
      <strong>{bisectBannerText(bisect)}</strong>
      {#if !bisect.firstBad && currentShort}
        <span class="dim">&middot; testing <span class="mono">{currentShort}</span></span>
      {/if}
    </span>
    <div class="actions">
      {#if bisect.firstBad}
        <button class="btn small primary" onclick={() => showFirstBad(repoRoot)}>Show Commit</button>
      {:else}
        <button class="btn small" disabled={busy} onclick={() => void markBisect("good")} title="The checked out commit works">
          Good
        </button>
        <button class="btn small" disabled={busy} onclick={() => void markBisect("bad")} title="The checked out commit has the problem">
          Bad
        </button>
        <button class="btn small" disabled={busy} onclick={() => void markBisect("skip")} title="This commit cannot be tested">Skip</button>
      {/if}
      <button class="btn small" disabled={busy} onclick={() => void resetBisect()} title="End the bisect and go back to {bisect.start}">
        Reset
      </button>
    </div>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: color-mix(in srgb, var(--warning) 12%, var(--panel));
    border-bottom: 1px solid var(--border-strong);
    color: var(--warning);
  }

  .banner.found {
    background: color-mix(in srgb, var(--success) 12%, var(--panel));
    color: var(--success);
  }

  .text {
    flex: 1;
    min-width: 0;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    gap: 6px;
  }
</style>
