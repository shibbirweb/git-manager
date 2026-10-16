<!-- The keyboard and selection around Rows: a listbox, a tree or a plain list (keys in logic/listKeys.ts). The list
     keeps the focus, so its selected row shows the strong color; a `field` above it can drive it instead. `virtual`
     draws only the rows in view; with `measure` rows may differ in height and each drawn row is measured. -->
<script module lang="ts">
  export type { ListRowState } from "../logic/listKeys";
</script>

<script lang="ts" generics="T">
  import { onDestroy, tick, untrack, type Snippet } from "svelte";
  import { markInsideList, onRowControl } from "../logic/listContext";
  import { drivenSelection, type FieldKeys } from "../logic/listField";
  import { handleListKey, keyMenuEvent, type KeyInput, type ListHost, type ListRowState } from "../logic/listKeys";
  import { ListScroll, wireField, type RevealPlace, type RowBox } from "../logic/listWiring.svelte";
  import { presetVar, type RowHeight, type ViewHeight } from "../logic/presets";
  import { RowHeights } from "../logic/rowHeights.svelte";
  import { listWindow } from "../logic/rowOffsets";
  import { modifiersOf, selectRow, type Modifiers } from "../logic/treeSelect";
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
    measure?: boolean;
    field?: HTMLInputElement | null;
    fieldKeys?: FieldKeys;
    follow?: boolean;
    row: Snippet<[T, ListRowState]>;
    empty?: Snippet;
    onselect?: (item: T) => void;
    clickActivates?: boolean;
    onactivate?: (item: T, event?: KeyInput | MouseEvent) => void;
    ontoggle?: (item: T, open: boolean) => void;
    oncontextmenu?: (event: MouseEvent, item: T, fromKeys?: boolean) => void;
    onkeydown?: (event: KeyboardEvent, fromField: boolean) => void;
    onnearend?: () => void;
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
    measure = false,
    field = null,
    fieldKeys = "enter",
    follow = false,
    row,
    empty,
    onselect,
    clickActivates = false,
    onactivate,
    ontoggle,
    oncontextmenu,
    onkeydown,
    onnearend,
  }: Props = $props();

  markInsideList(untrack(() => role !== "list"));
  const uid = $props.id();
  const interactive = $derived(role !== "list");
  const keys = $derived(items.map((item) => itemKey(item)));
  const order = $derived(keys.filter((_, index) => !skip(items[index])));
  const currentIndex = $derived(selected === null ? -1 : keys.indexOf(selected));
  const rowPx = $derived(virtual === null ? 0 : scales.rowHeight[virtual]);
  // A virtual list scrolls itself, so it never takes its content's height.
  const shownHeight = $derived(virtual !== null && height === "auto" ? "fill" : height);
  // A driving field keeps the focus: the list is not tabbable and its rows do not take the focus when clicked.
  const drives = $derived(interactive && field !== null && fieldKeys === "drive");

  let viewport = $state<HTMLDivElement | null>(null);
  const scroll = new ListScroll();
  let viewportHeight = $state(0);
  let anchor = $state<string | null>(null);

  // With `measure`, each drawn row is measured when its height changes; rows not drawn yet count as `virtual`.
  const rowHeights = new RowHeights();
  const measuring = $derived(virtual !== null && measure);
  const offsets = $derived(measuring ? rowHeights.offsets(keys, rowPx) : null);
  const range = $derived(
    listWindow(items.length, virtual === null ? null : rowPx, offsets, scroll.top, viewportHeight),
  );
  const activeId = $derived(
    interactive && currentIndex >= range.first && currentIndex < range.last ? `${uid}-${currentIndex}` : undefined,
  );
  const measureRow = (node: HTMLElement, key: string) => (measuring ? rowHeights.observe(node, key) : {});
  onDestroy(() => rowHeights.dispose());
  const isSelected = (key: string) => (multiple ? selection.includes(key) : selected === key);

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

  async function revealIndex(index: number, place: RevealPlace = "nearest") {
    const top = offsets ? offsets[index] : index * rowPx;
    const box: RowBox | null = virtual === null ? null : [top, offsets ? offsets[index + 1] : top + rowPx];
    await scroll.reveal(index < 0 ? null : viewport, `${uid}-${index}`, box, place);
  }

  /** Takes the focus, such as when the app moves it into the list. */
  export function focus(): void {
    viewport?.focus({ preventScroll: true });
  }

  /** Scrolls a row into view after the app changed `items` or `selected`: the least needed, or to the middle. */
  export async function reveal(key: string, place: RevealPlace = "nearest"): Promise<void> {
    await tick();
    await revealIndex(keys.indexOf(key), place);
  }

  function moveTo(index: number, range: boolean) {
    select(index, { toggle: false, range });
    void revealIndex(index);
  }

  scroll.follow(
    () => viewport,
    () => follow,
    () => [items.length, range.total],
  );
  wireField(
    () => field,
    () => (drives ? { listId: uid, activeId } : null),
    (event) => onKey(event, true),
  );

  // measure: an entry that opens keeps its new height in view while it is the current row.
  scroll.keep(
    () => (measuring && selected !== null ? (rowHeights.heights[selected] ?? 0) : 0),
    () => void revealIndex(currentIndex),
  );

  // A driving field always has a row highlighted, like a combobox.
  $effect(() => {
    if (drives) {
      selected = drivenSelection(selected, order);
    }
  });

  const host: ListHost = {
    state: () => ({
      current: currentIndex,
      count: items.length,
      skip: (index: number) => skip(items[index]),
      tree: role === "tree",
      multiple,
      levels: () => items.map((item) => level(item)),
      expanded: (index: number) => expanded(items[index]),
    }),
    move: moveTo,
    toggle: (index, open) => ontoggle?.(items[index], open),
    activate: (index, event) => onactivate?.(items[index], event),
    menu: (index) => oncontextmenu?.(keyMenuEvent(document.getElementById(`${uid}-${index}`)), items[index], true),
    selectAll: () => (selection = [...order]),
    focus: () => viewport?.focus(),
  };

  /** A key in the list itself, or in its `field`; the app's `onkeydown` sees it first. */
  function onKey(event: KeyboardEvent, fromField: boolean) {
    onkeydown?.(event, fromField);
    if (interactive && !event.defaultPrevented && handleListKey(event, fromField ? fieldKeys : null, host)) {
      event.preventDefault();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  id={uid}
  bind:this={viewport}
  bind:clientHeight={viewportHeight}
  class="list {shownHeight}"
  class:virtual={virtual !== null}
  class:measured={measuring}
  {role}
  tabindex={interactive && !drives ? 0 : undefined}
  aria-label={label}
  aria-multiselectable={role === "listbox" && multiple ? true : undefined}
  aria-activedescendant={drives ? undefined : activeId}
  data-driven={drives || undefined}
  style:max-height={shownHeight === "fill" || shownHeight === "auto" ? null : presetVar("viewHeight", shownHeight)}
  onscroll={() => viewport && scroll.update(viewport, items.length, onnearend)}
  onkeydown={(event) => onKey(event, false)}
>
  {#if items.length === 0}
    {@render empty?.()}
  {:else}
    <div class="rows" style:height={range.total}>
      {#each items.slice(range.first, range.last) as item, offset (keys[range.first + offset])}
        {@const index = range.first + offset}
        {@const key = keys[index]}
        {@const pickable = interactive && !skip(item)}
        {@const open = role === "tree" ? expanded(item) : null}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div
          id="{uid}-{index}"
          class="item"
          role={pickable ? (role === "tree" ? "treeitem" : "option") : role === "list" ? "listitem" : "presentation"}
          aria-selected={pickable ? isSelected(key) : undefined}
          aria-level={pickable && role === "tree" ? level(item) + 1 : undefined}
          aria-expanded={pickable && open !== null ? open : undefined}
          style:top={virtual === null ? null : `${offsets ? offsets[index] : index * rowPx}px`}
          style:height={virtual === null || measuring ? null : `${rowPx}px`}
          use:measureRow={key}
          onmousedown={(event) => {
            if (drives) {
              event.preventDefault();
            } else if (pickable && !onRowControl(event)) {
              viewport?.focus({ preventScroll: true });
            }
          }}
          onclick={(event) => {
            if (pickable && !onRowControl(event)) {
              select(index, multiple ? modifiersOf(event) : { toggle: false, range: false });
              if (clickActivates) {
                onactivate?.(item, event);
              }
            }
          }}
          ondblclick={(event) => {
            if (pickable && !clickActivates && !onRowControl(event)) {
              onactivate?.(item, event);
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
  }

  .list:not(.auto) {
    overflow-y: auto;
  }

  .rows {
    position: relative;
    flex: none;
  }

  .virtual .item {
    position: absolute;
    inset-inline: 0;
  }

  .virtual:not(.measured) .item > :global(*) {
    height: 100%;
  }
</style>
