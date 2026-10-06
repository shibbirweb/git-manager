<!-- Commit box layout icon: a panel with one commit box at its foot, or a box at the top of each repository. -->
<script lang="ts">
  let { perRepo, size = 15 }: { perRepo: boolean; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
  <rect x="3" y="4" width="18" height="16" rx="2" />
  {#if perRepo}
    <path d="M3 12h18" />
    <rect x="6" y="6.5" width="12" height="3" rx="1" fill="currentColor" stroke="none" />
    <rect x="6" y="14.5" width="12" height="3" rx="1" fill="currentColor" stroke="none" />
  {:else}
    <path d="M7 8.5h10" />
    <path d="M7 11.5h7" />
    <rect x="6" y="14.5" width="12" height="3" rx="1" fill="currentColor" stroke="none" />
  {/if}
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
