<!--
  The Scripts tool window: every script of the workspace
  folders' package.json, composer.json, Makefiles, deno.json and justfiles. Double-click or Enter
  runs one in a new terminal. Mounted only while it shows; the list is read again on every mount.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { NodeInstall, ProjectScript, ScriptSource } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem, type MenuSubmenu } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import PanelHead from "$lib/views/PanelHead.svelte";
  import { NODE_RUNNERS, type ScriptRow, scriptCommand, scriptRows, sourceLabel } from "./scriptsModel";
  import { runProjectScript } from "./scriptActions";
  import { describeRun as describeScriptRun, nodePickFor, withRunner } from "./scriptRun";
  import { runnerOverrides } from "./runnerOverrides.svelte";
  import { type NodePick, nodeBadge, nodeTitle, pickNode, SHELL_DEFAULT } from "./nodeVersion";

  const ROW_ID_PREFIX = "script-row-";

  let sources = $state.raw<ScriptSource[]>([]);
  let nodeInstalls = $state.raw<NodeInstall[]>([]);
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let filter = $state("");
  let collapsed = $state.raw<Set<string>>(new Set());
  let selectedKey = $state<string | null>(null);
  let treeEl = $state<HTMLDivElement | null>(null);
  let loadToken = 0;

  const folderPaths = $derived((repoStore.workspace?.folders ?? []).map((folder) => folder.root));
  const severalFolders = $derived(folderPaths.length > 1);
  const shown = $derived(sources.map((source) => withRunner(source, runnerOverrides.get(source.filePath))));
  const rows = $derived(scriptRows(shown, filter, (filePath) => collapsed.has(filePath)));
  const selectedIndex = $derived(rows.findIndex((row) => row.key === selectedKey));
  const scriptCount = $derived(sources.reduce((sum, source) => sum + source.scripts.length, 0));

  $effect(() => {
    void load(folderPaths);
  });

  /** The Node version a package.json's scripts run with; null for other kinds. */
  function nodePick(source: ScriptSource): NodePick | null {
    return nodePickFor(source, nodeInstalls, settings.scriptNodeVersions);
  }

  async function load(paths: string[]): Promise<void> {
    const token = ++loadToken;
    if (paths.length === 0) {
      sources = [];
      return;
    }
    loading = true;
    try {
      // Installed versions are read with the scripts, so Refresh also finds a newly installed one.
      const [found, installs] = await Promise.all([api.listProjectScripts(paths), api.listNodeVersions().catch(() => [])]);
      if (token === loadToken) {
        sources = found ?? [];
        nodeInstalls = installs ?? [];
        loadError = null;
      }
    } catch (error) {
      if (token === loadToken) {
        loadError = errorMessage(error);
      }
    } finally {
      if (token === loadToken) {
        loading = false;
      }
    }
  }

  function commandFor(source: ScriptSource, script: ProjectScript): string {
    return scriptCommand(source.kind, source.runner, script.name);
  }

  function describeRun(source: ScriptSource, script: ProjectScript): string {
    return describeScriptRun(source, script, nodePick(source));
  }

  function run(source: ScriptSource, script: ProjectScript): void {
    void runProjectScript(source, script, nodeInstalls);
  }

  function nodeMenu(source: ScriptSource): MenuSubmenu {
    const pick = nodePick(source);
    const choice = settings.scriptNodeVersions[source.filePath] ?? null;
    const auto = pickNode(source.nodeVersion ?? null, nodeInstalls, null);
    const autoHint = auto.install ? `${auto.install.version}, ${auto.wanted?.source ?? ""}` : auto.missing ? `${auto.wanted?.spec} missing` : "shell default";
    const current = (value: string | null) => (value === choice || (value === null && pick?.mode === "auto") ? "in use" : undefined);
    const items: MenuItem[] = [
      { label: "Auto (Follow Project)", hint: current(null) ?? autoHint, action: () => settings.setScriptNodeVersion(source.filePath, null) },
      { label: "Shell Default", hint: current(SHELL_DEFAULT), action: () => settings.setScriptNodeVersion(source.filePath, SHELL_DEFAULT) },
    ];
    if (nodeInstalls.length > 0) {
      items.push({ separator: true });
    }
    for (const install of nodeInstalls) {
      items.push({
        label: `${install.version} (${install.manager})`,
        hint: current(install.binDir),
        action: () => settings.setScriptNodeVersion(source.filePath, install.binDir),
      });
    }
    return { label: "Node Version", submenu: items };
  }

  function jumpToSource(source: ScriptSource, script: ProjectScript | null): void {
    const line = script && script.line > 0 ? script.line - 1 : null;
    void navigation.openFileAt(source.filePath, line, 0, { pin: true });
  }

  async function copyCommand(source: ScriptSource, script: ProjectScript): Promise<void> {
    try {
      await navigator.clipboard.writeText(commandFor(source, script));
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  function toggle(filePath: string): void {
    const next = new Set(collapsed);
    if (next.has(filePath)) {
      next.delete(filePath);
    } else {
      next.add(filePath);
    }
    collapsed = next;
  }

  function setExpanded(filePath: string, expanded: boolean): void {
    if (expanded === !collapsed.has(filePath)) {
      return;
    }
    toggle(filePath);
  }

  function collapseAll(): void {
    collapsed = new Set(sources.map((source) => source.filePath));
  }

  function expandAll(): void {
    collapsed = new Set();
  }

  function menuFor(row: ScriptRow): MenuItem[] {
    if (row.kind === "script") {
      return [
        { label: `Run '${row.script.name}'`, action: () => run(row.source, row.script) },
        { separator: true },
        { label: "Copy Command", action: () => void copyCommand(row.source, row.script) },
        { label: "Jump to Source", action: () => jumpToSource(row.source, row.script) },
      ];
    }
    const items: MenuItem[] = [{ label: "Open File", action: () => jumpToSource(row.source, null) }];
    if (row.source.kind === "npm") {
      items.push(nodeMenu(row.source));
      if (row.source.nodeVersion) {
        const wantedFile = row.source.nodeVersion.filePath;
        items.push({ label: `Open ${row.source.nodeVersion.source.split(" ")[0]}`, action: () => void navigation.openFileAt(wantedFile, null, 0, { pin: true }) });
      }
      const detected = sources.find((source) => source.filePath === row.source.filePath)?.runner ?? row.source.runner;
      items.push({
        label: "Run With",
        submenu: NODE_RUNNERS.map((runner) => ({
          label: runner,
          hint: runner === row.source.runner ? "in use" : runner === detected ? "detected" : undefined,
          action: () => runnerOverrides.set(row.source.filePath, runner === detected ? null : runner),
        })),
      });
    }
    items.push(
      { separator: true },
      { label: "Expand All", action: expandAll },
      { label: "Collapse All", action: collapseAll },
      { label: "Refresh", action: () => void load(folderPaths) },
    );
    return items;
  }

  function rowId(index: number): string {
    return `${ROW_ID_PREFIX}${index}`;
  }

  async function selectIndex(index: number): Promise<void> {
    const row = rows[index] ?? null;
    if (!row) {
      return;
    }
    selectedKey = row.key;
    await tick();
    document.getElementById(rowId(index))?.scrollIntoView({ block: "nearest" });
  }

  function activate(row: ScriptRow | null): void {
    if (!row) {
      return;
    }
    if (row.kind === "script") {
      run(row.source, row.script);
    } else {
      toggle(row.source.filePath);
    }
  }

  function onRowClick(row: ScriptRow): void {
    selectedKey = row.key;
    treeEl?.focus({ preventScroll: true });
    if (row.kind === "source") {
      toggle(row.source.filePath);
    }
  }

  function onRowContextMenu(event: MouseEvent, row: ScriptRow): void {
    selectedKey = row.key;
    treeEl?.focus({ preventScroll: true });
    contextMenu.open(event, menuFor(row));
  }

  function openMenuFromKeyboard(index: number): void {
    const row = rows[index] ?? null;
    const element = document.getElementById(rowId(index));
    if (!row || !element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    contextMenu.open(new MouseEvent("contextmenu", { clientX: rect.left + 24, clientY: rect.bottom }), menuFor(row), { keyboard: true });
  }

  function onTreeKeydown(event: KeyboardEvent): void {
    if (rows.length === 0 || event.target instanceof HTMLButtonElement) {
      return;
    }
    const index = selectedIndex;
    const row = rows[index] ?? null;
    switch (event.key) {
      case "ArrowDown":
        void selectIndex(index < 0 ? 0 : Math.min(index + 1, rows.length - 1));
        break;
      case "ArrowUp":
        void selectIndex(index <= 0 ? 0 : index - 1);
        break;
      case "Home":
        void selectIndex(0);
        break;
      case "End":
        void selectIndex(rows.length - 1);
        break;
      case "ArrowRight":
        if (row?.kind === "source" && !row.expanded) {
          setExpanded(row.source.filePath, true);
        } else if (row?.kind === "source") {
          void selectIndex(index + 1);
        }
        break;
      case "ArrowLeft":
        if (row?.kind === "source" && row.expanded) {
          setExpanded(row.source.filePath, false);
        } else if (row?.kind === "script") {
          void selectIndex(rows.findIndex((candidate) => candidate.key === row.parentKey));
        }
        break;
      case "Enter":
        activate(row);
        break;
      case "ContextMenu":
        openMenuFromKeyboard(index);
        break;
      case "F10":
        if (!event.shiftKey) {
          return;
        }
        openMenuFromKeyboard(index);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function onFilterKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && filter) {
      event.preventDefault();
      filter = "";
    } else if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      const firstScript = rows.findIndex((row) => row.kind === "script");
      treeEl?.focus();
      void selectIndex(firstScript >= 0 ? firstScript : 0);
    }
  }

  function scriptTitle(source: ScriptSource, script: ProjectScript): string {
    const command = describeRun(source, script);
    return script.command ? `${command}\n${script.command}` : command;
  }
</script>

<div class="scripts-view">
  <PanelHead title="Scripts" hideTitle="Hide (Option+Cmd+B)" onhide={() => settings.setLeftPanel(null)}>
    <button class="icon-btn small" title="Collapse All" aria-label="Collapse all" onclick={collapseAll} disabled={sources.length === 0}>
      <Icon name="chevrons-left" size={14} />
    </button>
    <button class="icon-btn small" title="Refresh" aria-label="Refresh scripts" onclick={() => void load(folderPaths)} disabled={loading}>
      <Icon name="refresh" size={13} />
    </button>
  </PanelHead>
  <div class="toolbar">
    <div class="filter">
      <span class="filter-icon"><Icon name="search" size={13} /></span>
      <input
        class="input filter-input"
        type="text"
        placeholder="Filter scripts"
        aria-label="Filter scripts"
        spellcheck="false"
        autocomplete="off"
        bind:value={filter}
        onkeydown={onFilterKeydown}
      />
      {#if filter}
        <button class="icon-btn clear" title="Clear filter" aria-label="Clear filter" onclick={() => (filter = "")}>
          <Icon name="x" size={12} />
        </button>
      {/if}
    </div>
  </div>

  <div
    bind:this={treeEl}
    class="tree"
    role="tree"
    tabindex="0"
    aria-label="Scripts"
    aria-busy={loading}
    aria-activedescendant={selectedIndex >= 0 ? rowId(selectedIndex) : undefined}
    onkeydown={onTreeKeydown}
  >
    {#each rows as row, index (row.key)}
      <div
        id={rowId(index)}
        class="row"
        class:selected={index === selectedIndex}
        class:script={row.kind === "script"}
        role="treeitem"
        tabindex="-1"
        aria-level={row.kind === "script" ? 2 : 1}
        aria-selected={index === selectedIndex}
        aria-expanded={row.kind === "source" ? row.expanded : undefined}
        onclick={() => onRowClick(row)}
        ondblclick={() => {
          if (row.kind === "script") {
            activate(row);
          }
        }}
        oncontextmenu={(event) => onRowContextMenu(event, row)}
        onkeydown={(event) => {
          event.stopPropagation();
          onTreeKeydown(event);
        }}
      >
        {#if row.kind === "source"}
          {@const label = sourceLabel(row.source, severalFolders)}
          <Icon name={row.expanded ? "chevron-down" : "chevron-right"} size={12} />
          <Icon name="file" size={14} />
          <span class="title truncate" title={row.source.filePath}>{label.title}</span>
          {#if label.detail}
            <span class="detail dim truncate">{label.detail}</span>
          {/if}
          <span class="spacer"></span>
          {#if row.source.error}
            <span class="error-mark" title={row.source.error}><Icon name="alert" size={13} /></span>
          {:else}
            {@const pick = nodePick(row.source)}
            {#if pick && nodeBadge(pick)}
              <button
                class="node-badge"
                class:missing={pick.missing}
                title="{nodeTitle(pick)}. Click to change."
                onclick={(event) => {
                  event.stopPropagation();
                  contextMenu.open(event, nodeMenu(row.source).submenu);
                }}
              >
                {nodeBadge(pick)}
              </button>
            {/if}
            <span class="runner dim">{row.source.runner}</span>
          {/if}
        {:else}
          <button
            class="icon-btn run"
            title="Run '{row.script.name}'"
            aria-label="Run {row.script.name}"
            onclick={(event) => {
              event.stopPropagation();
              run(row.source, row.script);
            }}
          >
            <Icon name="play" size={11} />
          </button>
          <span class="name truncate" title={scriptTitle(row.source, row.script)}>{row.script.name}</span>
          {#if row.script.command}
            <span class="detail dim truncate">{row.script.command}</span>
          {/if}
        {/if}
      </div>
    {/each}
    {#if loadError}
      <div class="note dim">Could not read the scripts: {loadError}</div>
    {:else if rows.length === 0 && !loading}
      <div class="note dim">
        {#if filter.trim() && scriptCount > 0}
          No matching scripts
        {:else if folderPaths.length === 0}
          Open a folder to see its scripts.
        {:else}
          No scripts found. Scripts come from package.json, composer.json, Makefiles, deno.json and justfiles.
        {/if}
      </div>
    {:else if rows.length === 0}
      <div class="note dim">Looking for scripts...</div>
    {/if}
  </div>
</div>

<style>
  .scripts-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }

  .filter {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .filter-icon {
    position: absolute;
    left: 8px;
    display: inline-flex;
    color: var(--text-dim);
    pointer-events: none;
  }

  .filter-input {
    flex: 1;
    min-width: 0;
    height: 26px;
    padding-left: 26px;
    padding-right: 26px;
  }

  .clear {
    position: absolute;
    right: 3px;
    height: 20px;
    min-width: 20px;
    padding: 0;
    color: var(--text-dim);
  }

  .tree {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0 8px;
    outline: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 8px 0 6px;
    white-space: nowrap;
    outline: none;
    color: var(--text);
  }

  .row.script {
    padding-left: 22px;
  }

  .row:hover {
    background: var(--hover);
  }

  .row.selected {
    background: var(--selected-inactive);
  }

  .tree:focus .row.selected,
  .tree:focus-within .row.selected {
    background: var(--selected);
  }

  .title,
  .name {
    flex: none;
    max-width: 70%;
  }

  .title {
    font-weight: 500;
  }

  .detail {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 12px;
  }

  .spacer {
    flex: 1;
  }

  .runner {
    flex: none;
    font-size: 11px;
  }

  .node-badge {
    flex: none;
    height: 18px;
    padding: 0 5px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    font-size: 11px;
    cursor: pointer;
  }

  .node-badge:hover {
    color: var(--text);
    background: var(--hover);
  }

  .node-badge.missing {
    color: var(--warning);
    border-color: color-mix(in srgb, var(--warning) 50%, transparent);
  }

  .error-mark {
    display: inline-flex;
    color: var(--warning);
  }

  .run {
    flex: none;
    width: 18px;
    height: 18px;
    min-width: 18px;
    padding: 0;
    color: var(--success);
  }

  .note {
    padding: 12px 16px;
    font-size: 12px;
    line-height: 1.5;
  }
</style>
