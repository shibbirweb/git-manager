<!-- Two versions of an image or PDF side by side, such as a binary file's change: each side has a head with its
     name and size, the images share one zoom and scroll together. A side with no file shows its `message`; an image
     that cannot load calls `onerror` with its side, so the caller can say why. -->
<script lang="ts">
  import { releaseMedia } from "../logic/releaseMedia";
  import { mediaInfo, nextZoom, sharedFit, syncedScroll, type NaturalSize } from "../logic/zoom";
  import { componentTokens } from "../styles/tokens";
  import ImageCanvas from "./ImageCanvas.svelte";
  import ZoomBar from "./ZoomBar.svelte";

  interface CompareSide {
    label: string;
    kind: "image" | "pdf" | "none";
    src?: string;
    info?: string;
    message?: string;
  }

  interface Props {
    sides: [CompareSide, CompareSide];
    zoom?: number | null;
    onerror?: (side: number) => void;
  }

  let { sides, zoom = $bindable(null), onerror }: Props = $props();

  let naturals = $state.raw<(NaturalSize | null)[]>([null, null]);
  let boxes = $state.raw([
    { width: 0, height: 0 },
    { width: 0, height: 0 },
  ]);
  let canvases = $state<(HTMLDivElement | null)[]>([null, null]);
  let echo: number | null = null;

  const inset = componentTokens.mediaView.padding * 2;
  const fitted = $derived(
    sharedFit(
      naturals,
      Math.min(boxes[0].width, boxes[1].width) - inset,
      Math.min(boxes[0].height, boxes[1].height) - inset,
    ),
  );
  const imageShown = $derived(sides.some((side) => side.kind === "image"));

  function measure(index: number, natural: NaturalSize | null, box: { width: number; height: number }): void {
    naturals = naturals.map((value, at) => (at === index ? natural : value));
    boxes = boxes.map((value, at) => (at === index ? box : value));
  }

  // Scrolling one side scrolls the other to the same place; the echo of that scroll is ignored.
  function scrolled(index: number): void {
    if (echo === index) {
      echo = null;
      return;
    }
    const from = canvases[index];
    const to = canvases[1 - index];
    if (!from || !to) {
      return;
    }
    const next = syncedScroll(from, to);
    if (to.scrollLeft === next.left && to.scrollTop === next.top) {
      return;
    }
    echo = 1 - index;
    to.scrollLeft = next.left;
    to.scrollTop = next.top;
    requestAnimationFrame(() => {
      echo = null;
    });
  }
</script>

<div class="compare">
  {#if imageShown}
    <div class="bar" role="toolbar" aria-label="Preview">
      <ZoomBar
        bind:zoom
        {fitted}
        disabled={!naturals.some((natural) => natural !== null)}
        fitTitle="Fit both images in the view"
        actualTitle="Show both images at their real size"
      />
    </div>
  {/if}
  <div class="sides">
    {#each sides as side, index (index)}
      {@const info = mediaInfo(side.kind === "image" ? naturals[index] : null, side.info ?? "")}
      <div class="side">
        <div class="head">
          <span class="label" title={side.label}>{side.label}</span>
          {#if info}<span class="info">{info}</span>{/if}
        </div>
        <div class="body">
          {#if side.kind === "image" && side.src}
            <ImageCanvas
              src={side.src}
              alt={side.label}
              scale={zoom ?? fitted}
              bind:element={canvases[index]}
              onmeasure={(natural, box) => measure(index, natural, box)}
              onzoom={(direction) => (zoom = nextZoom(zoom ?? fitted, direction))}
              onscroll={() => scrolled(index)}
              onerror={() => onerror?.(index)}
            />
          {:else if side.kind === "pdf" && side.src}
            <iframe use:releaseMedia class="pdf" src={side.src} title={side.label}></iframe>
          {:else}
            <div class="message">{side.message ?? ""}</div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .compare {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-self: stretch;
  }

  .bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--media-view-bar-gap-x);
    padding: var(--media-view-compare-bar-padding-y) var(--media-view-compare-bar-padding-x);
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  .sides {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .side {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .side + .side {
    border-left: 1px solid var(--border-strong);
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--media-view-head-gap);
    height: var(--media-view-head-height);
    padding: 0 var(--media-view-head-padding-x);
    border-bottom: 1px solid var(--border);
    background: var(--panel-alt);
    color: var(--text-dim);
    font-size: var(--font-size-compact);
  }

  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .info {
    margin-left: auto;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .pdf {
    flex: 1;
    min-width: 0;
    border: none;
    background: var(--editor-bg);
  }

  .message {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-11);
    text-align: center;
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }
</style>
