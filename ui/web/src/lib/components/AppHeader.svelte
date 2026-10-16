<!-- The bar across the top of the window: navigation and pickers on the left (they shrink and truncate first), the
     busy indicator and actions on the right. Vertical Dividers inside take the header's length. The `rounded` look
     shows the window frame through it with no line, like the rounded panels under it: AppShell paints the frame and,
     with its `tint`, the project's glow. In the flat look `tint` glows from the bar's own left edge. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ProjectTint } from "../logic/presets";
  import Spinner from "./Spinner.svelte";

  interface Props {
    busy?: string;
    busyTitle?: string;
    look?: "flat" | "rounded";
    tint?: ProjectTint;
    /** The window's own buttons sit at the left of the bar (macOS): leave room for them, and drag the window by it. */
    windowControls?: boolean;
    start: Snippet;
    end?: Snippet;
  }

  let { busy = "", busyTitle, look = "flat", tint = "none", windowControls = false, start, end }: Props = $props();
  /** Only the bar's own empty space moves the window; its buttons and pickers keep their clicks. */
  const drag = $derived(windowControls ? "" : undefined);
</script>

<header
  class="header {look} tint-{tint}"
  class:controls={windowControls}
  style:--header-tint={tint === "none" ? null : `var(--term-${tint})`}
  data-tauri-drag-region={drag}
>
  <div class="start" data-tauri-drag-region={drag}>{@render start()}</div>
  <div class="end" data-tauri-drag-region={drag}>
    {#if busy}
      <div class="busy" title={busyTitle ?? busy}>
        <Spinner size="small" label={busy} />
        <span class="busy-text">{busy}</span>
      </div>
    {/if}
    {@render end?.()}
  </div>
</header>

<style>
  .header {
    --divider-length: var(--app-header-divider-length);
    --divider-space: var(--app-header-side-gap);
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--app-header-gap);
    height: var(--app-header-height);
    padding: 0 var(--app-header-padding-x);
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel);
  }

  .rounded {
    background: transparent;
    border-bottom: none;
  }

  .controls {
    padding-left: var(--app-header-controls-inset);
  }

  /* Flat: a soft glow from the left edge, over the bar's own background, fainter in light themes (see AppShell).
     The ellipse sits on the bar's middle line and reaches its top and bottom edges fully faded, so it blends into the
     window above and the panels below, and eases out to the right. */
  .flat:not(.tint-none) {
    --glow-start: light-dark(
      color-mix(in srgb, var(--header-tint) 14%, transparent),
      color-mix(in srgb, var(--header-tint) 28%, transparent)
    );
    --glow-middle: light-dark(
      color-mix(in srgb, var(--header-tint) 6%, transparent),
      color-mix(in srgb, var(--header-tint) 13%, transparent)
    );
    background-image: radial-gradient(
      var(--app-header-tint-width) 50% at 0 50%,
      var(--glow-start) 0%,
      var(--glow-middle) 45%,
      transparent 100%
    );
  }

  .start,
  .end {
    display: flex;
    align-items: center;
    gap: var(--app-header-side-gap);
    min-width: 0;
  }

  .start {
    overflow: hidden;
  }

  /* Pickers shrink by default; parts with flex: none (dividers, history buttons) keep their size. */
  .start > :global(*) {
    min-width: 0;
  }

  .end {
    justify-content: flex-end;
  }

  .busy {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    max-width: var(--app-header-busy-max-width);
    margin-right: var(--space-3);
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }

  .busy-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
