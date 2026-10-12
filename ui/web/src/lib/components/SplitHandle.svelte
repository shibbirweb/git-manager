<!-- A handle between two side-by-side views inside one box, like the split diff's: drag it or use the arrow keys
     (Shift for bigger steps) to move the split, which `ratio` holds (0 to 1, data); double-click centers it. Its
     parent must be positioned. -->
<script lang="ts">
  import { keyedRatio, pointerRatio } from "../logic/splitRatio";

  interface Props {
    ratio?: number;
    label: string;
    oncommit?: (ratio: number) => void;
  }

  let { ratio = $bindable(0.5), label, oncommit }: Props = $props();

  let dragging = $state(false);
  let handle = $state<HTMLDivElement | null>(null);

  function move(event: PointerEvent): void {
    const box = handle?.parentElement?.getBoundingClientRect();
    if (dragging && box) {
      ratio = pointerRatio(event.clientX, box.left, box.width);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  bind:this={handle}
  class="split-handle"
  class:dragging
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={Math.round(ratio * 100)}
  aria-valuemin={0}
  aria-valuemax={100}
  tabindex="0"
  style:left="{ratio * 100}%"
  onpointerdown={(event) => {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragging = true;
  }}
  onpointermove={move}
  onpointerup={() => {
    dragging = false;
    oncommit?.(ratio);
  }}
  ondblclick={() => {
    ratio = 0.5;
    oncommit?.(ratio);
  }}
  onkeydown={(event) => {
    const next = keyedRatio(ratio, event.key, event.shiftKey);
    if (next !== null) {
      event.preventDefault();
      ratio = next;
      oncommit?.(ratio);
    }
  }}
></div>

<style>
  .split-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: var(--split-handle-layer);
    width: var(--split-handle-width);
    margin-left: calc(var(--split-handle-width) / -2);
    cursor: col-resize;
    outline: none;
  }

  .split-handle::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc((var(--split-handle-width) - var(--split-handle-line)) / 2);
    width: var(--split-handle-line);
    background: transparent;
    transition: background var(--motion-fast);
  }

  .split-handle:hover::after,
  .split-handle:focus-visible::after,
  .dragging::after {
    background: var(--accent);
  }
</style>
