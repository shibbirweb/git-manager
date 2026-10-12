<!-- A stroke icon on a 24px grid, drawn in the current text color. -->
<script lang="ts">
  import { icons, type IconName } from "../icons";
  import { iconPx, type IconSize, type IconStroke } from "../logic/presets";
  import { toneColor, type Tone } from "../logic/scale";
  import { scales } from "../styles/tokens";

  interface Props {
    name: IconName;
    size?: IconSize;
    stroke?: IconStroke;
    tone?: Tone | "inherit";
  }

  let { name, size = "large", stroke = "normal", tone = "inherit" }: Props = $props();

  const px = $derived(iconPx(size));
</script>

<svg
  width={px}
  height={px}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={name === "more" ? scales.iconStroke.heavy : scales.iconStroke[stroke]}
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
