<!--
  An image or PDF from the work tree, loaded lazily by FileView. The img or iframe loads it from
  the gmpreview scheme, so its bytes never enter JavaScript; unmounting (tab hidden or closed)
  removes the element, and WebKit frees the picture or document. PDFs use WebKit's own viewer.
-->
<script lang="ts">
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import { onDestroy, untrack } from "svelte";
  import { errorMessage } from "$lib/api";
  import Icon from "$lib/ui/Icon.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { platformName } from "$lib/update/releases";
  import { formatSize } from "../git/lfs/lfsModel";
  import { fitZoom, nextZoom, type PreviewInfo, tooLargeText, zoomLabel } from "./mediaPreview";
  import { openPreview } from "./previewScheme";
  import { revealLabel } from "./reveal";

  interface Props {
    /** Absolute path, inside a workspace folder. */
    filePath: string;
    preview: PreviewInfo;
    /** Bumped by FileView when the file may have changed on disk. */
    reloadToken: number;
  }

  let { filePath, preview, reloadToken }: Props = $props();

  const REVEAL_LABEL = revealLabel(platformName(navigator.userAgent));
  const name = $derived(filePath.slice(filePath.lastIndexOf("/") + 1));

  let url = $state<string | null>(null);
  let error = $state<string | null>(null);
  let size = $state(0);
  let natural = $state<{ width: number; height: number } | null>(null);
  /** null fits the image to the view. */
  let zoom = $state<number | null>(null);
  let boxWidth = $state(0);
  let boxHeight = $state(0);
  let frame = $state<HTMLIFrameElement | null>(null);
  let image = $state<HTMLImageElement | null>(null);
  let request = 0;

  const fitted = $derived(natural ? fitZoom(natural.width, natural.height, boxWidth - 32, boxHeight - 32) : 1);
  const shownZoom = $derived(zoom ?? fitted);

  async function load(version: number): Promise<void> {
    const current = ++request;
    try {
      const opened = await openPreview({ kind: "worktree", filePath }, version);
      if (current !== request) {
        return;
      }
      size = opened.stat.size;
      if (!opened.stat.exists) {
        url = null;
        error = "The file is not there any more.";
      } else if (opened.stat.limit !== null) {
        url = null;
        error = tooLargeText(opened.stat.limit);
      } else {
        url = opened.url;
        error = null;
      }
    } catch (cause) {
      if (current === request) {
        url = null;
        error = errorMessage(cause);
      }
    }
  }

  $effect(() => {
    const version = reloadToken;
    void filePath;
    untrack(() => void load(version));
  });

  onDestroy(() => {
    request++;
    // Blank the frame first, so WebKit drops the PDF document before the element goes.
    if (frame) {
      frame.src = "about:blank";
    }
    image?.removeAttribute("src");
  });

  function onImageLoad(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    natural = { width: image.naturalWidth, height: image.naturalHeight };
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

  async function reveal(): Promise<void> {
    try {
      await revealItemInDir(filePath);
    } catch (cause) {
      toast.error(`${REVEAL_LABEL} failed`, errorMessage(cause));
    }
  }
</script>

<div class="media">
  <div class="bar" role="toolbar" aria-label="Preview">
    {#if preview.kind === "image"}
      <button class="btn small icon-only" onclick={() => zoomBy(-1)} disabled={!natural} title="Zoom out" aria-label="Zoom out">
        <Icon name="minus" size={13} />
      </button>
      <span class="zoom" aria-live="polite">{natural ? zoomLabel(shownZoom) : ""}</span>
      <button class="btn small icon-only" onclick={() => zoomBy(1)} disabled={!natural} title="Zoom in" aria-label="Zoom in">
        <Icon name="plus" size={13} />
      </button>
      <button class="btn small" class:on={zoom === null} onclick={() => (zoom = null)} disabled={!natural} title="Fit the image in the view">
        Fit
      </button>
      <button class="btn small" class:on={zoom === 1} onclick={() => (zoom = 1)} disabled={!natural} title="Show the image at its real size">
        100%
      </button>
    {/if}
    <span class="info dim">
      {#if natural}{natural.width} x {natural.height} px,{/if}
      {#if size > 0}{formatSize(size)}{/if}
    </span>
    <button class="btn small" onclick={() => void reveal()}>{REVEAL_LABEL}</button>
  </div>

  {#if error}
    <div class="message dim selectable">{error}</div>
  {:else if !url}
    <div class="message dim">Loading...</div>
  {:else if preview.kind === "image"}
    <div class="canvas" bind:clientWidth={boxWidth} bind:clientHeight={boxHeight} onwheel={onWheel}>
      <img
        bind:this={image}
        src={url}
        alt={name}
        draggable="false"
        style:width={natural ? `${Math.max(1, Math.round(natural.width * shownZoom))}px` : null}
        onload={onImageLoad}
        onerror={() => (error = "This image could not be shown. The file may be damaged or in a format WebKit does not support.")}
      />
    </div>
  {:else}
    <iframe bind:this={frame} class="pdf" src={url} title={name}></iframe>
  {/if}
</div>

<style>
  .media {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* As low as the Markdown toolbar, under FileView's path bar. */
  .bar {
    flex: none;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px 4px;
    min-height: 28px;
    padding: 2px 8px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  .bar .btn.small {
    height: 22px;
  }

  .bar .btn.icon-only {
    width: 24px;
    padding: 0;
    justify-content: center;
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

  .info {
    margin-left: auto;
    font-size: 12px;
  }

  .message {
    padding: 16px;
    font-size: 12px;
  }

  .canvas {
    flex: 1;
    min-height: 0;
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
    image-rendering: auto;
    box-shadow: 0 0 0 1px var(--border);
  }

  .pdf {
    flex: 1;
    min-height: 0;
    width: 100%;
    border: none;
    background: var(--editor-bg);
  }
</style>
