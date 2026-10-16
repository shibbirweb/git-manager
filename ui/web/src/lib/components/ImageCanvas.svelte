<!-- An image on a checkerboard (so transparency shows), centered and scrollable, drawn at `scale` times its real
     size. It reports the image's real size and its own box so the caller can work out the fitting zoom, and asks
     to zoom on Cmd or Ctrl + wheel (and trackpad pinch). MediaView and MediaCompare are built on it. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { releaseMedia } from "../logic/releaseMedia";
  import type { NaturalSize } from "../logic/zoom";

  interface Props {
    src: string;
    alt: string;
    scale?: number | null;
    element?: HTMLDivElement | null;
    onmeasure?: (natural: NaturalSize | null, box: { width: number; height: number }) => void;
    onzoom?: (direction: 1 | -1) => void;
    onscroll?: () => void;
    onerror?: () => void;
  }

  let { src, alt, scale = null, element = $bindable(null), onmeasure, onzoom, onscroll, onerror }: Props = $props();

  let natural = $state.raw<NaturalSize | null>(null);
  let boxWidth = $state(0);
  let boxHeight = $state(0);

  // Report sizes when they change. The caller's handler runs untracked: it reads and writes its own state, which
  // would otherwise make this effect run again forever.
  $effect(() => {
    const size = natural;
    const box = { width: boxWidth, height: boxHeight };
    untrack(() => onmeasure?.(size, box));
  });

  function load(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    natural = { width: image.naturalWidth, height: image.naturalHeight };
  }

  function wheel(event: WheelEvent): void {
    // Pinch on a trackpad arrives as Ctrl + wheel; Cmd + wheel works too.
    if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0 || !onzoom) {
      return;
    }
    event.preventDefault();
    onzoom(event.deltaY < 0 ? 1 : -1);
  }
</script>

<div
  class="canvas"
  bind:this={element}
  bind:clientWidth={boxWidth}
  bind:clientHeight={boxHeight}
  onwheel={wheel}
  onscroll={() => onscroll?.()}
>
  <img
    use:releaseMedia
    {src}
    {alt}
    draggable="false"
    style:width={natural && scale !== null ? `${Math.max(1, Math.round(natural.width * scale))}px` : null}
    onload={load}
    onerror={() => onerror?.()}
  />
</div>

<style>
  .canvas {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    display: grid;
    place-items: center;
    padding: var(--media-view-padding);
    background-color: var(--editor-bg);
    background-image: conic-gradient(var(--hover) 25%, transparent 0 50%, var(--hover) 0 75%, transparent 0);
    background-size: var(--media-view-checker) var(--media-view-checker);
  }

  img {
    display: block;
    max-width: none;
    box-shadow: 0 0 0 1px var(--border);
  }
</style>
