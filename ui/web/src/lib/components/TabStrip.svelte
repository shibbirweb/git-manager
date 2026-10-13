<!-- The editor's tab strip. `scroll` keeps one row that scrolls sideways (the wheel scrolls it too), `wrap` adds
     rows, `single` shows a lone tab as a centered name. The active tab has the editor color and an accent line,
     gray when the group does not have the focus, and is kept in view. A + button (onnew) follows the tabs; with
     onreorder, a dragged tab follows the pointer while the others slide aside (logic/tabDrag.ts). -->
<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import { DRAG_THRESHOLD, movedItems } from "../logic/reorder";
  import { positions, slideFrom } from "../logic/slide";
  import {
    beginDrag,
    dropGap,
    edgeScrollStep,
    gapIndex,
    wheelScroll,
    type TabDrag,
    type TabPress,
  } from "../logic/tabDrag";
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
    ondblclick?: (id: string) => void;
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
    ondblclick,
    onclose,
    oncontextmenu,
    onnew,
    onreorder,
    trailing,
  }: Props = $props();

  let stripEl = $state<HTMLDivElement | null>(null);
  let press: TabPress | null = null;
  let drag = $state<TabDrag | null>(null);
  let scrollFrame = 0;
  const wrapped = $derived(layout === "wrap");
  // While dragging, the tabs show in the order a drop would give; the dragged one follows the pointer.
  const shown = $derived(drag ? movedItems(tabs, drag.from, gapIndex(drag.gap, drag.from)) : tabs);

  function select(id: string): void {
    active = id;
    onselect?.(id);
  }

  function tabElements(): HTMLElement[] {
    return [...(stripEl?.querySelectorAll<HTMLElement>("[data-tab-id]") ?? [])];
  }

  /** A viewport point in the strip's scrolled content coordinates. */
  function contentPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = stripEl?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0) + (stripEl?.scrollLeft ?? 0),
      y: clientY - (rect?.top ?? 0) + (stripEl?.scrollTop ?? 0),
    };
  }

  function down(event: PointerEvent, index: number, id: string): void {
    const onClose = (event.target as Element | null)?.closest(".tab-close");
    if (onreorder && event.button === 0 && layout !== "single" && !onClose && tabs.length > 1) {
      press = { id, from: index, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    }
  }

  function startDrag(current: TabPress): TabDrag {
    const boxes = tabElements().map((element) => {
      const rect = element.getBoundingClientRect();
      const corner = contentPoint(rect.left, rect.top);
      return { left: corner.x, right: corner.x + rect.width, top: corner.y, bottom: corner.y + rect.height };
    });
    return beginDrag(current, boxes, contentPoint(current.startX, current.startY));
  }

  function follow(clientX: number, clientY: number): void {
    if (!drag) {
      return;
    }
    const point = contentPoint(clientX, clientY);
    const gap = dropGap(drag.boxes, point.x, point.y, wrapped);
    if (gap === drag.gap) {
      drag = { ...drag, clientX, clientY };
      return;
    }
    const before = positions(tabElements(), (element) => element.dataset.tabId ?? "");
    drag = { ...drag, clientX, clientY, gap };
    const lifted = drag.id;
    void tick().then(() => slideFrom(tabElements(), (element) => element.dataset.tabId ?? "", before, lifted));
  }

  function move(event: PointerEvent): void {
    if (!press || event.pointerId !== press.pointerId) {
      return;
    }
    if (!drag) {
      if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) <= DRAG_THRESHOLD) {
        return;
      }
      drag = startDrag(press);
      scrollFrame = requestAnimationFrame(edgeScroll);
    }
    follow(event.clientX, event.clientY);
  }

  /** Near a single row's ends, the strip scrolls while a tab is dragged. */
  function edgeScroll(): void {
    if (!drag || !stripEl) {
      return;
    }
    const rect = stripEl.getBoundingClientRect();
    const step = wrapped ? 0 : edgeScrollStep(drag.clientX, rect.left, rect.right);
    if (step !== 0) {
      stripEl.scrollLeft += step;
      follow(drag.clientX, drag.clientY);
    }
    scrollFrame = requestAnimationFrame(edgeScroll);
  }

  function up(event: PointerEvent): void {
    if (!press || event.pointerId !== press.pointerId) {
      return;
    }
    const finished = drag;
    end();
    if (finished) {
      const to = gapIndex(finished.gap, finished.from);
      if (to !== finished.from) {
        onreorder?.(finished.from, to);
      }
    }
  }

  function end(): void {
    press = null;
    drag = null;
    cancelAnimationFrame(scrollFrame);
  }

  // The dragged tab follows the pointer from wherever the new order put it; in one row only sideways.
  $effect(() => {
    const current = drag;
    const element = tabElements().find((candidate) => candidate.dataset.tabId === current?.id);
    if (!current || !element || !stripEl) {
      return;
    }
    const point = contentPoint(current.clientX, current.clientY);
    let left = point.x - current.grabX;
    if (!wrapped) {
      left = Math.max(0, Math.min(left, stripEl.scrollWidth - element.offsetWidth));
    }
    const top = wrapped ? point.y - current.grabY - element.offsetTop : 0;
    element.style.translate = `${left - element.offsetLeft}px ${top}px`;
    return () => {
      element.style.translate = "";
    };
  });

  // Keep the active tab in view.
  $effect(() => {
    const id = active;
    tabElements()
      .find((element) => element.dataset.tabId === id)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  $effect(() => end);
</script>

<svelte:window
  onpointermove={move}
  onpointerup={up}
  onpointercancel={end}
  onkeydowncapture={(event) => {
    if (event.key === "Escape" && drag) {
      event.preventDefault();
      event.stopPropagation();
      end();
    }
  }}
/>

<div
  bind:this={stripEl}
  class="tab-strip {layout}"
  class:dragging={drag !== null}
  role="tablist"
  aria-label={label}
  onwheel={(event) => {
    if (stripEl && layout === "scroll") {
      stripEl.scrollLeft += wheelScroll(event);
    }
  }}
>
  {#each shown as tab (tab.id)}
    <EditorTab
      {tab}
      {focused}
      {layout}
      active={tab.id === active}
      lifted={drag?.id === tab.id}
      closable={onclose !== undefined}
      onselect={() => select(tab.id)}
      ondblclick={ondblclick && (() => ondblclick(tab.id))}
      onclose={() => onclose?.(tab.id)}
      oncontextmenu={(event) => oncontextmenu?.(tab.id, event)}
      onpointerdown={(event) => down(event, tabs.indexOf(tab), tab.id)}
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
