<!-- The keyboard and selection around Rows: a listbox, a tree or a plain list. Up and Down move (over headings that
     `skip` names), Home, End and Page keys jump, Enter or a double-click activates, Left and Right fold tree rows,
     and with `multiple` a Cmd or Shift click (or Shift and an arrow) selects several. The list keeps the focus, so
     its selected row shows the strong color. `virtual` draws only the rows in view, for long lists. -->
<script module lang="ts">
  export interface ListRowState {
    index: number;
    selected: boolean;
    current: boolean;
  }
</script>

<script lang="ts" generics="T">
  import { tick, type Snippet } from "svelte";
  import { markInsideList } from "../logic/listContext";
  import { isListKey, moveIndex, treeMove } from "../logic/listNav";
  import { presetVar, type RowHeight, type ViewHeight } from "../logic/presets";
  import { modifiersOf, selectRow, type Modifiers } from "../logic/treeSelect";
  import { scrollToShow, visibleRows } from "../logic/virtualWindow";
  import { scales } from "../styles/tokens";

  interface Props {
    items: T[];
    itemKey: (item: T) => string;
    label: string;
    role?: "listbox" | "tree" | "list";
    selected?: string | null;
    selection?: string[];
    multiple?: boolean;
    skip?: (item: T) => boolean;
    level?: (item: T) => number;
    expanded?: (item: T) => boolean | null;
    height?: ViewHeight | "auto";
    virtual?: RowHeight | null;
    row: Snippet<[T, ListRowState]>;
    empty?: Snippet;
    onselect?: (item: T) => void;
    onactivate?: (item: T) => void;
    ontoggle?: (item: T, open: boolean) => void;
    oncontextmenu?: (event: MouseEvent, item: T) => void;
  }

  let {
    items,
    itemKey,
    label,
    role = "listbox",
    selected = $bindable(null),
    selection = $bindable([]),
    multiple = false,
    skip = () => false,
    level = () => 0,
    expanded = () => null,
    height = "auto",
    virtual = null,
    row,
    empty,
    onselect,
    onactivate,
    ontoggle,
    oncontextmenu,
  }: Props = $props();

  markInsideList();

  // Rows drawn beyond the view on each side, so fast scrolling does not show gaps.
  const OVERSCAN = 8;
  const uid = $props.id();
  const interactive = $derived(role !== "list");
  const keys = $derived(items.map((item) => itemKey(item)));
  const order = $derived(keys.filter((_, index) => !skip(items[index])));
  const currentIndex = $derived(selected === null ? -1 : keys.indexOf(selected));
  const rowPx = $derived(virtual === null ? 0 : scales.rowHeight[virtual]);
  // A virtual list scrolls itself, so it never takes its content's height.
  const shownHeight = $derived(virtual !== null && height === "auto" ? "fill" : height);
  const itemRole = $derived(role === "tree" ? "treeitem" : "option");

  let viewport = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  let anchor = $state<string | null>(null);

  const range = $derived(
    virtual === null
      ? { first: 0, last: items.length }
      : visibleRows(scrollTop, viewportHeight, rowPx, items.length, OVERSCAN),
  );

  function isSelected(key: string): boolean {
    return multiple ? selection.includes(key) : selected === key;
  }

  function select(index: number, modifiers: Modifiers) {
    const item = items[index];
    if (item === undefined || skip(item)) {
      return;
    }
    const key = keys[index];
    if (multiple) {
      const next = selectRow(order, { ids: selection, anchor: anchor ?? selected }, key, modifiers);
      selection = next.ids;
      anchor = next.anchor;
    }
    selected = key;
    onselect?.(item);
  }

  async function reveal(index: number) {
    if (!viewport || index < 0) {
      return;
    }
    if (virtual !== null) {
      const target = scrollToShow(index, rowPx, viewport.scrollTop, viewport.clientHeight);
      if (target !== null) {
        viewport.scrollTop = target;
      }
      return;
    }
    await tick();
    document.getElementById(`${uid}-${index}`)?.scrollIntoView({ block: "nearest" });
  }

  function onkeydown(event: KeyboardEvent) {
    if (!interactive || event.defaultPrevented) {
      return;
    }
    const levels = items.map((item) => level(item));
    if (isListKey(event.key)) {
      event.preventDefault();
      const index = moveIndex(currentIndex, items.length, event.key, (other) => skip(items[other]));
      select(index, { toggle: false, range: multiple && event.shiftKey });
      void reveal(index);
    } else if (role === "tree" && (event.key === "ArrowLeft" || event.key === "ArrowRight") && currentIndex >= 0) {
      event.preventDefault();
      const item = items[currentIndex];
      const move = treeMove(event.key, currentIndex, expanded(item), levels);
      if (move?.kind === "toggle") {
        ontoggle?.(item, move.open);
      } else if (move?.kind === "move") {
        select(move.index, { toggle: false, range: false });
        void reveal(move.index);
      }
    } else if (event.key === "Enter" && currentIndex >= 0) {
      event.preventDefault();
      onactivate?.(items[currentIndex]);
    } else if (multiple && event.key === "a" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      selection = [...order];
    }
  }

  /** Clicks on a control inside a row (an action button, a rename field) belong to that control. */
  function onControl(event: MouseEvent): boolean {
    const target = event.target as Element | null;
    const control = target?.closest("button, a, input, select, textarea, [role='button']");
    return control !== null && control !== undefined && control !== event.currentTarget;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={viewport}
  bind:clientHeight={viewportHeight}
  class="list {shownHeight}"
  class:virtual={virtual !== null}
  {role}
  tabindex={interactive ? 0 : undefined}
  aria-label={label}
  aria-multiselectable={role === "listbox" && multiple ? true : undefined}
  aria-activedescendant={interactive && currentIndex >= range.first && currentIndex < range.last
    ? `${uid}-${currentIndex}`
    : undefined}
  style:max-height={shownHeight === "fill" || shownHeight === "auto" ? null : presetVar("viewHeight", shownHeight)}
  onscroll={() => (scrollTop = viewport?.scrollTop ?? 0)}
  {onkeydown}
>
  {#if items.length === 0}
    {@render empty?.()}
  {:else}
    <div class="rows" style:height={virtual === null ? null : `${items.length * rowPx}px`}>
      {#each items.slice(range.first, range.last) as item, offset (keys[range.first + offset])}
        {@const index = range.first + offset}
        {@const key = keys[index]}
        {@const pickable = interactive && !skip(item)}
        {@const open = role === "tree" ? expanded(item) : null}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div
          id="{uid}-{index}"
          class="item"
          role={pickable ? itemRole : role === "list" ? "listitem" : "presentation"}
          aria-selected={pickable ? isSelected(key) : undefined}
          aria-level={pickable && role === "tree" ? level(item) + 1 : undefined}
          aria-expanded={pickable && open !== null ? open : undefined}
          style:top={virtual === null ? null : `${index * rowPx}px`}
          style:height={virtual === null ? null : `${rowPx}px`}
          onmousedown={(event) => {
            if (pickable && !onControl(event)) {
              viewport?.focus({ preventScroll: true });
            }
          }}
          onclick={(event) => {
            if (pickable && !onControl(event)) {
              select(index, multiple ? modifiersOf(event) : { toggle: false, range: false });
            }
          }}
          ondblclick={(event) => {
            if (pickable && !onControl(event)) {
              onactivate?.(item);
            }
          }}
          oncontextmenu={(event) => {
            if (!pickable) {
              return;
            }
            if (!isSelected(key)) {
              select(index, { toggle: false, range: false });
            }
            oncontextmenu?.(event, item);
          }}
        >
          {@render row(item, { index, selected: isSelected(key), current: selected === key })}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    min-width: 0;
    outline: none;
  }

  .fill {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
  }

  .small,
  .medium,
  .large {
    overflow-y: auto;
  }

  .virtual {
    overflow-y: auto;
  }

  .rows {
    position: relative;
    flex: none;
  }

  .virtual .item {
    position: absolute;
    left: 0;
    right: 0;
  }

  .virtual .item > :global(*) {
    height: 100%;
  }
</style>
