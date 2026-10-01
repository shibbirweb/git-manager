<script lang="ts">
  import { icons, type IconName } from "./icons";

  let { name, size = 16, strokeWidth = 2 }: { name: IconName; size?: number; strokeWidth?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={name === "more" ? 3 : strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each icons[name] as path, index (index)}
    <path d={path} />
  {/each}
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
