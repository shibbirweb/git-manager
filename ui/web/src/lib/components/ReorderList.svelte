<!-- Rows the user puts in order by dragging their grip (or, with `dragBy="row"`, anywhere on the row but its
     controls), like Interactive Rebase's commits. A line shows where the row will land; `canDrop` can refuse a
     place. Near the list's edges it scrolls; Escape cancels the drag. Up and Down move the focus between rows;
     Alt+Up and Alt+Down move the focused row, and the focus goes with it; other keys go to `onkey`. Keys typed in a
     control inside a row (an action menu) stay there. `heading` draws above a row (a group's title) and `detail`
     under it (a message box), both outside the dragged part. -->
<script lang="ts" generics="T">
  import { tick, type Snippet } from "svelte";
  import { presetVar, type ViewHeight } from "../logic/presets";
  import { DRAG_THRESHOLD, dropIndex } from "../logic/reorder";
  import { treeScrollStep } from "../logic/treeDrag";

  interface Props {
    items: T[];
    itemKey: (item: T) => string;
    label: string;
    onreorder: (from: number, to: number) => void;
    row: Snippet<[T, number]>;
    rowLabel?: (item: T) => string;
    canDrop?: (from: number, to: number) => boolean;
    dragBy?: "grip" | "row";
    maxHeight?: Exclude<ViewHeight, "fill"> | "none";
    onkey?: (event: KeyboardEvent, index: number) => void;
    heading?: Snippet<[T, number]>;
    detail?: Snippet<[T, number]>;
  }

  let {
    items,
    itemKey,
    label,
    onreorder,
    row,
    rowLabel,
    canDrop = () => true,
    dragBy = "grip",
    maxHeight = "none",
    onkey,
    heading,
    detail,
  }: Props = $props();

  let listEl = $state<HTMLDivElement | null>(null);
  const rowEls: HTMLDivElement[] = $state([]);
  let drag = $state<{ from: number; startY: number; moving: boolean; to: number } | null>(null);
  let pointerY = 0;
  let scrollFrame = 0;

  function centers(): number[] {
    return [...(listEl?.querySelectorAll<HTMLElement>("[data-reorder-row]") ?? [])].map((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
  }

  function down(event: PointerEvent, index: number): void {
    const control = (event.target as Element | null)?.closest("select, textarea, input, button");
    if (event.button === 0 && !control) {
      event.preventDefault();
      drag = { from: index, startY: event.clientY, moving: false, to: index };
    }
  }

  function move(event: PointerEvent): void {
    if (!drag) {
      return;
    }
    if (!drag.moving && Math.abs(event.clientY - drag.startY) > DRAG_THRESHOLD) {
      drag.moving = true;
      scrollFrame = requestAnimationFrame(autoScroll);
    }
    pointerY = event.clientY;
    if (drag.moving) {
      const to = dropIndex(centers(), event.clientY, drag.from);
      drag.to = canDrop(drag.from, to) ? to : drag.from;
    }
  }

  /** Scrolls the list while a drag is near its top or bottom edge. */
  function autoScroll(): void {
    if (!drag?.moving || !listEl) {
      return;
    }
    const rect = listEl.getBoundingClientRect();
    listEl.scrollTop += treeScrollStep(pointerY, rect.top, rect.bottom);
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  function stop(): void {
    drag = null;
    cancelAnimationFrame(scrollFrame);
  }

  function up(): void {
    if (drag?.moving && drag.to !== drag.from) {
      onreorder(drag.from, drag.to);
    }
    stop();
  }

  function cancel(event: KeyboardEvent): void {
    if (drag?.moving && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      stop();
    }
  }

  async function keydown(event: KeyboardEvent, index: number): Promise<void> {
    if (event.target !== event.currentTarget || event.metaKey || event.ctrlKey) {
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      onkey?.(event, index);
      return;
    }
    event.preventDefault();
    const to = index + (event.key === "ArrowUp" ? -1 : 1);
    if (to < 0 || to >= items.length) {
      return;
    }
    if (event.altKey) {
      onreorder(index, to);
      await tick();
    }
    rowEls[to]?.focus();
  }

  /** The row whose top edge shows the drop line: the target, or after the last row. */
  const lineAt = $derived(drag?.moving && drag.to !== drag.from ? (drag.to > drag.from ? drag.to + 1 : drag.to) : -1);
</script>

<svelte:window onpointermove={move} onpointerup={up} onkeydowncapture={cancel} />

<div
  bind:this={listEl}
  class="rows"
  class:dragging={drag?.moving}
  role="list"
  aria-label={label}
  style:max-height={maxHeight === "none" ? null : presetVar("viewHeight", maxHeight)}
>
  {#each items as item, index (itemKey(item))}
    {@render heading?.(item, index)}
    <div class="row-wrap" class:drop-target={index === lineAt} data-reorder-row role="listitem">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={rowEls[index]}
        class="row"
        class:whole={dragBy === "row"}
        class:lifted={drag?.moving && drag.from === index}
        tabindex="0"
        role="button"
        aria-label={rowLabel ? `${rowLabel(item)}: move with Alt+Up or Alt+Down` : "Move with Alt+Up or Alt+Down"}
        onkeydown={(event) => void keydown(event, index)}
        onpointerdown={(event) => dragBy === "row" && down(event, index)}
      >
        <span class="grip" aria-hidden="true" onpointerdown={(event) => dragBy === "grip" && down(event, index)}
          >&#8942;&#8942;</span
        >
        {@render row(item, index)}
      </div>
      {@render detail?.(item, index)}
    </div>
  {/each}
  <div class="end" class:drop-target={lineAt === items.length}></div>
</div>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-control);
    background: var(--editor-bg);
  }

  .row-wrap {
    border-top: var(--reorder-list-drop-line) solid transparent;
    border-bottom: 1px solid var(--border);
  }

  .drop-target {
    border-top-color: var(--accent);
  }

  .end {
    border-top: var(--reorder-list-drop-line) solid transparent;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--reorder-list-gap);
    padding: var(--reorder-list-row-padding-y) var(--reorder-list-row-padding-right) var(--reorder-list-row-padding-y)
      var(--reorder-list-row-padding-left);
    outline: none;
  }

  .row:focus,
  .row:focus-visible {
    background: var(--selected);
  }

  .lifted {
    opacity: 0.5;
  }

  .grip {
    flex: none;
    color: var(--text-faint);
    font-size: var(--font-size-tiny);
    letter-spacing: calc(var(--space-1) * -1);
    cursor: grab;
  }

  .whole {
    cursor: grab;
  }

  .dragging,
  .dragging .grip,
  .dragging .row {
    cursor: grabbing;
  }
</style>
