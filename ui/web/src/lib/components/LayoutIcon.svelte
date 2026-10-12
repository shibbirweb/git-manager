<!-- The drawn layout glyphs of the header and Changes title bar: a window with its left or right sidebar (filled
     while shown), and the commit box layouts (one at the foot, or one per repository). -->
<script lang="ts">
  import { iconPx, type IconSize } from "../logic/presets";

  interface Props {
    kind: "sidebar-left" | "sidebar-right" | "commit-single" | "commit-per-repo";
    active?: boolean;
    size?: IconSize;
  }

  let { kind, active = false, size = "large" }: Props = $props();

  const side = $derived(kind === "sidebar-left" ? "left" : "right");
</script>

<svg
  width={iconPx(size)}
  height={iconPx(size)}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  aria-hidden="true"
>
  <rect x="3" y="4" width="18" height="16" rx="2" />
  {#if kind === "sidebar-left" || kind === "sidebar-right"}
    <path d="M{side === 'left' ? 9 : 15} 4v16" />
    {#if active}
      <rect x={side === "left" ? 4 : 15} y="5" width="5" height="14" fill="currentColor" stroke="none" />
    {/if}
  {:else if kind === "commit-per-repo"}
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
