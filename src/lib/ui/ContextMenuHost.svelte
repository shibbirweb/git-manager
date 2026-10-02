<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { contextMenu, type MenuItem } from "./menu.svelte";
  import { firstIndex, hasSubmenu, isSelectable, lastIndex, matchIndex, rootPosition, stepIndex, submenuPosition } from "./menuNav";

  let layerEl = $state<HTMLDivElement | null>(null);
  let menuEls = $state<(HTMLDivElement | null)[]>([]);
  /** Highlighted index per open level (-1: none). */
  let path = $state<number[]>([-1]);
  /** How many submenus are open below the root. */
  let openDepth = $state(0);
  let positions = $state<({ left: number; top: number } | null)[]>([]);

  /** The root items, then the items of each open submenu. */
  const levels = $derived.by(() => {
    const result: MenuItem[][] = [contextMenu.items];
    for (let level = 0; level < openDepth; level++) {
      const item = result[level][path[level] ?? -1];
      if (!item || !("submenu" in item) || item.disabled) {
        break;
      }
      result.push(item.submenu);
    }
    return result;
  });

  /** The level the arrow keys move in: the deepest one with a highlighted item. */
  const focusLevel = $derived.by(() => {
    for (let level = levels.length - 1; level > 0; level--) {
      if ((path[level] ?? -1) >= 0) {
        return level;
      }
    }
    return 0;
  });

  // Every open starts fresh: no submenus, first item highlighted when opened with the keyboard.
  $effect(() => {
    void contextMenu.version;
    if (!contextMenu.visible) {
      return;
    }
    openDepth = 0;
    positions = [];
    path = [contextMenu.keyboard ? firstIndex(contextMenu.items) : -1];
    void tick().then(() => menuEls[0]?.focus());
  });

  // Keep the root inside the window and put each submenu next to its row.
  $effect(() => {
    if (!contextMenu.visible) {
      return;
    }
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const next: ({ left: number; top: number } | null)[] = [];
    for (let level = 0; level < levels.length; level++) {
      const menuEl = menuEls[level];
      if (!menuEl) {
        next.push(null);
        continue;
      }
      const size = { width: menuEl.offsetWidth, height: menuEl.offsetHeight };
      if (level === 0) {
        next.push(rootPosition(contextMenu.x, contextMenu.y, size, viewport, contextMenu.alignEnd));
        continue;
      }
      const parentEl = menuEls[level - 1];
      const parentPos = next[level - 1];
      const rowEl = parentEl?.querySelector<HTMLElement>(`[data-index="${path[level - 1]}"]`);
      if (!parentEl || !parentPos || !rowEl) {
        next.push(null);
        continue;
      }
      // Measure against the parent's computed place, which may not be on screen yet.
      const parentRect = parentEl.getBoundingClientRect();
      const rowRect = rowEl.getBoundingClientRect();
      const row = {
        left: parentPos.left,
        right: parentPos.left + parentRect.width,
        top: parentPos.top + rowRect.top - parentRect.top,
        bottom: parentPos.top + rowRect.bottom - parentRect.top,
      };
      next.push(submenuPosition(row, size, viewport));
    }
    positions = next;
  });

  function setHighlight(level: number, index: number): void {
    path = [...path.slice(0, level), index];
  }

  function openSubmenu(level: number, index: number, highlightFirst: boolean): void {
    const item = levels[level]?.[index];
    if (!item || !("submenu" in item) || item.disabled) {
      return;
    }
    path = [...path.slice(0, level), index, highlightFirst ? firstIndex(item.submenu) : -1];
    openDepth = level + 1;
    if (highlightFirst) {
      void tick().then(() => menuEls[level + 1]?.focus());
    }
  }

  function closeSubmenu(level: number): void {
    openDepth = level - 1;
    path = path.slice(0, level);
    void tick().then(() => menuEls[level - 1]?.focus());
  }

  function activate(level: number, index: number, fromKeyboard: boolean): void {
    const item = levels[level]?.[index];
    if (!item || "separator" in item || item.disabled) {
      return;
    }
    if ("submenu" in item) {
      if (openDepth > level && path[level] === index && !fromKeyboard) {
        openDepth = level;
        path = path.slice(0, level + 1);
      } else {
        openSubmenu(level, index, fromKeyboard);
      }
      return;
    }
    contextMenu.close(true);
    item.action();
  }

  function onHover(level: number, index: number): void {
    const item = levels[level]?.[index];
    if (!isSelectable(item)) {
      path = [...path.slice(0, level), -1];
      openDepth = level;
      return;
    }
    if (hasSubmenu(item)) {
      openSubmenu(level, index, false);
    } else {
      setHighlight(level, index);
      openDepth = level;
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    const level = focusLevel;
    const items = levels[level] ?? [];
    const current = path[level] ?? -1;
    let handled = true;
    if (event.key === "ArrowDown") {
      setHighlight(level, stepIndex(items, current, 1));
      openDepth = level;
    } else if (event.key === "ArrowUp") {
      setHighlight(level, stepIndex(items, current, -1));
      openDepth = level;
    } else if (event.key === "Home") {
      setHighlight(level, firstIndex(items));
      openDepth = level;
    } else if (event.key === "End") {
      setHighlight(level, lastIndex(items));
      openDepth = level;
    } else if (event.key === "ArrowRight") {
      if (current >= 0 && hasSubmenu(items[current])) {
        openSubmenu(level, current, true);
      }
    } else if (event.key === "ArrowLeft") {
      if (level > 0) {
        closeSubmenu(level);
      }
    } else if (event.key === "Escape") {
      if (level > 0) {
        closeSubmenu(level);
      } else {
        contextMenu.close(true);
      }
    } else if (event.key === "Enter" || event.key === " ") {
      if (current >= 0) {
        activate(level, current, true);
      }
    } else if (event.key === "Tab") {
      contextMenu.close(true);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const match = matchIndex(items, current, event.key);
      if (match >= 0) {
        setHighlight(level, match);
        openDepth = level;
      }
    } else {
      handled = false;
    }
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function itemId(level: number, index: number): string {
    return `context-menu-${level}-${index}`;
  }

  function activeId(level: number): string | undefined {
    const index = path[level] ?? -1;
    return index >= 0 ? itemId(level, index) : undefined;
  }
</script>

<svelte:window
  onmousedown={(event) => {
    if (contextMenu.visible && layerEl && !layerEl.contains(event.target as Node)) {
      contextMenu.close();
    }
  }}
  onkeydown={(event) => {
    if (event.key === "Escape" && contextMenu.visible && !event.defaultPrevented) {
      contextMenu.close(true);
    }
  }}
  onblur={() => contextMenu.close()}
/>

{#if contextMenu.visible}
  <div bind:this={layerEl} class="layer" role="presentation" onkeydown={onKeydown}>
    {#each levels as items, level (level)}
      {@const position = positions[level] ?? null}
      <div
        bind:this={menuEls[level]}
        class="menu"
        role="menu"
        tabindex="-1"
        aria-activedescendant={activeId(level)}
        style={position
          ? `left: ${position.left}px; top: ${position.top}px;`
          : `left: ${contextMenu.x}px; top: ${contextMenu.y}px; visibility: hidden;`}
      >
        {#each items as item, index (index)}
          {#if "separator" in item}
            <div class="separator" role="separator"></div>
          {:else}
            {@const open = "submenu" in item && openDepth > level && path[level] === index}
            <button
              id={itemId(level, index)}
              data-index={index}
              class="item"
              class:danger={"danger" in item && item.danger}
              class:highlighted={path[level] === index}
              role="menuitem"
              tabindex="-1"
              aria-haspopup={"submenu" in item ? "menu" : undefined}
              aria-expanded={"submenu" in item ? open : undefined}
              aria-disabled={item.disabled ? "true" : undefined}
              disabled={item.disabled}
              onmouseenter={() => onHover(level, index)}
              onclick={() => activate(level, index, false)}
            >
              <span class="label">{item.label}</span>
              {#if "submenu" in item}
                <span class="chevron"><Icon name="chevron-right" size={13} /></span>
              {:else if item.hint}
                <span class="hint">{item.hint}</span>
              {/if}
            </button>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
{/if}

<style>
  .layer {
    display: contents;
  }

  .menu {
    position: fixed;
    z-index: 950;
    min-width: 200px;
    max-height: calc(100vh - 8px);
    overflow-y: auto;
    padding: 4px;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: var(--shadow);
    outline: none;
  }

  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    width: 100%;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
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
    margin: 4px 6px;
    background: var(--border-strong);
  }
</style>
