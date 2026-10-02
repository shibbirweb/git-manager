<!--
  The old (left) and new (right) version of a binary image or PDF in a diff, loaded lazily by
  DiffView while the diff is on screen. Both come from the gmpreview scheme, so no bytes enter
  JavaScript; unmounting removes the img and iframe elements, and WebKit frees what they held.
  The two images share one zoom and scroll together.
-->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { errorMessage } from "$lib/api";
  import Icon from "$lib/ui/Icon.svelte";
  import { nextZoom, previewOf, type PreviewKind, zoomLabel } from "$lib/views/files/mediaPreview";
  import { type OpenedPreview, openPreview } from "$lib/views/files/previewScheme";
  import { sourceName } from "$lib/views/files/previewSource";
  import {
    type NaturalSize,
    type PreviewSides,
    type SideRole,
    sharedFit,
    sideInfo,
    sideState,
    syncedScroll,
  } from "./binaryPreview";

  interface Props {
    sides: PreviewSides;
    leftLabel: string;
    rightLabel: string;
    /** The diff's path, for the kind when a side has none of its own. */
    path: string;
  }

  let { sides, leftLabel, rightLabel, path }: Props = $props();

  type Loaded = OpenedPreview | { error: string } | null;

  const ROLES: SideRole[] = ["original", "modified"];

  let loaded = $state.raw<Loaded[]>([null, null]);
  let naturals = $state.raw<(NaturalSize | null)[]>([null, null]);
  /** null fits both images to their boxes at one scale. */
  let zoom = $state<number | null>(null);
  let boxWidths = $state([0, 0]);
  let boxHeights = $state([0, 0]);
  let canvases = $state<(HTMLDivElement | null)[]>([null, null]);
  let frames = $state<(HTMLIFrameElement | null)[]>([null, null]);
  let images = $state<(HTMLImageElement | null)[]>([null, null]);
  let request = 0;
  /** The side whose next scroll event came from syncing, not from the user. */
  let echo: number | null = null;

  const sources = $derived([sides.original, sides.modified]);
  const labels = $derived([leftLabel, rightLabel]);
  // A string, so a new but equal `sides` object does not load the files again.
  const loadKey = $derived(JSON.stringify([sides.original, sides.modified, sides.version ?? 0]));
  const states = $derived(ROLES.map((role, index) => sideState(role, labels[index], sources[index], loaded[index])));
  const kinds = $derived(
    sources.map((source): PreviewKind | null => previewOf(source?.filePath ?? path)?.kind ?? previewOf(path)?.kind ?? null),
  );
  const imageShown = $derived(states.some((state, index) => state.status === "ready" && kinds[index] === "image"));
  const measured = $derived(naturals.some((natural) => natural !== null));
  const fitted = $derived(
    sharedFit(naturals, Math.min(boxWidths[0], boxWidths[1]) - 32, Math.min(boxHeights[0], boxHeights[1]) - 32),
  );
  const shownZoom = $derived(zoom ?? fitted);

  async function load(version: number): Promise<void> {
    const current = ++request;
    const results = await Promise.all(
      [sides.original, sides.modified].map(async (source): Promise<Loaded> => {
        if (!source) {
          return null;
        }
        try {
          return await openPreview(source, version);
        } catch (cause) {
          return { error: errorMessage(cause) };
        }
      }),
    );
    if (current === request) {
      loaded = results;
    }
  }

  $effect(() => {
    void loadKey;
    untrack(() => void load(sides.version ?? 0));
  });

  onDestroy(() => {
    request++;
    // Blank the frames first, so WebKit drops the PDF documents before the elements go.
    for (const frame of frames) {
      if (frame) {
        frame.src = "about:blank";
      }
    }
    for (const image of images) {
      image?.removeAttribute("src");
    }
  });

  function onImageLoad(index: number, event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    const next = [...naturals];
    next[index] = { width: image.naturalWidth, height: image.naturalHeight };
    naturals = next;
  }

  function onImageError(index: number): void {
    const next = [...loaded];
    next[index] = { error: "This image could not be shown. The file may be damaged or in a format WebKit does not support." };
    loaded = next;
  }

  function zoomBy(direction: 1 | -1): void {
    zoom = nextZoom(shownZoom, direction);
  }

  function onWheel(event: WheelEvent): void {
    // Pinch on a trackpad arrives as Ctrl + wheel; Cmd + wheel works too.
    if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0) {
      return;
    }
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1 : -1);
  }

  function onScroll(index: number): void {
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
    // A position the browser clamps fires no event; do not swallow the next real one.
    requestAnimationFrame(() => {
      echo = null;
    });
  }

  function imageWidth(index: number): string | null {
    const natural = naturals[index];
    return natural ? `${Math.max(1, Math.round(natural.width * shownZoom))}px` : null;
  }
</script>

<div class="binary-preview">
  {#if imageShown}
    <div class="bar" role="toolbar" aria-label="Preview">
      <button class="btn small icon-only" onclick={() => zoomBy(-1)} disabled={!measured} title="Zoom out" aria-label="Zoom out">
        <Icon name="minus" size={13} />
      </button>
      <span class="zoom" aria-live="polite">{measured ? zoomLabel(shownZoom) : ""}</span>
      <button class="btn small icon-only" onclick={() => zoomBy(1)} disabled={!measured} title="Zoom in" aria-label="Zoom in">
        <Icon name="plus" size={13} />
      </button>
      <button class="btn small" class:on={zoom === null} onclick={() => (zoom = null)} disabled={!measured} title="Fit both images in the view">
        Fit
      </button>
      <button class="btn small" class:on={zoom === 1} onclick={() => (zoom = 1)} disabled={!measured} title="Show both images at their real size">
        100%
      </button>
    </div>
  {/if}
  <div class="sides">
    {#each ROLES as role, index (role)}
      {@const shown = states[index]}
      {@const source = sources[index]}
      <div class="side">
        <div class="head">
          <span class="label truncate" title={labels[index]}>{labels[index]}</span>
          {#if shown.status === "ready"}
            <span class="info">{sideInfo(kinds[index] === "image" ? naturals[index] : null, shown.size)}</span>
          {/if}
        </div>
        <div class="body" bind:clientWidth={boxWidths[index]} bind:clientHeight={boxHeights[index]}>
          {#if shown.status === "ready" && source && kinds[index] === "image"}
            <div class="canvas" bind:this={canvases[index]} onwheel={onWheel} onscroll={() => onScroll(index)}>
              <img
                bind:this={images[index]}
                src={shown.url}
                alt={`${sourceName(source)} (${labels[index]})`}
                draggable="false"
                style:width={imageWidth(index)}
                onload={(event) => onImageLoad(index, event)}
                onerror={() => onImageError(index)}
              />
            </div>
          {:else if shown.status === "ready" && source}
            <iframe bind:this={frames[index]} class="pdf" src={shown.url} title={`${sourceName(source)} (${labels[index]})`}></iframe>
          {:else if shown.status === "loading"}
            <div class="message dim">Loading...</div>
          {:else if shown.status === "absent"}
            <div class="message dim">{shown.text}</div>
          {:else if shown.status === "error"}
            <div class="message dim selectable">{shown.text}</div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .binary-preview {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  .zoom {
    min-width: 44px;
    text-align: center;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .btn.on {
    background: var(--selected);
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
    gap: 8px;
    height: 24px;
    padding: 0 12px;
    border-bottom: 1px solid var(--border);
    background: var(--panel-alt);
    color: var(--text-dim);
    font-size: 11.5px;
  }

  .label {
    min-width: 0;
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

  .canvas {
    flex: 1;
    min-width: 0;
    overflow: auto;
    display: grid;
    place-items: center;
    padding: 16px;
    /* A checkerboard shows which parts of the image are transparent. */
    background-color: var(--editor-bg);
    background-image: conic-gradient(var(--hover) 25%, transparent 0 50%, var(--hover) 0 75%, transparent 0);
    background-size: 16px 16px;
  }

  .canvas img {
    display: block;
    max-width: none;
    box-shadow: 0 0 0 1px var(--border);
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
    padding: 24px;
    text-align: center;
    font-size: 12px;
  }
</style>
