<!-- A context or drop-down menu at a point: commands with hints, separators and submenus. Arrow keys move, Enter
     runs, Right opens a submenu, Left and Esc close. Open it from oncontextmenu (x, y of the event) or use
     MenuButton for a button that opens one. -->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { canHighlight, isSeparator, isSubmenu, placeMenu, stepHighlight, type MenuItem } from "../logic/menuModel";
  import Icon from "./Icon.svelte";
  import Self from "./Menu.svelte";

  interface Props {
    items: MenuItem[];
    x: number;
    y: number;
    alignEnd?: boolean;
    keyboard?: boolean;
    label?: string;
    onclose: (restoreFocus: boolean) => void;
  }

  let { items, x, y, alignEnd = false, keyboard = false, label = "Menu", onclose }: Props = $props();

  let menuEl = $state<HTMLDivElement | null>(null);
  let highlighted = $state(-1);
  let openSub = $state(-1);
  const openItem = $derived(openSub >= 0 ? (items[openSub] ?? null) : null);
  let left = $state(0);
  let top = $state(0);

  onMount(async () => {
    left = x;
    top = y;
    await tick();
    const rect = menuEl?.getBoundingClientRect();
    if (rect) {
      ({ left, top } = placeMenu(x, y, rect.width, rect.height, { width: innerWidth, height: innerHeight }, alignEnd));
    }
    highlighted = keyboard ? stepHighlight(items, -1, 1) : -1;
    menuEl?.focus();
  });

  function run(index: number): void {
    const item = items[index];
    if (!item || !canHighlight(item)) {
      return;
    }
    if (isSubmenu(item)) {
      openSub = index;
      return;
    }
    if (!isSeparator(item)) {
      onclose(true);
      item.action();
    }
  }

  function onkeydown(event: KeyboardEvent): void {
    const keys: Record<string, () => void> = {
      ArrowDown: () => (highlighted = stepHighlight(items, highlighted, 1)),
      ArrowUp: () => (highlighted = stepHighlight(items, highlighted, -1)),
      ArrowRight: () => isSubmenu(items[highlighted] ?? { separator: true }) && (openSub = highlighted),
      ArrowLeft: () => onclose(true),
      Escape: () => onclose(true),
      Enter: () => run(highlighted),
      " ": () => run(highlighted),
    };
    const handler = keys[event.key];
    if (handler) {
      event.preventDefault();
      event.stopPropagation();
      handler();
    }
  }

  function itemRect(index: number): DOMRect | null {
    return menuEl?.querySelectorAll<HTMLElement>("[data-index]")[index]?.getBoundingClientRect() ?? null;
  }
</script>

<svelte:window
  onmousedown={(event) => {
    // A click outside every open menu (this one and its submenus) closes it.
    if (!(event.target as Element | null)?.closest?.('[role="menu"]')) {
      onclose(false);
    }
  }}
  onblur={() => onclose(false)}
/>

<div
  bind:this={menuEl}
  class="menu"
  role="menu"
  aria-label={label}
  tabindex="-1"
  style:left="{left}px"
  style:top="{top}px"
  {onkeydown}
>
  {#each items as item, index (index)}
    {#if isSeparator(item)}
      <div class="separator" role="separator" data-index={index}></div>
    {:else}
      <button
        type="button"
        class="item"
        class:highlighted={index === highlighted}
        class:danger={"danger" in item && item.danger}
        role="menuitem"
        aria-haspopup={isSubmenu(item) ? "menu" : undefined}
        disabled={item.disabled}
        data-index={index}
        onmouseenter={() => {
          highlighted = index;
          openSub = isSubmenu(item) ? index : -1;
        }}
        onclick={() => run(index)}
      >
        <span class="label">{item.label}</span>
        {#if isSubmenu(item)}
          <span class="chevron"><Icon name="chevron-right" size={14} /></span>
        {:else if item.hint}
          <span class="hint">{item.hint}</span>
        {/if}
      </button>
    {/if}
  {/each}
</div>

{#if openItem && isSubmenu(openItem)}
  {@const rect = itemRect(openSub)}
  {#if rect}
    <Self
      items={openItem.submenu}
      x={rect.right + 2}
      y={rect.top - 4}
      {keyboard}
      label={openItem.label}
      onclose={(restoreFocus) => {
        openSub = -1;
        if (restoreFocus) {
          menuEl?.focus();
        }
      }}
    />
  {/if}
{/if}

<style>
  .menu {
    position: fixed;
    z-index: 950;
    min-width: var(--menu-min-width);
    max-height: calc(100vh - 8px);
    overflow-y: auto;
    padding: var(--menu-padding);
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: var(--menu-radius);
    box-shadow: var(--shadow);
    outline: none;
  }

  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--menu-item-gap);
    width: 100%;
    padding: var(--menu-item-padding-y) var(--menu-item-padding-x);
    border: none;
    border-radius: var(--menu-item-radius);
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .label {
    white-space: nowrap;
  }

  .item.highlighted:not(:disabled) {
    background: var(--accent);
    color: var(--accent-text);
  }

  .item:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .item.danger {
    color: var(--danger);
  }

  .item.danger.highlighted:not(:disabled) {
    background: var(--danger);
    color: var(--accent-text);
  }

  .hint {
    color: var(--text-faint);
  }

  .item.highlighted .hint {
    color: inherit;
    opacity: 0.8;
  }

  .chevron {
    display: inline-flex;
    margin-right: -4px;
    opacity: 0.8;
  }

  .separator {
    height: 1px;
    margin: 4px var(--menu-separator-inset);
    background: var(--border-strong);
  }
</style>
