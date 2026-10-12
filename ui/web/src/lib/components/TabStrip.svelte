<!-- The editor's tab strip. `scroll` keeps one row that scrolls sideways, `wrap` adds rows, `single` shows a lone
     tab as a centered name. The active tab has the editor color and an accent line, gray when the group does not
     have the focus. A + button (onnew) follows the tabs; with onreorder, tabs can be dragged into a new order. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { DRAG_THRESHOLD, dropIndex } from "../logic/reorder";
  import EditorTab, { type EditorTabData } from "./EditorTab.svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    tabs: EditorTabData[];
    active?: string | null;
    label: string;
    focused?: boolean;
    layout?: "scroll" | "wrap" | "single";
    newLabel?: string;
    onselect?: (id: string) => void;
    onclose?: (id: string) => void;
    oncontextmenu?: (id: string, event: MouseEvent) => void;
    onnew?: (event: MouseEvent) => void;
    onreorder?: (from: number, to: number) => void;
    trailing?: Snippet;
  }

  let {
    tabs,
    active = $bindable(null),
    label,
    focused = true,
    layout = "scroll",
    newLabel = "New tab",
    onselect,
    onclose,
    oncontextmenu,
    onnew,
    onreorder,
    trailing,
  }: Props = $props();

  let stripEl = $state<HTMLDivElement | null>(null);
  let drag = $state<{ id: string; from: number; startX: number; moving: boolean } | null>(null);

  function select(id: string): void {
    active = id;
    onselect?.(id);
  }

  function centers(): number[] {
    return [...(stripEl?.querySelectorAll<HTMLElement>("[data-tab-id]") ?? [])].map((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
  }

  function down(event: PointerEvent, index: number, id: string): void {
    if (onreorder && event.button === 0 && layout !== "single") {
      drag = { id, from: index, startX: event.clientX, moving: false };
    }
  }

  function move(event: PointerEvent): void {
    if (drag && !drag.moving && Math.abs(event.clientX - drag.startX) > DRAG_THRESHOLD) {
      drag.moving = true;
    }
  }

  function up(event: PointerEvent): void {
    if (drag?.moving) {
      const to = dropIndex(centers(), event.clientX, drag.from);
      if (to !== drag.from) {
        onreorder?.(drag.from, to);
      }
    }
    drag = null;
  }
</script>

<svelte:window onpointermove={move} onpointerup={up} />

<div
  bind:this={stripEl}
  class="tab-strip {layout}"
  class:dragging={drag?.moving}
  role="tablist"
  aria-label={label}
>
  {#each tabs as tab, index (tab.id)}
    <EditorTab
      {tab}
      {focused}
      {layout}
      active={tab.id === active}
      lifted={drag?.moving === true && drag.id === tab.id}
      closable={onclose !== undefined}
      onselect={() => select(tab.id)}
      onclose={() => onclose?.(tab.id)}
      oncontextmenu={(event) => oncontextmenu?.(tab.id, event)}
      onpointerdown={(event) => down(event, index, tab.id)}
    />
  {/each}
  {#if onnew}
    <button class="new-tab" type="button" title={newLabel} aria-label={newLabel} onclick={(event) => onnew?.(event)}>
      <Icon name="plus" size="normal" />
    </button>
  {/if}
  {@render trailing?.()}
</div>

<style>
  .tab-strip {
    flex: none;
    position: relative;
    display: flex;
    align-items: stretch;
    height: var(--tab-strip-height);
    overflow-x: auto;
    overflow-y: hidden;
    background: var(--panel-alt);
    border-bottom: 1px solid var(--border-strong);
    scrollbar-width: none;
    user-select: none;
  }

  .tab-strip::-webkit-scrollbar {
    display: none;
  }

  .wrap {
    flex-wrap: wrap;
    height: auto;
    min-height: var(--tab-strip-height);
    overflow: hidden;
  }

  .single {
    justify-content: center;
  }

  .dragging {
    cursor: grabbing;
  }

  .new-tab {
    flex: none;
    align-self: center;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--new-tab-size);
    height: var(--new-tab-size);
    margin: 0 var(--new-tab-margin);
    padding: 0;
    border: none;
    border-radius: var(--new-tab-radius);
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .new-tab:hover {
    color: var(--text);
    background: var(--hover);
  }
</style>
