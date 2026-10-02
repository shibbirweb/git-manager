<!--
  The terminal panel below the editor, like VS Code's: a slim header with actions, the shown group of terminals (split
  side by side) and, with several, a list to switch between them that shows split groups together. The terminals are
  mounted by TerminalHost and moved into their panes.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import ShelfPanel from "$lib/shelf/ShelfPanel.svelte";
  import RunView from "./RunView.svelte";
  import { DEFAULT_TERMINAL_LIST_WIDTH, MIN_TERMINAL_LIST_WIDTH, settings } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import ResizeHandle from "$lib/ui/ResizeHandle.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { platformName } from "$lib/update/releases";
  import { groupRowPosition, MIN_PANE_WIDTH } from "./splitPanes";
  import { type PanelTab, terminalStore } from "./terminalStore.svelte";
  import { folderLabel, maxListWidth, validateTerminalName } from "./terminals";

  let { height }: { height: number } = $props();

  const isMac = platformName(navigator.userAgent) === "macOS";
  const terminals = $derived(terminalStore.panelTerminals);
  const active = $derived(terminalStore.active);
  const several = $derived(terminals.length > 1);
  const tab = $derived(terminalStore.panelTab);
  const onTerminal = $derived(tab === "terminal");
  const paneKeys = $derived(terminalStore.activeGroupKeys);
  const split = $derived(paneKeys.length > 1);
  const paneSizes = $derived(active ? terminalStore.paneSizes(active.group, paneKeys.length) : []);
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
  let panesWidth = $state(0);
  /** The terminal whose name is being edited in place (double-click), and the text typed so far. */
  let renamingKey = $state<number | null>(null);
  let renameDraft = $state("");

  const listMax = $derived(maxListWidth(bodyWidth, MIN_TERMINAL_LIST_WIDTH));
  const listWidth = $derived(Math.min(listMax, Math.max(MIN_TERMINAL_LIST_WIDTH, settings.terminalListWidth)));
  const splitHint = isMac ? "Cmd+\\" : "Ctrl+Shift+5";

  // Terminals of the other groups wait, hidden, in the view area (see TerminalHost).
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

  /** A pane of the shown group: its terminal is moved in here. */
  function paneSlot(element: HTMLElement, terminalKey: number) {
    let key = terminalKey;
    untrack(() => terminalStore.setPaneSlot(key, element));
    return {
      update(nextKey: number) {
        untrack(() => {
          terminalStore.clearPaneSlot(key, element);
          key = nextKey;
          terminalStore.setPaneSlot(key, element);
        });
      },
      destroy() {
        untrack(() => terminalStore.clearPaneSlot(key, element));
      },
    };
  }

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

  function splitActive(): void {
    if (active) {
      void terminalStore.split(active.key);
    }
  }

  function startRename(terminalKey: number, name: string): void {
    renamingKey = terminalKey;
    renameDraft = name;
  }

  /** Enter or leaving the field keeps a valid name; Esc keeps the old one. */
  function finishRename(keep: boolean): void {
    const terminalKey = renamingKey;
    if (terminalKey === null) {
      return;
    }
    renamingKey = null;
    if (keep && validateTerminalName(renameDraft) === null) {
      terminalStore.rename(terminalKey, renameDraft);
    }
    terminalStore.requestFocus(terminalKey);
  }

  function onRenameKey(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      finishRename(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finishRename(false);
    }
  }

  function focusAndSelect(element: HTMLInputElement): void {
    requestAnimationFrame(() => {
      element.focus();
      element.select();
    });
  }
</script>

{#snippet renameField(name: string)}
  <input
    class="rename"
    class:invalid={validateTerminalName(renameDraft) !== null}
    bind:value={renameDraft}
    use:focusAndSelect
    spellcheck="false"
    autocomplete="off"
    aria-label="Rename {name}"
    onkeydown={onRenameKey}
    onblur={() => finishRename(true)}
    onclick={(event) => event.stopPropagation()}
    ondblclick={(event) => event.stopPropagation()}
  />
{/snippet}

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
        class="single"
        title="{active.name}{active.cwd ? `\n${active.cwd}` : ''}\nDouble-click to rename"
        oncontextmenu={(event) => openTerminalMenu(event, active.key)}
        ondblclick={() => startRename(active.key, active.name)}
      >
        {#if renamingKey === active.key}
          {@render renameField(active.name)}
        {:else}
          <span class="name truncate">{active.name}</span>
          <span class="folder truncate">{folderLabel(active.cwd)}</span>
        {/if}
        {#if active.bell}
          <span class="bell" title="The bell rang"></span>
        {/if}
      </span>
    {/if}
    <div class="spacer"></div>
    {#if onTerminal}
      <div class="new">
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
        onclick={splitActive}
        disabled={!active}
        title="Split Terminal ({splitHint})"
        aria-label="Split Terminal"
      >
        <Icon name="split-view" size={14} />
      </button>
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
      <span class="divider" aria-hidden="true"></span>
    {/if}
    <button class="icon-btn small" onclick={() => terminalStore.hide()} title="Hide Panel (Ctrl+`)" aria-label="Hide panel">
      <Icon name="x" size={15} />
    </button>
  </header>

  <div class="body" bind:clientWidth={bodyWidth}>
    <!-- The shown group's panes; terminals of other groups are parked, hidden, in here too. -->
    <div class="views" class:hidden={!onTerminal} bind:this={viewsEl}>
      <div class="panes" bind:clientWidth={panesWidth}>
        {#each paneKeys as terminalKey, index (terminalKey)}
          {#if index > 0 && active && panesWidth > 0}
            {@const pair = (paneSizes[index - 1] ?? 0) + (paneSizes[index] ?? 0)}
            <ResizeHandle
              label="Resize split terminals"
              panel="left"
              size={(paneSizes[index - 1] ?? 0) * panesWidth}
              min={MIN_PANE_WIDTH}
              max={Math.max(MIN_PANE_WIDTH, pair * panesWidth - MIN_PANE_WIDTH)}
              defaultSize={(pair * panesWidth) / 2}
              onResize={(width) => {
                if (active) {
                  terminalStore.resizePane(active.group, index - 1, width / panesWidth, MIN_PANE_WIDTH / panesWidth);
                }
              }}
            />
          {/if}
          <div
            class="pane"
            class:focused={split && terminalKey === terminalStore.activeKey}
            class:after-first={index > 0}
            style="flex: {paneSizes[index] ?? 1} 1 0px"
            use:paneSlot={terminalKey}
          ></div>
        {/each}
      </div>
    </div>
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
        {#each terminalStore.panelGroups as group (group.group)}
          {#each group.terminalKeys as terminalKey (terminalKey)}
            {@const terminal = terminals.find((entry) => entry.key === terminalKey)}
            {#if terminal}
              {@const isActive = terminal.key === terminalStore.activeKey}
              {@const position = groupRowPosition(group, terminal.key)}
              <li
                class="item"
                class:active={isActive}
                class:shown={!isActive && paneKeys.includes(terminal.key)}
                class:exited={terminal.exited}
                role="option"
                aria-selected={isActive}
                tabindex="-1"
                title="{terminal.name}{terminal.cwd ? `\n${terminal.cwd}` : ''}{terminal.exited ? '\nExited' : ''}"
                onclick={() => terminalStore.select(terminal.key)}
                ondblclick={() => startRename(terminal.key, terminal.name)}
                onkeydown={() => undefined}
                oncontextmenu={(event) => openTerminalMenu(event, terminal.key)}
              >
                {#if position !== "single"}
                  <span class="tree {position}" aria-hidden="true"></span>
                {/if}
                <Icon name="terminal" size={14} />
                {#if renamingKey === terminal.key}
                  {@render renameField(terminal.name)}
                {:else}
                  <span class="name truncate">{terminal.name}</span>
                  <span class="folder truncate">{folderLabel(terminal.cwd)}</span>
                {/if}
                {#if terminal.bell}
                  <span class="bell" title="The bell rang"></span>
                {/if}
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
            {/if}
          {/each}
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

  /* About 29 px, like the editor's slim path bar. */
  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 1px;
    height: 29px;
    padding: 0 6px 0 10px;
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel);
    font-size: 12px;
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
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    margin-left: 14px;
  }

  .folder {
    color: var(--text-dim);
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

  .new {
    display: flex;
    align-items: center;
  }

  .icon-btn.small.chevron {
    min-width: 16px;
    padding: 0 2px;
  }

  .divider {
    flex: none;
    width: 1px;
    height: 14px;
    margin: 0 4px;
    background: var(--border-strong);
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

  .panes {
    position: absolute;
    inset: 0;
    display: flex;
  }

  .pane {
    position: relative;
    min-width: 0;
    overflow: hidden;
  }

  .pane.after-first {
    border-left: 1px solid var(--border-strong);
  }

  /* The focused one of split terminals, like VS Code's active pane. */
  .pane.focused::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 1px;
    z-index: 2;
    background: var(--accent);
    pointer-events: none;
  }

  .list {
    flex: none;
    margin: 0;
    padding: 2px 0;
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
    height: 26px;
    padding: 0 4px 0 10px;
    color: var(--text-dim);
    font-size: 12px;
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

  .item.shown {
    color: var(--text);
  }

  .item.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 5px;
    bottom: 5px;
    width: 2px;
    border-radius: 2px;
    background: var(--accent);
  }

  .item.exited .name {
    color: var(--text-faint);
  }

  /* Tree lines that join the rows of one split group, like VS Code's terminal list. */
  .tree {
    flex: none;
    position: relative;
    align-self: stretch;
    width: 6px;
    margin-right: -2px;
  }

  .tree::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-left: 1px solid var(--border-strong);
  }

  .tree.first::before {
    top: 50%;
  }

  .tree.last::before {
    bottom: 50%;
  }

  .tree::after {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 6px;
    border-top: 1px solid var(--border-strong);
  }

  .name {
    flex: 0 1 auto;
    min-width: 0;
  }

  .item .folder {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 11px;
  }

  .rename {
    flex: 1;
    min-width: 0;
    height: 20px;
    padding: 0 4px;
    border: 1px solid var(--accent);
    border-radius: 3px;
    outline: none;
    background: var(--editor-bg);
    color: var(--text);
    font: inherit;
  }

  .rename.invalid {
    border-color: var(--danger);
  }

  .bell {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--warning);
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
