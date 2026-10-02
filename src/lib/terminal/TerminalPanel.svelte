<!--
  The terminal panel below the editor, like VS Code's: a header with actions, the terminals and, with several, a list
  to switch between them. The terminals are mounted by TerminalHost and moved into the view area.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import ShelfPanel from "$lib/shelf/ShelfPanel.svelte";
  import RunView from "./RunView.svelte";
  import { DEFAULT_TERMINAL_LIST_WIDTH, MIN_TERMINAL_LIST_WIDTH, settings } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import ResizeHandle from "$lib/ui/ResizeHandle.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { type PanelTab, terminalStore } from "./terminalStore.svelte";
  import { folderLabel, maxListWidth } from "./terminals";

  let { height }: { height: number } = $props();

  const terminals = $derived(terminalStore.panelTerminals);
  const active = $derived(terminalStore.active);
  const several = $derived(terminals.length > 1);
  const tab = $derived(terminalStore.panelTab);
  const onTerminal = $derived(tab === "terminal");
  const ALL_TABS: { tab: PanelTab; label: string }[] = [
    { tab: "terminal", label: "Terminal" },
    { tab: "run", label: "Run" },
    { tab: "gitConsole", label: "Git Console" },
    { tab: "shelf", label: "Shelf" },
  ];
  // Run shows once a script ran, like JetBrains' Run window.
  const tabs = $derived(
    ALL_TABS.filter(
      (item) => (item.tab !== "gitConsole" || settings.gitConsole) && (item.tab !== "run" || terminalStore.runSessions.length > 0),
    ),
  );
  // Loaded on first use, so with the setting off none of its code is in memory.
  const loadGitConsole = () => import("$lib/console/GitConsoleView.svelte");
  let viewsEl = $state<HTMLDivElement | null>(null);
  let bodyWidth = $state(0);

  const listMax = $derived(maxListWidth(bodyWidth, MIN_TERMINAL_LIST_WIDTH));
  const listWidth = $derived(Math.min(listMax, Math.max(MIN_TERMINAL_LIST_WIDTH, settings.terminalListWidth)));

  // The panel's terminals are moved into the view area (see TerminalHost).
  $effect(() => {
    const element = viewsEl;
    if (!element) {
      return;
    }
    untrack(() => terminalStore.setPanelSlot(element));
    return () => {
      untrack(() => {
        if (terminalStore.panelSlot === element) {
          terminalStore.setPanelSlot(null);
        }
      });
    };
  });

  /** The chevron next to "+": every shell found, then the default shell setting. */
  async function openShellMenu(event: MouseEvent): Promise<void> {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const shells = await terminalStore.loadShells();
    const items: MenuItem[] = shells.map((shell) => ({
      label: shell.name,
      hint: shell.path,
      action: () => void terminalStore.create({ shellId: shell.id }),
    }));
    if (items.length === 0) {
      items.push({ label: "No shells found", disabled: true, action: () => undefined });
    }
    items.push(
      { separator: true },
      { label: "New Terminal in Editor Area", action: () => void terminalStore.create({ location: "editor" }) },
      { separator: true },
      { label: "Default Shell...", action: () => settings.openDialog("terminal") },
    );
    contextMenu.open(new MouseEvent("contextmenu", { clientX: rect.left, clientY: rect.bottom + 2 }), items);
  }

  function openTerminalMenu(event: MouseEvent, terminalKey: number): void {
    contextMenu.open(event, terminalStore.menuItems(terminalKey));
  }

  function killActive(): void {
    if (active) {
      terminalStore.close(active.key);
    }
  }

  function moveActiveToEditor(): void {
    if (active) {
      terminalStore.moveToEditor(active.key);
    }
  }
</script>

<section class="panel" class:hidden={!terminalStore.panelOpen} style="height: {height}px" aria-label="Bottom panel">
  <header class="head">
    <div class="tabs" role="tablist" aria-label="Panel views">
      {#each tabs as item (item.tab)}
        <button
          class="tab"
          class:selected={tab === item.tab}
          role="tab"
          aria-selected={tab === item.tab}
          onclick={() => terminalStore.showTab(item.tab)}
        >
          {item.label}
        </button>
      {/each}
    </div>
    {#if onTerminal && active && !several}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="single truncate"
        title="{active.name}{active.cwd ? `\n${active.cwd}` : ''}"
        oncontextmenu={(event) => openTerminalMenu(event, active.key)}
      >
        {active.name}
        <span class="folder">{folderLabel(active.cwd)}</span>
      </span>
    {/if}
    <div class="spacer"></div>
    {#if onTerminal}
      <div class="split">
        <button
          class="icon-btn small"
          onclick={() => void terminalStore.create()}
          title="New Terminal (Ctrl+Shift+`)"
          aria-label="New Terminal"
        >
          <Icon name="plus" size={15} />
        </button>
        <button
          class="icon-btn small chevron"
          onclick={(event) => void openShellMenu(event)}
          title="New Terminal With Shell..."
          aria-label="New terminal with shell"
        >
          <Icon name="chevron-down" size={12} />
        </button>
      </div>
      <button
        class="icon-btn small"
        onclick={moveActiveToEditor}
        disabled={!active}
        title="Move Terminal into Editor Area"
        aria-label="Move Terminal into Editor Area"
      >
        <Icon name="app-window" size={14} />
      </button>
      <button class="icon-btn small" onclick={killActive} disabled={!active} title="Kill Terminal" aria-label="Kill Terminal">
        <Icon name="trash" size={14} />
      </button>
    {/if}
    <button class="icon-btn small" onclick={() => terminalStore.hide()} title="Hide Panel (Ctrl+`)" aria-label="Hide panel">
      <Icon name="x" size={15} />
    </button>
  </header>

  <div class="body" bind:clientWidth={bodyWidth}>
    <!-- TerminalHost moves the panel's terminals in here; each stays mounted so its scrollback survives switching. -->
    <div class="views" class:hidden={!onTerminal} bind:this={viewsEl}></div>
    {#if !onTerminal && terminalStore.panelOpen}
      <div class="tool-view">
        {#if tab === "run"}
          <RunView />
        {:else if tab === "gitConsole" && settings.gitConsole}
          {#await loadGitConsole() then module}
            <module.default />
          {/await}
        {:else if tab === "shelf"}
          <ShelfPanel />
        {/if}
      </div>
    {/if}
    {#if onTerminal && several}
      <ResizeHandle
        label="Resize terminal list"
        panel="right"
        size={listWidth}
        min={MIN_TERMINAL_LIST_WIDTH}
        max={listMax}
        defaultSize={DEFAULT_TERMINAL_LIST_WIDTH}
        onResize={(width) => (settings.terminalListWidth = width)}
        onCommit={() => settings.save()}
      />
      <ul class="list" role="listbox" aria-label="Terminals" style="width: {listWidth}px">
        {#each terminals as terminal (terminal.key)}
          {@const isActive = terminal.key === terminalStore.activeKey}
          <li
            class="item"
            class:active={isActive}
            class:exited={terminal.exited}
            role="option"
            aria-selected={isActive}
            tabindex="-1"
            title="{terminal.name}{terminal.cwd ? `\n${terminal.cwd}` : ''}{terminal.exited ? '\nExited' : ''}"
            onclick={() => terminalStore.select(terminal.key)}
            onkeydown={() => undefined}
            oncontextmenu={(event) => openTerminalMenu(event, terminal.key)}
          >
            <Icon name="terminal" size={14} />
            <span class="name truncate">{terminal.name}</span>
            <span class="folder truncate">{folderLabel(terminal.cwd)}</span>
            <button
              class="kill"
              onclick={(event) => {
                event.stopPropagation();
                terminalStore.close(terminal.key);
              }}
              title="Kill Terminal"
              aria-label="Kill {terminal.name}"
            >
              <Icon name="trash" size={13} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<style>
  .panel {
    flex: none;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-top: 1px solid var(--border-strong);
    background: var(--editor-bg);
  }

  .panel.hidden {
    display: none;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 32px;
    padding: 0 6px 0 12px;
    background: var(--panel);
  }

  .tabs {
    flex: none;
    display: flex;
    align-items: stretch;
    align-self: stretch;
    gap: 14px;
  }

  .tab {
    position: relative;
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    cursor: pointer;
  }

  .tab:hover {
    color: var(--text);
  }

  .tab.selected {
    color: var(--text);
  }

  .tab.selected::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    border-radius: 2px;
    background: var(--accent);
  }

  .tab:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: 2px;
  }

  .tool-view {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .views.hidden {
    display: none;
  }

  .single {
    min-width: 0;
    margin-left: 14px;
    font-size: 12px;
  }

  .folder {
    color: var(--text-dim);
    margin-left: 6px;
  }

  .spacer {
    flex: 1;
  }

  .icon-btn.small {
    height: 24px;
    min-width: 24px;
    color: var(--text-dim);
  }

  .icon-btn.small:hover:not(:disabled) {
    color: var(--text);
  }

  .split {
    display: flex;
    align-items: center;
  }

  .icon-btn.small.chevron {
    min-width: 16px;
    padding: 0 2px;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .views {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .list {
    flex: none;
    margin: 0;
    padding: 4px 0;
    list-style: none;
    overflow-y: auto;
    background: var(--panel);
    border-left: 1px solid var(--border-strong);
  }

  .item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 6px 0 10px;
    color: var(--text-dim);
    cursor: default;
    white-space: nowrap;
  }

  .item:hover {
    background: var(--hover);
    color: var(--text);
  }

  .item.active {
    background: var(--selected-inactive);
    color: var(--text);
  }

  .item.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 2px;
    border-radius: 2px;
    background: var(--accent);
  }

  .item.exited .name {
    color: var(--text-faint);
  }

  .name {
    flex: 0 1 auto;
    min-width: 0;
  }

  .item .folder {
    flex: 1 1 auto;
    min-width: 0;
    margin-left: 0;
    font-size: 11px;
  }

  .kill {
    flex: none;
    display: none;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .item:hover .kill {
    display: inline-flex;
  }

  .kill:hover {
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    color: var(--danger);
  }
</style>
