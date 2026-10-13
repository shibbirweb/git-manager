<!-- Rows the user puts in order by dragging their grip, like Interactive Rebase's commits. A line shows where the
     row will land. Up and Down move the focus between rows; Alt+Up and Alt+Down move the focused row, and the focus
     goes with it. Keys typed in a control inside a row (an action menu) stay there. -->
<script lang="ts" generics="T">
  import { tick, type Snippet } from "svelte";
  import { DRAG_THRESHOLD, dropIndex } from "../logic/reorder";

  interface Props {
    items: T[];
    itemKey: (item: T) => string;
    label: string;
    onreorder: (from: number, to: number) => void;
    row: Snippet<[T, number]>;
  }

  let { items, itemKey, label, onreorder, row }: Props = $props();

  let listEl = $state<HTMLDivElement | null>(null);
  const rowEls: HTMLDivElement[] = $state([]);
  let drag = $state<{ from: number; startY: number; moving: boolean; to: number } | null>(null);

  function centers(): number[] {
    return [...(listEl?.querySelectorAll<HTMLElement>("[data-reorder-row]") ?? [])].map((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
  }

  function down(event: PointerEvent, index: number): void {
    if (event.button === 0) {
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
    }
    if (drag.moving) {
      drag.to = dropIndex(centers(), event.clientY, drag.from);
    }
  }

  function up(): void {
    if (drag?.moving && drag.to !== drag.from) {
      onreorder(drag.from, drag.to);
    }
    drag = null;
  }

  async function keydown(event: KeyboardEvent, index: number): Promise<void> {
    const arrow = event.key === "ArrowUp" || event.key === "ArrowDown";
    if (!arrow || event.target !== event.currentTarget || event.metaKey || event.ctrlKey) {
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
  const lineAt = $derived(drag?.moving ? (drag.to > drag.from ? drag.to + 1 : drag.to) : -1);
</script>

<svelte:window onpointermove={move} onpointerup={up} />

<div bind:this={listEl} class="rows" class:dragging={drag?.moving} role="list" aria-label={label}>
  {#each items as item, index (itemKey(item))}
    <div class="row-wrap" class:drop-target={index === lineAt} data-reorder-row role="listitem">
      <div
        bind:this={rowEls[index]}
        class="row"
        class:lifted={drag?.moving && drag.from === index}
        tabindex="0"
        role="button"
        aria-label="Move with Alt+Up or Alt+Down"
        onkeydown={(event) => void keydown(event, index)}
      >
        <span class="grip" aria-hidden="true" onpointerdown={(event) => down(event, index)}>&#8942;&#8942;</span>
        {@render row(item, index)}
      </div>
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

  .dragging,
  .dragging .grip {
    cursor: grabbing;
  }
</style>
