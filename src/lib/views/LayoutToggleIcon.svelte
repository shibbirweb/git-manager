<!-- Layout icon: a window with one side marked; the side is filled while that sidebar is visible. -->
<script lang="ts">
  let { side, visible, size = 16 }: { side: "left" | "right"; visible: boolean; size?: number } = $props();

  const barX = $derived(side === "left" ? 4 : 15);
  const lineX = $derived(side === "left" ? 9 : 15);
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
  <rect x="3" y="4" width="18" height="16" rx="2" />
  <path d="M{lineX} 4v16" />
  {#if visible}
    <rect x={barX} y="5" width="5" height="14" fill="currentColor" stroke="none" />
  {/if}
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
