<!-- A stroke icon on a 24px grid, drawn in the current text color. -->
<script lang="ts">
  import { icons, type IconName } from "../icons";
  import { toneColor, type Tone } from "../logic/scale";

  interface Props {
    name: IconName;
    size?: number;
    strokeWidth?: number;
    tone?: Tone | "inherit";
  }

  let { name, size = 16, strokeWidth = 2, tone = "inherit" }: Props = $props();
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
  style:color={tone === "inherit" ? null : toneColor(tone)}
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
