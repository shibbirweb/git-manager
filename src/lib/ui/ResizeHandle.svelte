<!-- Drag handle that resizes the panel next to it: a vertical bar for side panels, a horizontal one for the bottom panel. -->
<script lang="ts">
  interface Props {
    /** Current size of the panel being resized: its width, or its height for "bottom". */
    size: number;
    /** Which side of the handle the panel is on. */
    panel: "left" | "right" | "bottom";
    min: number;
    max: number;
    defaultSize: number;
    onResize: (size: number) => void;
    /** Called once when a drag ends, e.g. to persist the size. */
    onCommit?: (size: number) => void;
    label: string;
    /** Sits on a border inside one panel, not in the gap between two rounded panels. */
    inPanel?: boolean;
  }

  let { size, panel, min, max, defaultSize, onResize, onCommit, label, inPanel = false }: Props = $props();

  const horizontal = $derived(panel === "bottom");
  let dragging = $state(false);
  let startPosition = 0;
  let startSize = 0;

  function clamp(value: number): number {
    return Math.round(Math.min(max, Math.max(min, value)));
  }

  function pointerPosition(event: PointerEvent): number {
    return horizontal ? event.clientY : event.clientX;
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragging = true;
    startPosition = pointerPosition(event);
    startSize = size;
    document.body.classList.add(horizontal ? "resizing-rows" : "resizing-columns");
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) {
      return;
    }
    const delta = pointerPosition(event) - startPosition;
    // A left panel grows when dragging right; right and bottom panels grow towards the start.
    onResize(clamp(panel === "left" ? startSize + delta : startSize - delta));
  }

  function finish(event: PointerEvent): void {
    if (!dragging) {
      return;
    }
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    document.body.classList.remove("resizing-rows", "resizing-columns");
    onCommit?.(size);
  }

  function reset(): void {
    onResize(defaultSize);
    onCommit?.(defaultSize);
  }

  function onKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 40 : 10;
    const grow = panel === "left" ? "ArrowRight" : panel === "right" ? "ArrowLeft" : "ArrowUp";
    const shrink = panel === "left" ? "ArrowLeft" : panel === "right" ? "ArrowRight" : "ArrowDown";
    if (event.key === grow || event.key === shrink) {
      event.preventDefault();
      const next = clamp(size + (event.key === grow ? step : -step));
      onResize(next);
      onCommit?.(next);
    }
  }
</script>

<!-- A focusable separator is the ARIA pattern for a resizer (window splitter). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="handle"
  class:horizontal
  class:dragging
  class:in-panel={inPanel}
  role="separator"
  aria-orientation={horizontal ? "horizontal" : "vertical"}
  aria-label={label}
  aria-valuenow={size}
  aria-valuemin={min}
  aria-valuemax={max}
  tabindex="0"
  title="Drag to resize, double-click to reset"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={finish}
  onpointercancel={finish}
  ondblclick={reset}
  onkeydown={onKeydown}
></div>

<style>
  .handle {
    flex: none;
    position: relative;
    width: 5px;
    margin: 0 -2px;
    z-index: 20;
    cursor: col-resize;
    outline: none;
  }

  .handle::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 2px;
    width: 1px;
    background: transparent;
    transition: background 0.12s;
  }

  .handle:hover::after,
  .handle:focus-visible::after,
  .handle.dragging::after {
    left: 1px;
    width: 3px;
    background: var(--accent);
  }

  .handle.horizontal {
    width: auto;
    height: 5px;
    margin: -2px 0;
    cursor: row-resize;
  }

  .handle.horizontal::after {
    top: 2px;
    bottom: auto;
    left: 0;
    right: 0;
    width: auto;
    height: 1px;
  }

  .handle.horizontal:hover::after,
  .handle.horizontal:focus-visible::after,
  .handle.horizontal.dragging::after {
    top: 1px;
    left: 0;
    width: auto;
    height: 3px;
  }

  /* Rounded panels: the handle covers the whole gap between two panels. Inside a panel there is
     no gap, and the negative margins would slide the next pane over the border. */
  :global(html[data-rounded-panels]) .handle:not(.in-panel) {
    width: var(--panel-gap);
    margin: 0 calc(-1 * var(--panel-gap));
  }

  :global(html[data-rounded-panels]) .handle.horizontal:not(.in-panel) {
    width: auto;
    height: var(--panel-gap);
    margin: calc(-1 * var(--panel-gap)) 0;
  }

  /* Keep the resize cursor and stop text selection while dragging. */
  :global(body.resizing-columns),
  :global(body.resizing-columns *) {
    cursor: col-resize !important;
    user-select: none !important;
  }

  :global(body.resizing-rows),
  :global(body.resizing-rows *) {
    cursor: row-resize !important;
    user-select: none !important;
  }
</style>
