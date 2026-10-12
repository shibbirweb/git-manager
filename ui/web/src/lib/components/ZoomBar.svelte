<!-- An image preview's zoom controls: zoom out, the zoom in percent, zoom in, Fit and 100%. `zoom` is null while the
     image fits the view; `fitted` is that fitting zoom, shown in the label. -->
<script lang="ts">
  import { nextZoom, zoomLabel } from "../logic/zoom";
  import Button from "./Button.svelte";

  interface Props {
    zoom?: number | null;
    fitted?: number;
    disabled?: boolean;
    fitTitle?: string;
    actualTitle?: string;
  }

  let {
    zoom = $bindable(null),
    fitted = 1,
    disabled = false,
    fitTitle = "Fit the image in the view",
    actualTitle = "Show the image at its real size",
  }: Props = $props();

  const shown = $derived(zoom ?? fitted);
</script>

<Button
  size="tiny"
  icon="minus"
  title="Zoom out"
  aria-label="Zoom out"
  {disabled}
  onclick={() => (zoom = nextZoom(shown, -1))}
/>
<span class="zoom" aria-live="polite">{disabled ? "" : zoomLabel(shown)}</span>
<Button
  size="tiny"
  icon="plus"
  title="Zoom in"
  aria-label="Zoom in"
  {disabled}
  onclick={() => (zoom = nextZoom(shown, 1))}
/>
<Button size="tiny" pressed={zoom === null} title={fitTitle} {disabled} onclick={() => (zoom = null)}>Fit</Button>
<Button size="tiny" pressed={zoom === 1} title={actualTitle} {disabled} onclick={() => (zoom = 1)}>100%</Button>

<style>
  .zoom {
    min-width: var(--media-view-zoom-width);
    text-align: center;
    font-size: var(--font-size-small);
    font-variant-numeric: tabular-nums;
  }
</style>
