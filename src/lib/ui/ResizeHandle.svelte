<!-- Vertical drag handle that resizes the panel next to it. -->
<script lang="ts">
  interface Props {
    /** Current width of the panel being resized. */
    width: number;
    /** Which side of the handle the panel is on. */
    panel: "left" | "right";
    min: number;
    max: number;
    defaultWidth: number;
    onResize: (width: number) => void;
    /** Called once when a drag ends, e.g. to persist the width. */
    onCommit?: (width: number) => void;
    label: string;
  }

  let { width, panel, min, max, defaultWidth, onResize, onCommit, label }: Props = $props();

  let dragging = $state(false);
  let startX = 0;
  let startWidth = 0;

  function clamp(value: number): number {
    return Math.round(Math.min(max, Math.max(min, value)));
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragging = true;
    startX = event.clientX;
    startWidth = width;
    document.body.classList.add("resizing-columns");
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) {
      return;
    }
    const delta = event.clientX - startX;
    onResize(clamp(panel === "left" ? startWidth + delta : startWidth - delta));
  }

  function finish(event: PointerEvent): void {
    if (!dragging) {
      return;
    }
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    document.body.classList.remove("resizing-columns");
    onCommit?.(width);
  }

  function reset(): void {
    onResize(defaultWidth);
    onCommit?.(defaultWidth);
  }

  function onKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 40 : 10;
    const grow = panel === "left" ? "ArrowRight" : "ArrowLeft";
    const shrink = panel === "left" ? "ArrowLeft" : "ArrowRight";
    if (event.key === grow || event.key === shrink) {
      event.preventDefault();
      const next = clamp(width + (event.key === grow ? step : -step));
      onResize(next);
      onCommit?.(next);
    }
  }
</script>

<!-- A focusable separator is the ARIA pattern for a resizer (window splitter). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="handle"
  class:dragging
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={width}
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

  /* Keep the resize cursor and stop text selection while dragging. */
  :global(body.resizing-columns),
  :global(body.resizing-columns *) {
    cursor: col-resize !important;
    user-select: none !important;
  }
</style>
