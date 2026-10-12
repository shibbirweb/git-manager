<!-- A file that is not text: an image with zoom controls on a checkerboard, a PDF in the system viewer, or a card
     for any other file. The bar shows `info` (size, dimensions) and `actions` (Reveal in Finder). `zoom` is null
     while the image fits the view. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { fitZoom, nextZoom, type NaturalSize } from "../logic/zoom";
  import { componentTokens } from "../styles/tokens";
  import Icon from "./Icon.svelte";
  import ImageCanvas from "./ImageCanvas.svelte";
  import ZoomBar from "./ZoomBar.svelte";

  interface Props {
    kind: "image" | "pdf" | "binary";
    src?: string;
    name: string;
    info?: string;
    message?: string;
    zoom?: number | null;
    actions?: Snippet;
  }

  let { kind, src = "", name, info = "", message = "", zoom = $bindable(null), actions }: Props = $props();

  let natural = $state.raw<NaturalSize | null>(null);
  let box = $state.raw({ width: 0, height: 0 });
  let failed = $state(false);
  // The canvas's padding stays around a fitted image.
  const inset = componentTokens.mediaView.padding * 2;
  const fitted = $derived(fitZoom(natural, box.width - inset, box.height - inset));
  const shownInfo = $derived(natural ? `${natural.width} x ${natural.height} px${info ? `, ${info}` : ""}` : info);
</script>

<div class="media">
  {#if kind !== "binary"}
    <div class="bar" role="toolbar" aria-label="Preview">
      {#if kind === "image"}<ZoomBar bind:zoom {fitted} disabled={!natural} />{/if}
      <span class="info">{shownInfo}</span>
      {@render actions?.()}
    </div>
  {/if}
  {#if message || failed}
    <div class="message">{message || "This image could not be shown."}</div>
  {:else if kind === "image"}
    <ImageCanvas
      {src}
      alt={name}
      scale={zoom ?? fitted}
      onmeasure={(size, area) => {
        natural = size;
        box = area;
      }}
      onzoom={(direction) => (zoom = nextZoom(zoom ?? fitted, direction))}
      onerror={() => (failed = true)}
    />
  {:else if kind === "pdf"}
    <iframe class="pdf" title={name} {src}></iframe>
  {:else}
    <div class="binary">
      <Icon name="file" size="giant" tone="faint" />
      <span class="name">{name}</span>
      {#if info}<span class="detail">{info}</span>{/if}
      {@render actions?.()}
    </div>
  {/if}
</div>

<style>
  .media {
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
    flex-wrap: wrap;
    gap: var(--media-view-bar-gap-y) var(--media-view-bar-gap-x);
    min-height: var(--media-view-bar-min-height);
    padding: var(--media-view-bar-padding-y) var(--media-view-bar-padding-x);
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  .info {
    margin-left: auto;
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }

  .message {
    padding: var(--media-view-padding);
    color: var(--text-dim);
    font-size: var(--font-size-small);
    user-select: text;
  }

  .pdf {
    flex: 1;
    min-height: 0;
    width: 100%;
    border: none;
    background: var(--editor-bg);
  }

  .binary {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--media-view-info-gap);
    padding: var(--media-view-padding);
  }

  .name {
    font-weight: var(--font-weight-semibold);
  }

  .detail {
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }
</style>
