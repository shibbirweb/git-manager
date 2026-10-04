<!-- Settings dialog. Every change is applied immediately and saved to ~/.gitmanager/settings.json. -->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import {
    CARET_EXTRA_RANGE,
    clampTerminalScrollback,
    DEFAULT_EDITOR_FONT,
    DEFAULT_RULER_COLUMN,
    defaultPreferences,
    EDITOR_CURSOR_BLINKING_CHOICES,
    EDITOR_CURSOR_STYLE_CHOICES,
    EDITOR_CURSOR_WIDTH_RANGE,
    type EditorCursorBlinking,
    type EditorCursorStyle,
    EDITOR_FONT_WEIGHT_RANGE,
    EDITOR_LINE_HEIGHT_RANGE,
    EDITOR_RULER_RANGE,
    FILE_ICON_CHOICES,
    FILE_TOOLBAR_CHOICES,
    FILE_TOOLBAR_SWITCHES,
    FONT_SIZE_RANGE,
    fontWeightName,
    type MarkdownViewMode,
    MONOSPACE_FONTS,
    normalizeFontFamily,
    normalizeTerminalFontFamily,
    pickRulerColumn,
    type Preferences,
    RENDER_WHITESPACE_CHOICES,
    settings,
    type SettingsSection,
    TAB_SIZES,
    TERMINAL_LETTER_SPACING_RANGE,
    TERMINAL_LINE_HEIGHT_RANGE,
    TERMINAL_SCROLLBACK_RANGE,
    type TerminalCursorStyle,
    type TerminalFontWeight,
    type ThemeSetting,
  } from "$lib/stores/settings.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { buildTerminalFontFamily, TERMINAL_FONT_PICKS, xtermFontWeight } from "$lib/terminal/fonts";
  import { terminalStore } from "$lib/terminal/terminalStore.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { updates } from "$lib/update/updates.svelte";
  import { claudeAddCommand, cliExamples, cliPrefix, LOCAL_BIN_PATH_LINE, maskToken, mcpJsonConfig } from "$lib/mcp/connect";
  import { mcpStore } from "$lib/mcp/mcpStore.svelte";
  import { memoryLog } from "$lib/debug/memoryLog.svelte";
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import { MCP_PORT_RANGE, parseMcpPort } from "$lib/stores/settingsData";
  import GitHubSignInForm from "./github/GitHubSignInForm.svelte";
  import ColorThemePicker from "./settings/ColorThemePicker.svelte";
  import CommitTemplateSettings from "./settings/CommitTemplateSettings.svelte";
  import GitIdentitySettings from "./settings/GitIdentitySettings.svelte";
  import KeyboardShortcuts from "./settings/KeyboardShortcuts.svelte";
  import MemoryFlag from "./settings/MemoryFlag.svelte";
  import { CARET_EXTRA_ROWS, EDITOR_FEATURE_ROWS, SAVE_CLEANUP_ROWS } from "./settings/settingsRows";
  import { UNLOAD_TAB_MINUTES } from "$lib/stores/tabSleep";
  import { matchingEntries, searchWords, textMatches } from "./settings/settingsSearch";
  import { clearSettingsMatches, showSettingsMatches } from "./settings/settingsHighlight";
  import { commandSpecs, currentPlatform } from "$lib/commands/commandRuntime";
  import { shortcutRows } from "$lib/commands/shortcutSettings";
  import type { GpgSign } from "$lib/types";
  import { GPG_SIGN_CHOICES } from "./changes/commitOptions";
  import { AUTO_SAVE_DELAY_RANGE } from "$lib/editor/autoSave";
  import { AUTO_FETCH_INTERVAL_RANGE } from "$lib/stores/autoFetchPlan";
  import { DEFAULT_TAB_LIMIT_NUMBER, NO_TAB_LIMIT, pickTabLimit, SINGLE_TAB, TAB_LIMIT_RANGE } from "$lib/stores/tabLimit";
  import type { AutoSaveMode } from "$lib/stores/settingsData";
  import { localHistory } from "$lib/localHistory/localHistory.svelte";
  import { usageText } from "$lib/localHistory/localHistoryModel";
  import type { LocalHistoryUsage } from "$lib/types";

  const channels: { value: "auto" | "stable" | "beta"; label: string }[] = [
    { value: "auto", label: "Automatic" },
    { value: "stable", label: "Stable" },
    { value: "beta", label: "Beta" },
  ];

  function checkedLabel(): string {
    if (updates.checking) {
      return "Checking...";
    }
    if (updates.error) {
      return `Last check failed: ${updates.error}`;
    }
    if (!updates.checkedAt) {
      return "Not checked yet";
    }
    const minutes = Math.round((Date.now() - updates.checkedAt) / 60000);
    const when = minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
    if (updates.newer.length === 0) {
      return `Checked ${when}: up to date`;
    }
    return `Checked ${when}: ${updates.newer[0].version} is available${updates.newestSkipped ? " (skipped)" : ""}`;
  }

  const sections: { id: SettingsSection; label: string }[] = [
    { id: "appearance", label: "Appearance" },
    { id: "editor", label: "Editor" },
    { id: "merge", label: "Git" },
    { id: "layout", label: "Layout" },
    { id: "terminal", label: "Terminal" },
    { id: "keyboard", label: "Keyboard Shortcuts" },
    { id: "github", label: "GitHub" },
    { id: "automation", label: "Automation" },
    { id: "updates", label: "Updates" },
    { id: "files", label: "Settings Files" },
    { id: "about", label: "About" },
  ];

  const themes: { value: ThemeSetting; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  const fontWeights: { value: TerminalFontWeight; label: string }[] = [
    { value: "normal", label: "Normal" },
    { value: "medium", label: "Medium" },
    { value: "bold", label: "Bold" },
  ];

  const markdownModes: { value: MarkdownViewMode; label: string }[] = [
    { value: "editor", label: "Editor only" },
    { value: "split", label: "Editor and preview" },
    { value: "preview", label: "Preview only" },
  ];

  const cursorStyles: { value: TerminalCursorStyle; label: string }[] = [
    { value: "block", label: "Block" },
    { value: "bar", label: "Bar" },
    { value: "underline", label: "Underline" },
  ];

  let section = $state<SettingsSection>(settings.dialogSection);

  // Search: the section list keeps the sections with a match and the open one highlights them.
  let searchQuery = $state("");
  let searchInput = $state<HTMLInputElement | null>(null);
  let rowsEl = $state<HTMLDivElement | null>(null);
  const shortcutPlatform = currentPlatform();
  const shortcutSpecs = commandSpecs(shortcutPlatform);
  const sectionLabels = Object.fromEntries(sections.map((item) => [item.id, item.label])) as Record<SettingsSection, string>;
  const searchTerms = $derived(searchWords(searchQuery));
  const searching = $derived(searchTerms.length > 0);
  const foundEntries = $derived(matchingEntries(searchTerms, sectionLabels));
  /** Commands the Keyboard Shortcuts list shows for this search. */
  const foundShortcuts = $derived(
    searching
      ? shortcutRows(shortcutSpecs, settings.keybindings, shortcutPlatform, { query: searchQuery, keys: null, changedOnly: false }).length
      : 0,
  );
  const visibleSections = $derived(
    searching
      ? sections.filter(
          (item) =>
            textMatches(item.label, searchTerms) ||
            foundEntries.some((entry) => entry.section === item.id) ||
            (item.id === "keyboard" && foundShortcuts > 0),
        )
      : sections,
  );

  /** Nothing matches anywhere, so the open section has nothing to show. */
  const sectionUnmatched = $derived(searching && !visibleSections.some((item) => item.id === section));

  // Stay on the open section while it still matches; otherwise show the first one that does.
  $effect(() => {
    const first = visibleSections[0];
    if (first && !visibleSections.some((item) => item.id === untrack(() => section))) {
      section = first.id;
    }
  });

  let lastScrolled = "";
  $effect(() => {
    const rootEl = rowsEl;
    const entries = foundEntries.filter((entry) => entry.section === section);
    const words = searchTerms;
    const scrollKey = `${section}\n${searchQuery}`;
    if (!rootEl || !searching) {
      clearSettingsMatches(rootEl);
      lastScrolled = "";
      return;
    }
    const show = (): void => {
      showSettingsMatches(rootEl, entries, words);
    };
    show();
    if (lastScrolled !== scrollKey) {
      lastScrolled = scrollKey;
      rootEl.scrollTop = 0;
    }
    // Rows come and go as switches change (a sub-row shows when its switch turns on).
    const observer = new MutationObserver(show);
    observer.observe(rootEl, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
    };
  });
  $effect(() => () => clearSettingsMatches(null));

  onMount(() => {
    searchInput?.focus();
  });

  /** The shell list is asked for the first time the Terminal section shows. */
  let shellsLoaded = $state(false);
  $effect(() => {
    if (section === "terminal" && !shellsLoaded) {
      void terminalStore.loadShells().then(() => {
        shellsLoaded = true;
      });
    }
  });
  const loginShell = $derived(terminalStore.shells.find((shell) => shell.isDefault) ?? null);
  const savedShellMissing = $derived(
    settings.terminalShell !== null && !terminalStore.shells.some((shell) => shell.id === settings.terminalShell),
  );

  // Dragging by the title areas. The offset is relative to the centered position.
  const KEEP_VISIBLE = 60;
  let dialogEl = $state<HTMLDivElement | null>(null);
  let offset = $state({ x: 0, y: 0 });
  let dragging = $state(false);
  let dragStart = { pointerX: 0, pointerY: 0, x: 0, y: 0, left: 0, top: 0, width: 0, height: 0 };

  function startDrag(event: PointerEvent): void {
    // Buttons and inputs inside the title areas keep working normally.
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, input, a") || !dialogEl) {
      return;
    }
    event.preventDefault();
    const rect = dialogEl.getBoundingClientRect();
    dragStart = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: offset.x,
      y: offset.y,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function drag(event: PointerEvent): void {
    if (!dragging) {
      return;
    }
    const dx = event.clientX - dragStart.pointerX;
    const dy = event.clientY - dragStart.pointerY;
    // Keep part of the dialog (and its title) on screen so it can always be grabbed again.
    const minDx = KEEP_VISIBLE - dragStart.left - dragStart.width;
    const maxDx = window.innerWidth - KEEP_VISIBLE - dragStart.left;
    const minDy = -dragStart.top;
    const maxDy = window.innerHeight - KEEP_VISIBLE - dragStart.top;
    offset = {
      x: dragStart.x + Math.min(maxDx, Math.max(minDx, dx)),
      y: dragStart.y + Math.min(maxDy, Math.max(minDy, dy)),
    };
  }

  function endDrag(event: PointerEvent): void {
    if (!dragging) {
      return;
    }
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function recenter(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest("button, input, a")) {
      offset = { x: 0, y: 0 };
    }
  }
  /** Font list being typed; applied on Enter or when the field loses focus. */
  let fontDraft = $state(settings.editorFontFamily);

  function applyFont(): void {
    const next = normalizeFontFamily(fontDraft);
    fontDraft = next;
    if (next !== settings.editorFontFamily) {
      set("editorFontFamily", next);
    }
  }

  function addFont(family: string): void {
    const quoted = /\s/.test(family) ? `'${family}'` : family;
    fontDraft = normalizeFontFamily(`${quoted}, ${DEFAULT_EDITOR_FONT}`);
    applyFont();
  }

  /** Terminal font list being typed; empty means the editor font. */
  let terminalFontDraft = $state(settings.terminalFontFamily);

  function applyTerminalFont(): void {
    const next = normalizeTerminalFontFamily(terminalFontDraft);
    terminalFontDraft = next;
    if (next !== settings.terminalFontFamily) {
      set("terminalFontFamily", next);
    }
  }

  function addTerminalFont(family: string): void {
    const quoted = /\s/.test(family) ? `'${family}'` : family;
    terminalFontDraft = normalizeFontFamily(`${quoted}, ${DEFAULT_EDITOR_FONT}`);
    applyTerminalFont();
  }

  /** What the terminal would render with, for the preview. */
  const terminalPreviewFont = $derived(
    buildTerminalFontFamily({
      terminalFontFamily: normalizeTerminalFontFamily(terminalFontDraft),
      editorFontFamily: settings.editorFontFamily,
      nerdFontIcons: settings.terminalNerdFontIcons,
    }),
  );

  /** Typed scrollback (null while the field is empty), kept until the field is committed. */
  let scrollbackDraft = $state<number | null>(settings.terminalScrollback);

  function applyScrollback(): void {
    const next = typeof scrollbackDraft === "number" ? clampTerminalScrollback(scrollbackDraft) : settings.terminalScrollback;
    scrollbackDraft = next;
    if (next !== settings.terminalScrollback) {
      set("terminalScrollback", next);
    }
  }

  // Reset to Defaults and Try Again change the settings under the fields.
  $effect(() => {
    terminalFontDraft = settings.terminalFontFamily;
  });
  $effect(() => {
    scrollbackDraft = settings.terminalScrollback;
  });

  // Automation: the MCP server and the command line tool.
  let showToken = $state(false);
  let portDraft = $state(String(settings.mcpPort));
  let portError = $state<string | null>(null);
  $effect(() => {
    if (section === "automation") {
      void mcpStore.refreshStatus();
    }
  });
  $effect(() => {
    portDraft = String(settings.mcpPort);
  });
  const mcpStatus = $derived(mcpStore.status);
  const mcpToken = $derived(mcpStatus?.token ?? null);
  const mcpUrl = $derived(mcpStatus?.url || `http://127.0.0.1:${settings.mcpPort}/mcp`);
  const serverWanted = $derived(settings.mcpEnabled || settings.cliEnabled);
  const mcpStatusLine = $derived.by(() => {
    if (mcpStore.statusError) {
      return `Not available in this build: ${mcpStore.statusError}`;
    }
    if (!mcpStatus) {
      return serverWanted ? "Starting..." : "Off";
    }
    if (mcpStatus.error) {
      return mcpStatus.error;
    }
    return mcpStatus.running ? `Running at ${mcpUrl}` : "Off";
  });
  const mcpStatusFailed = $derived(!!mcpStore.statusError || !!mcpStatus?.error);
  const cliCommandPrefix = $derived(mcpStatus ? cliPrefix(mcpStatus) : "git-manager cli");

  function applyPort(): void {
    const port = parseMcpPort(portDraft);
    if (port === null) {
      portError = `Use a whole number from ${MCP_PORT_RANGE[0]} to ${MCP_PORT_RANGE[1]}.`;
      return;
    }
    portError = null;
    portDraft = String(port);
    if (port !== settings.mcpPort) {
      set("mcpPort", port);
    }
  }

  function showMcpTools(): void {
    close();
    mcpStore.openToolsDialog();
  }

  /** Margin column being typed; applied on Enter or when the field loses focus. */
  let rulerDraft = $state<number | null>(settings.editorRulerColumn || DEFAULT_RULER_COLUMN);
  $effect(() => {
    if (settings.editorRulerColumn > 0) {
      rulerDraft = settings.editorRulerColumn;
    }
  });

  function applyRuler(): void {
    const column = typeof rulerDraft === "number" ? pickRulerColumn(rulerDraft) : 0;
    const next = column > 0 ? column : settings.editorRulerColumn || DEFAULT_RULER_COLUMN;
    rulerDraft = next;
    if (next !== settings.editorRulerColumn) {
      set("editorRulerColumn", next);
    }
  }

  async function clearMessageHistory(): Promise<void> {
    const confirmed = await dialogs.confirm({
      title: "Clear Saved Messages",
      message: "Forget the saved commit messages of every repository? Messages of your commits stay in the history.",
      confirmLabel: "Clear",
      danger: true,
    });
    if (confirmed) {
      settings.clearCommitMessages();
    }
  }

  // Tabs and saving (Settings > Editor).
  const tabLimitChoices: { value: "none" | "single" | "number"; label: string }[] = [
    { value: "none", label: "No limit" },
    { value: "single", label: "Single tab" },
    { value: "number", label: "Limit" },
  ];
  const tabLimitChoice = $derived(
    settings.tabLimit === NO_TAB_LIMIT ? "none" : settings.tabLimit === SINGLE_TAB ? "single" : "number",
  );
  const tabLimitHint = $derived(
    tabLimitChoice === "none"
      ? "Open as many file tabs as you like."
      : tabLimitChoice === "single"
        ? "Opening a file replaces the one on screen, for working on one file at a time."
        : "Past the limit, opening a file closes the file tab you used least recently.",
  );
  /** Number of tabs being typed; applied on Enter or when the field loses focus. */
  let tabLimitDraft = $state<number | null>(settings.tabLimit > SINGLE_TAB ? settings.tabLimit : DEFAULT_TAB_LIMIT_NUMBER);
  $effect(() => {
    if (settings.tabLimit > SINGLE_TAB) {
      tabLimitDraft = settings.tabLimit;
    }
  });

  function chooseTabLimit(choice: "none" | "single" | "number"): void {
    const draft = typeof tabLimitDraft === "number" ? pickTabLimit(tabLimitDraft) : DEFAULT_TAB_LIMIT_NUMBER;
    set("tabLimit", choice === "none" ? NO_TAB_LIMIT : choice === "single" ? SINGLE_TAB : draft > SINGLE_TAB ? draft : DEFAULT_TAB_LIMIT_NUMBER);
  }

  function applyTabLimit(): void {
    const limit = typeof tabLimitDraft === "number" ? pickTabLimit(Math.max(TAB_LIMIT_RANGE[0], tabLimitDraft)) : settings.tabLimit;
    tabLimitDraft = limit;
    if (limit !== settings.tabLimit) {
      set("tabLimit", limit);
    }
  }

  const autoSaveChoices: { value: AutoSaveMode; label: string; hint: string }[] = [
    { value: "off", label: "Off", hint: "Files are saved only when you save them." },
    { value: "afterDelay", label: "After a delay", hint: "Save a short pause after the last edit." },
    { value: "onFocusChange", label: "On focus change", hint: "Save when you leave the editor: another tab, another panel or another app." },
  ];

  let autoSaveDelayDraft = $state<number | null>(settings.autoSaveDelayMs);
  $effect(() => {
    autoSaveDelayDraft = settings.autoSaveDelayMs;
  });

  function applyAutoSaveDelay(): void {
    const [min, max] = AUTO_SAVE_DELAY_RANGE;
    const delay =
      typeof autoSaveDelayDraft === "number" && Number.isFinite(autoSaveDelayDraft)
        ? Math.min(max, Math.max(min, Math.round(autoSaveDelayDraft)))
        : settings.autoSaveDelayMs;
    autoSaveDelayDraft = delay;
    if (delay !== settings.autoSaveDelayMs) {
      set("autoSaveDelayMs", delay);
    }
  }

  let autoFetchDraft = $state<number | null>(settings.autoFetchIntervalMinutes);
  $effect(() => {
    autoFetchDraft = settings.autoFetchIntervalMinutes;
  });

  function applyAutoFetchInterval(): void {
    const [min, max] = AUTO_FETCH_INTERVAL_RANGE;
    const minutes =
      typeof autoFetchDraft === "number" && Number.isFinite(autoFetchDraft)
        ? Math.min(max, Math.max(min, Math.round(autoFetchDraft)))
        : settings.autoFetchIntervalMinutes;
    autoFetchDraft = minutes;
    if (minutes !== settings.autoFetchIntervalMinutes) {
      set("autoFetchIntervalMinutes", minutes);
    }
  }

  function set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    settings.setPreference(key, value);
  }

  // Editor > Local History: how much is kept, read each time the section shows.
  let historyUsage = $state.raw<LocalHistoryUsage | null>(null);
  $effect(() => {
    void localHistory.version;
    if (section !== "editor") {
      return;
    }
    api
      .localHistoryUsage()
      .then((usage) => {
        historyUsage = usage;
      })
      .catch(() => {
        historyUsage = null;
      });
  });

  async function clearLocalHistory(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "Clear Local History?",
      message: "Every kept version of every file is removed. This cannot be undone.",
      confirmLabel: "Clear",
      danger: true,
    });
    if (ok) {
      await localHistory.clear();
    }
  }

  async function revealMemoryLog(): Promise<void> {
    const logPath = memoryLog.status?.path;
    if (!logPath) {
      return;
    }
    try {
      await revealItemInDir(logPath);
    } catch (error) {
      toast.info("The log file is not there yet", errorMessage(error));
    }
  }

  function close(): void {
    settings.dialogOpen = false;
  }

  /** Records (the MCP tool switches) show as JSON. */
  function preferenceText(value: unknown): string {
    return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
  }

  function showGitConsole(): void {
    close();
    terminalStore.showTab("gitConsole");
  }

  async function reset(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "Reset Settings",
      message: "Restore every setting to its default value?",
      confirmLabel: "Reset",
      danger: true,
    });
    if (ok) {
      settings.resetPreferences();
      toast.success("Settings reset to defaults");
    }
  }

  async function resetState(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "Reset state.json",
      message: "Replace state.json with a fresh file? The recent folders, last session and panel sizes saved in it are lost.",
      confirmLabel: "Reset",
      danger: true,
    });
    if (ok) {
      settings.resetState();
      toast.success("state.json was reset");
    }
  }

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  function clearSearch(): void {
    searchQuery = "";
    searchInput?.focus();
  }

  function onKeydown(event: KeyboardEvent): void {
    // Escape empties the search first, then closes the dialog.
    if (event.key === "Escape" && !dialogs.active && !event.defaultPrevented && event.target === searchInput && searchQuery !== "") {
      event.preventDefault();
      clearSearch();
      return;
    }
    if (event.key === "Escape" && !dialogs.active && !event.defaultPrevented) {
      event.preventDefault();
      close();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="overlay" role="presentation" onmousedown={(event) => event.target === event.currentTarget && close()}>
  <div
    class="dialog"
    class:dragging
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    bind:this={dialogEl}
    style="transform: translate({offset.x}px, {offset.y}px)"
  >
    <nav class="nav" aria-label="Settings sections">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <h2
        id="settings-title"
        class="drag-handle"
        title="Drag to move, double-click to center"
        onpointerdown={startDrag}
        onpointermove={drag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        ondblclick={recenter}
      >
        Settings
      </h2>
      <div class="search">
        <span class="magnifier"><Icon name="search" size={13} /></span>
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder="Search settings"
          aria-label="Search settings"
          spellcheck="false"
          autocomplete="off"
        />
        {#if searchQuery !== ""}
          <button class="clear" onclick={clearSearch} aria-label="Clear search" title="Clear">
            <Icon name="x" size={12} />
          </button>
        {/if}
      </div>
      {#each visibleSections as item (item.id)}
        <button class="nav-item" class:active={section === item.id} onclick={() => (section = item.id)}>
          {item.label}
        </button>
      {:else}
        <div class="nav-empty">Nothing found</div>
      {/each}
      <div class="nav-spacer"></div>
      <button class="nav-item reset" onclick={reset}>Reset to Defaults</button>
    </nav>

    <div class="content">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="content-head drag-handle"
        title="Drag to move, double-click to center"
        onpointerdown={startDrag}
        onpointermove={drag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        ondblclick={recenter}
      >
        <h3>{sections.find((item) => item.id === section)?.label}</h3>
        <button class="icon-btn" onclick={close} aria-label="Close settings"><Icon name="x" size={15} /></button>
      </div>

      {#if settings.loadError}
        <div class="error-banner">
          <Icon name="alert" size={15} />
          <div>
            <strong>settings.json could not be read</strong>, so defaults are in use and it will not be overwritten.
            <div class="dim selectable">{settings.loadError}</div>
          </div>
          <button class="btn small" onclick={() => void settings.reload()}>Try Again</button>
        </div>
      {/if}
      {#if settings.stateLoadError}
        <div class="error-banner">
          <Icon name="alert" size={15} />
          <div>
            <strong>state.json could not be read</strong>, so recent folders and panel sizes start empty and it will not be
            overwritten.
            <div class="dim selectable">{settings.stateLoadError}</div>
          </div>
          <div class="banner-actions">
            <button class="btn small" onclick={() => void settings.reloadState()}>Try Again</button>
            <button class="btn small danger" onclick={() => void resetState()}>Reset</button>
          </div>
        </div>
      {/if}

      {#if sectionUnmatched}
        <p class="search-empty">No settings match "{searchQuery.trim()}".</p>
      {/if}
      <div class="rows" class:searching class:unmatched={sectionUnmatched} bind:this={rowsEl}>
        {#if section === "appearance"}
          <div class="row">
            <div class="label">
              <span>Theme</span>
              <span class="hint">
                System follows the macOS appearance. Color themes are in
                <button class="inline-link" onclick={() => (section = "editor")}>Editor</button>.
              </span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Theme">
              {#each themes as theme (theme.value)}
                <button
                  role="radio"
                  aria-checked={settings.theme === theme.value}
                  class:on={settings.theme === theme.value}
                  onclick={() => set("theme", theme.value)}
                >
                  {theme.label}
                </button>
              {/each}
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Rounded panels</span>
              <span class="hint">
                Show the sidebars, editors and the bottom panel as rounded panels with space between them. Works with every
                color theme.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.roundedPanels}
              onchange={(event) => set("roundedPanels", event.currentTarget.checked)}
            />
          </label>
          <div class="row">
            <div class="label">
              <span>File toolbar</span>
              <span class="hint">
                The bar with a file's path, badges and buttons: above the code, under it, or hidden. Pick its parts
                below. Without the path, Cmd+Up shows the Navigation Bar over the editor.
              </span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="File toolbar">
              {#each FILE_TOOLBAR_CHOICES as choice (choice.value)}
                <button
                  role="radio"
                  aria-checked={settings.fileToolbar === choice.value}
                  class:on={settings.fileToolbar === choice.value}
                  onclick={() => set("fileToolbar", choice.value)}
                >
                  {choice.label}
                </button>
              {/each}
            </div>
          </div>
          <!-- One switch per part; with the toolbar hidden only the Markdown formatting row (its own row) still applies. -->
          {#each FILE_TOOLBAR_SWITCHES as part (part.key)}
            {#if settings.fileToolbar !== "none" || part.key === "fileToolbarMarkdownFormat"}
              <label class="row toggle-row sub-row">
                <div class="label">
                  <span>{part.label}</span>
                  <span class="hint">{part.hint}</span>
                </div>
                <input
                  type="checkbox"
                  class="switch"
                  checked={settings[part.key]}
                  onchange={(event) => set(part.key, event.currentTarget.checked)}
                />
              </label>
            {/if}
          {/each}
          <div class="row">
            <div class="label">
              <span>Interface font size</span>
              <span class="hint">Menus, lists and buttons.</span>
            </div>
            <div class="range">
              <input
                type="range"
                min={FONT_SIZE_RANGE.ui[0]}
                max={FONT_SIZE_RANGE.ui[1]}
                step="0.5"
                value={settings.uiFontSize}
                oninput={(event) => set("uiFontSize", Number(event.currentTarget.value))}
                aria-label="Interface font size"
              />
              <span class="value">{settings.uiFontSize}px</span>
            </div>
          </div>
          <div class="row">
            <div class="label">
              <span>File icons<MemoryFlag setting="fileIcons" /></span>
              <span class="hint">
                Icons by file type in the Files panel, the Changes list and commit file lists. Also in View > File Icons.
                Minimal and Material Icons use more memory, Material Icons the most. An icon set loads only while it is chosen.
              </span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="File icons">
              {#each FILE_ICON_CHOICES as choice (choice.value)}
                <button
                  role="radio"
                  aria-checked={settings.fileIcons === choice.value}
                  class:on={settings.fileIcons === choice.value}
                  title={choice.hint}
                  onclick={() => set("fileIcons", choice.value)}
                >
                  {choice.label}
                </button>
              {/each}
            </div>
          </div>
        {:else if section === "editor"}
          <div class="row stacked">
            <div class="label">
              <span>Color theme</span>
              <span class="hint">
                One for light and one for dark mode. Light, Dark or System is set in
                <button class="inline-link" onclick={() => (section = "appearance")}>Appearance</button>.
              </span>
            </div>
            <div class="theme-pickers">
              <ColorThemePicker
                mode="light"
                selectedId={settings.lightColorTheme}
                active={settings.colorMode === "light"}
                onSelect={(themeId) => settings.setColorTheme("light", themeId)}
              />
              <ColorThemePicker
                mode="dark"
                selectedId={settings.darkColorTheme}
                active={settings.colorMode === "dark"}
                onSelect={(themeId) => settings.setColorTheme("dark", themeId)}
              />
            </div>
          </div>
          <div class="row stacked">
            <div class="label">
              <span>Editor font family</span>
              <span class="hint">
                A comma-separated list. The first installed font is used; <code>monospace</code> is always added as the last
                fallback.
              </span>
            </div>
            <div class="font-row">
              <input
                class="input font-input"
                list="monospace-fonts"
                spellcheck="false"
                autocomplete="off"
                bind:value={fontDraft}
                onchange={applyFont}
                onkeydown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyFont();
                  }
                }}
                aria-label="Editor font family"
              />
              <datalist id="monospace-fonts">
                {#each MONOSPACE_FONTS as family (family)}
                  <option value={family}></option>
                {/each}
              </datalist>
              {#if settings.editorFontFamily !== DEFAULT_EDITOR_FONT}
                <button
                  class="btn small"
                  onclick={() => {
                    fontDraft = DEFAULT_EDITOR_FONT;
                    applyFont();
                  }}
                >
                  Reset
                </button>
              {/if}
            </div>
            <div class="font-picks">
              {#each MONOSPACE_FONTS as family (family)}
                <button class="font-pick" style="font-family: '{family}', monospace" onclick={() => addFont(family)} title="Use {family}">
                  {family}
                </button>
              {/each}
            </div>
            <pre class="font-preview code-ligatures" style="font-family: {normalizeFontFamily(fontDraft)}; font-size: {settings.editorFontSize}px; font-weight: {settings.editorFontWeight}; line-height: {settings.editorLineHeight}">function greet(name: string) &#123;
  return `Hello, $&#123;name&#125;!`; // 0O 1lI =&gt; != ===
&#125;</pre>
          </div>
          <div class="row">
            <div class="label">
              <span>Editor font size</span>
              <span class="hint">Code in the editor, diffs and the merge tool.</span>
            </div>
            <div class="range">
              <input
                type="range"
                min={FONT_SIZE_RANGE.editor[0]}
                max={FONT_SIZE_RANGE.editor[1]}
                step="0.5"
                value={settings.editorFontSize}
                oninput={(event) => set("editorFontSize", Number(event.currentTarget.value))}
                aria-label="Editor font size"
              />
              <span class="value">{settings.editorFontSize}px</span>
            </div>
          </div>
          <div class="row">
            <div class="label">
              <span>Editor font weight</span>
              <span class="hint">
                How thick code is drawn. Light (300) looks calm on dark themes. Needs a font with several weights, such as
                JetBrains Mono or SF Mono; other fonts use their closest weight.
              </span>
            </div>
            <div class="range">
              <input
                type="range"
                min={EDITOR_FONT_WEIGHT_RANGE[0]}
                max={EDITOR_FONT_WEIGHT_RANGE[1]}
                step="100"
                value={settings.editorFontWeight}
                oninput={(event) => set("editorFontWeight", Number(event.currentTarget.value))}
                ondblclick={() => set("editorFontWeight", defaultPreferences.editorFontWeight)}
                title="Double-click to reset to {fontWeightName(defaultPreferences.editorFontWeight)}"
                aria-label="Editor font weight"
              />
              <span class="value weight-value">{fontWeightName(settings.editorFontWeight)}</span>
            </div>
          </div>
          <div class="row">
            <div class="label">
              <span>Line spacing</span>
              <span class="hint">Space between lines of code, as a multiple of the font size. The default is {defaultPreferences.editorLineHeight}.</span>
            </div>
            <div class="range">
              <input
                type="range"
                min={EDITOR_LINE_HEIGHT_RANGE[0]}
                max={EDITOR_LINE_HEIGHT_RANGE[1]}
                step="0.05"
                value={settings.editorLineHeight}
                oninput={(event) => set("editorLineHeight", Math.round(Number(event.currentTarget.value) * 100) / 100)}
                ondblclick={() => set("editorLineHeight", defaultPreferences.editorLineHeight)}
                title="Double-click to reset to {defaultPreferences.editorLineHeight}"
                aria-label="Line spacing"
              />
              <span class="value">{settings.editorLineHeight.toFixed(2)}</span>
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Change font size with Ctrl + mouse wheel</span>
              <span class="hint">
                Hold Control (or Command) and scroll over an editor, diff or merge pane to make the code bigger or smaller.
                A trackpad pinch works too.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.mouseWheelZoom}
              onchange={(event) => set("mouseWheelZoom", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Font ligatures</span>
              <span class="hint">
                Draw <code>=&gt;</code>, <code>!=</code>, <code>===</code> and similar as single glyphs. Needs a font with
                ligatures such as Fira Code, JetBrains Mono or Cascadia Code; Menlo has none.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.fontLigatures}
              onchange={(event) => set("fontLigatures", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Syntax highlighting<MemoryFlag setting="syntaxHighlighting" /></span>
              <span class="hint">
                Color code by its language in editors, diffs, the merge tool and Markdown code blocks. Off, code is plain text
                and no language grammar is loaded, which saves memory with big files. Fold arrows and bracket pair colors need
                it; sticky scroll then follows the indentation.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.syntaxHighlighting}
              onchange={(event) => set("syntaxHighlighting", event.currentTarget.checked)}
            />
          </label>
          <div class="row">
            <div class="label">
              <span>Tab size</span>
              <span class="hint">Spaces per indent level, and the width of a tab, for files whose indentation is not detected.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Tab size">
              {#each TAB_SIZES as size (size)}
                <button role="radio" aria-checked={settings.tabSize === size} class:on={settings.tabSize === size} onclick={() => set("tabSize", size)}>
                  {size}
                </button>
              {/each}
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Detect indentation</span>
              <span class="hint">Indent like the file already does: tabs or spaces, and how many. Also in View > Detect Indentation.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.detectIndentation}
              onchange={(event) => set("detectIndentation", event.currentTarget.checked)}
            />
          </label>
          <div class="row">
            <div class="label">
              <span>Render whitespace<MemoryFlag setting="renderWhitespace" /></span>
              <span class="hint">
                {RENDER_WHITESPACE_CHOICES.find((choice) => choice.value === settings.renderWhitespace)?.hint ?? ""}
                Spaces show as dots and tabs as arrows, in editors, diffs and the merge tool.
              </span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Render whitespace">
              {#each RENDER_WHITESPACE_CHOICES as choice (choice.value)}
                <button
                  role="radio"
                  aria-checked={settings.renderWhitespace === choice.value}
                  class:on={settings.renderWhitespace === choice.value}
                  onclick={() => set("renderWhitespace", choice.value)}
                >
                  {choice.label}
                </button>
              {/each}
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Word wrap</span>
              <span class="hint">Wrap long lines in the file editor. Diffs and the merge tool never wrap so their panes stay aligned.</span>
            </div>
            <input type="checkbox" class="switch" checked={settings.wordWrap} onchange={(event) => set("wordWrap", event.currentTarget.checked)} />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Cursor style</span>
              <span class="hint">The shape of the cursor in editors, diffs and the merge tool.</span>
            </div>
            <select
              class="input select"
              value={settings.editorCursorStyle}
              onchange={(event) => set("editorCursorStyle", event.currentTarget.value as EditorCursorStyle)}
              aria-label="Cursor style"
            >
              {#each EDITOR_CURSOR_STYLE_CHOICES as choice (choice.value)}
                <option value={choice.value}>{choice.label}</option>
              {/each}
            </select>
          </label>
          {#if settings.editorCursorStyle === "line"}
            <div class="row">
              <div class="label">
                <span>Cursor width</span>
                <span class="hint">How thick the Line cursor is, in pixels. The default is 2.</span>
              </div>
              <div class="range">
                <input
                  type="range"
                  min={EDITOR_CURSOR_WIDTH_RANGE[0]}
                  max={EDITOR_CURSOR_WIDTH_RANGE[1]}
                  step="1"
                  value={settings.editorCursorWidth}
                  oninput={(event) => set("editorCursorWidth", Number(event.currentTarget.value))}
                  ondblclick={() => set("editorCursorWidth", defaultPreferences.editorCursorWidth)}
                  title="Double-click to reset to 2"
                  aria-label="Cursor width"
                />
                <span class="value">{settings.editorCursorWidth} px</span>
              </div>
            </div>
          {/if}
          <label class="row toggle-row">
            <div class="label">
              <span>Cursor blinking</span>
              <span class="hint">
                {EDITOR_CURSOR_BLINKING_CHOICES.find((choice) => choice.value === settings.editorCursorBlinking)?.hint ?? ""}
                The cursor stays visible while you type.
              </span>
            </div>
            <select
              class="input select"
              value={settings.editorCursorBlinking}
              onchange={(event) => set("editorCursorBlinking", event.currentTarget.value as EditorCursorBlinking)}
              aria-label="Cursor blinking"
            >
              {#each EDITOR_CURSOR_BLINKING_CHOICES as choice (choice.value)}
                <option value={choice.value}>{choice.label}</option>
              {/each}
            </select>
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Smooth caret animation</span>
              <span class="hint">The cursor glides to its new place instead of jumping.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.editorCursorSmoothCaret}
              onchange={(event) => set("editorCursorSmoothCaret", event.currentTarget.checked)}
            />
          </label>
          {#each CARET_EXTRA_ROWS as extra (extra.key)}
            <div class="row">
              <div class="label">
                <span>{extra.label}</span>
                <span class="hint">{extra.hint}</span>
              </div>
              <div class="range">
                <input
                  type="range"
                  min={CARET_EXTRA_RANGE[0]}
                  max={CARET_EXTRA_RANGE[1]}
                  step="1"
                  value={settings[extra.key]}
                  oninput={(event) => set(extra.key, Number(event.currentTarget.value))}
                  ondblclick={() => set(extra.key, 0)}
                  title="Double-click to reset to 0"
                  aria-label={extra.label}
                />
                <span class="value">{settings[extra.key]} px</span>
              </div>
            </div>
          {/each}
          <h4 class="group-title">Editing features</h4>
          <p class="group-hint">Turning a feature off removes it from open editors and frees its memory.</p>
          {#each EDITOR_FEATURE_ROWS as row (row.key)}
            <label class="row toggle-row">
              <div class="label">
                <span>{row.label}</span>
                <span class="hint">{row.hint}</span>
              </div>
              <input type="checkbox" class="switch" checked={settings[row.key]} onchange={(event) => set(row.key, event.currentTarget.checked)} />
            </label>
            {#if row.key === "editorCompletion" && settings.editorCompletion}
              <label class="row toggle-row sub-row">
                <div class="label">
                  <span>Show completion while typing</span>
                  <span class="hint">Off, only Ctrl+Space opens the list. Markdown and plain text always wait for Ctrl+Space.</span>
                </div>
                <input
                  type="checkbox"
                  class="switch"
                  checked={settings.editorCompletionOnTyping}
                  onchange={(event) => set("editorCompletionOnTyping", event.currentTarget.checked)}
                />
              </label>
            {/if}
          {/each}
          <label class="row toggle-row">
            <div class="label">
              <span>Right margin line</span>
              <span class="hint">A thin line at a column in editors, diffs and the merge tool.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.editorRulerColumn > 0}
              onchange={(event) => set("editorRulerColumn", event.currentTarget.checked ? pickRulerColumn(rulerDraft) || DEFAULT_RULER_COLUMN : 0)}
            />
          </label>
          {#if settings.editorRulerColumn > 0}
            <div class="row sub-row">
              <div class="label">
                <span>Margin column</span>
                <span class="hint">From {EDITOR_RULER_RANGE[0]} to {EDITOR_RULER_RANGE[1]}.</span>
              </div>
              <input
                class="input number-input"
                type="number"
                inputmode="numeric"
                min={EDITOR_RULER_RANGE[0]}
                max={EDITOR_RULER_RANGE[1]}
                step="1"
                bind:value={rulerDraft}
                onchange={applyRuler}
                onkeydown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyRuler();
                  }
                }}
                aria-label="Margin column"
              />
            </div>
          {/if}
          <h4 class="group-title">Tabs</h4>
          <label class="row toggle-row">
            <div class="label">
              <span>Reopen tabs on start</span>
              <span class="hint">
                Open the files a folder or workspace had in tabs last time, also when you open it again later. Each file loads
                when you first show its tab.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.reopenTabsOnStart}
              onchange={(event) => set("reopenTabsOnStart", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Recent Files<MemoryFlag setting="recentFiles" /></span>
              <span class="hint">
                Cmd+E lists the files you worked on last, and Quick Open and Search Everywhere show them first.
                Each workspace keeps up to 50 in state.json. Off, Cmd+E only says it is off.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.recentFiles}
              onchange={(event) => set("recentFiles", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Split editor</span>
              <span class="hint">
                Show two groups of tabs side by side with Window > Split Right. Turning it off moves every tab into one group.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.splitEditor}
              onchange={(event) => set("splitEditor", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Wrap tabs</span>
              <span class="hint">Show tabs that do not fit on more rows instead of scrolling them sideways.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.wrapTabs}
              onchange={(event) => set("wrapTabs", event.currentTarget.checked)}
            />
          </label>
          <div class="row">
            <div class="label">
              <span>Tab limit<MemoryFlag setting="tabLimit" /></span>
              <span class="hint">{tabLimitHint} Tabs with unsaved changes and pinned tabs always stay open.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Tab limit">
              {#each tabLimitChoices as choice (choice.value)}
                <button
                  role="radio"
                  aria-checked={tabLimitChoice === choice.value}
                  class:on={tabLimitChoice === choice.value}
                  onclick={() => chooseTabLimit(choice.value)}
                >
                  {choice.label}
                </button>
              {/each}
            </div>
          </div>
          {#if tabLimitChoice === "number"}
            <div class="row sub-row">
              <div class="label">
                <span>Most file tabs</span>
                <span class="hint">From {TAB_LIMIT_RANGE[0]} to {TAB_LIMIT_RANGE[1]}. Commit, history and terminal tabs do not count.</span>
              </div>
              <input
                class="input number-input"
                type="number"
                inputmode="numeric"
                min={TAB_LIMIT_RANGE[0]}
                max={TAB_LIMIT_RANGE[1]}
                step="1"
                bind:value={tabLimitDraft}
                onchange={applyTabLimit}
                onkeydown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyTabLimit();
                  }
                }}
                aria-label="Most file tabs"
              />
            </div>
          {/if}
          {#if tabLimitChoice === "single"}
            <label class="row toggle-row sub-row">
              <div class="label">
                <span>Single tab title</span>
                <span class="hint">With only one tab open, show its name in the middle of the strip instead of a tab.</span>
              </div>
              <input
                type="checkbox"
                class="switch"
                checked={settings.singleTabTitle}
                onchange={(event) => set("singleTabTitle", event.currentTarget.checked)}
              />
            </label>
          {/if}
          <label class="row toggle-row">
            <div class="label">
              <span>Unload hidden tabs</span>
              <span class="hint">
                A file tab you have not looked at for a while gives its editor back, about 4 MB each. The tab stays, and
                opening it again goes back to the same place, but its undo history starts over. Tabs with unsaved changes
                are never unloaded.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.unloadHiddenTabs}
              onchange={(event) => set("unloadHiddenTabs", event.currentTarget.checked)}
            />
          </label>
          {#if settings.unloadHiddenTabs}
            <div class="row sub-row">
              <div class="label">
                <span>Unload after</span>
                <span class="hint">How long a tab stays out of sight before it is unloaded.</span>
              </div>
              <div class="segmented" role="radiogroup" aria-label="Unload after">
                {#each UNLOAD_TAB_MINUTES as minutes (minutes)}
                  <button
                    role="radio"
                    aria-checked={settings.unloadHiddenTabsMinutes === minutes}
                    class:on={settings.unloadHiddenTabsMinutes === minutes}
                    onclick={() => set("unloadHiddenTabsMinutes", minutes)}
                  >
                    {minutes} min
                  </button>
                {/each}
              </div>
            </div>
          {/if}
          <h4 class="group-title">Saving</h4>
          <div class="row">
            <div class="label">
              <span>Auto save</span>
              <span class="hint">
                {autoSaveChoices.find((choice) => choice.value === settings.autoSave)?.hint ?? ""}
                {settings.autoSave === "off" ? "" : "Conflicted files are only saved by hand."}
              </span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Auto save">
              {#each autoSaveChoices as choice (choice.value)}
                <button
                  role="radio"
                  aria-checked={settings.autoSave === choice.value}
                  class:on={settings.autoSave === choice.value}
                  onclick={() => set("autoSave", choice.value)}
                >
                  {choice.label}
                </button>
              {/each}
            </div>
          </div>
          {#if settings.autoSave === "afterDelay"}
            <div class="row sub-row">
              <div class="label">
                <span>Delay</span>
                <span class="hint">
                  Milliseconds after the last edit, from {AUTO_SAVE_DELAY_RANGE[0]} to {AUTO_SAVE_DELAY_RANGE[1]}. The default is
                  {defaultPreferences.autoSaveDelayMs}.
                </span>
              </div>
              <input
                class="input number-input"
                type="number"
                inputmode="numeric"
                min={AUTO_SAVE_DELAY_RANGE[0]}
                max={AUTO_SAVE_DELAY_RANGE[1]}
                step="100"
                bind:value={autoSaveDelayDraft}
                onchange={applyAutoSaveDelay}
                onkeydown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyAutoSaveDelay();
                  }
                }}
                aria-label="Auto save delay in milliseconds"
              />
            </div>
          {/if}
          {#each SAVE_CLEANUP_ROWS as row (row.key)}
            <label class="row toggle-row">
              <div class="label">
                <span>{row.label}</span>
                <span class="hint">{row.hint}</span>
              </div>
              <input type="checkbox" class="switch" checked={settings[row.key]} onchange={(event) => set(row.key, event.currentTarget.checked)} />
            </label>
          {/each}
          <h4 class="group-title">Local History</h4>
          <label class="row toggle-row">
            <div class="label">
              <span>Keep local history</span>
              <span class="hint">
                Keeps a version of a file on every save, when it changes outside the app and before Discard, Rollback
                or Revert. Files over 1 MB are skipped. Open it from a tab's menu or File, Show Local History.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.localHistoryEnabled}
              onchange={(event) => set("localHistoryEnabled", event.currentTarget.checked)}
            />
          </label>
          <div class="row sub-row">
            <div class="label">
              <span>Keep versions for</span>
              <span class="hint">Each file keeps its newest 50 versions.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Keep versions for">
              {#each [1, 3, 7, 14, 30] as days (days)}
                <button
                  role="radio"
                  aria-checked={settings.localHistoryDays === days}
                  class:on={settings.localHistoryDays === days}
                  onclick={() => set("localHistoryDays", days)}
                >
                  {days === 1 ? "1 day" : `${days} days`}
                </button>
              {/each}
            </div>
          </div>
          <div class="row sub-row">
            <div class="label">
              <span>Size limit</span>
              <span class="hint">The oldest versions go first when all of them need more space.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Local history size limit">
              {#each [50, 200, 500, 1000] as sizeMb (sizeMb)}
                <button
                  role="radio"
                  aria-checked={settings.localHistorySizeMb === sizeMb}
                  class:on={settings.localHistorySizeMb === sizeMb}
                  onclick={() => set("localHistorySizeMb", sizeMb)}
                >
                  {sizeMb >= 1000 ? `${sizeMb / 1000} GB` : `${sizeMb} MB`}
                </button>
              {/each}
            </div>
          </div>
          <div class="row sub-row">
            <div class="label">
              <span>Stored</span>
              <span class="hint">{usageText(historyUsage) || "In ~/.gitmanager/local-history."}</span>
            </div>
            <button class="btn small danger" disabled={historyUsage?.snapshots === 0} onclick={() => void clearLocalHistory()}>
              Clear Local History
            </button>
          </div>
          <h4 class="group-title">Preview and blame</h4>
          <div class="row">
            <div class="label">
              <span>Markdown preview<MemoryFlag setting="markdownViewMode" /></span>
              <span class="hint">How Markdown files open. Each file can switch with the buttons at the top right of its editor and keeps its choice until the app restarts.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Markdown preview">
              {#each markdownModes as mode (mode.value)}
                <button
                  role="radio"
                  aria-checked={settings.markdownViewMode === mode.value}
                  class:on={settings.markdownViewMode === mode.value}
                  onclick={() => set("markdownViewMode", mode.value)}
                >
                  {mode.label}
                </button>
              {/each}
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Current line blame</span>
              <span class="hint">Show the author, age and commit of the cursor line at its end. Cmd+click it (Ctrl+click elsewhere) to show the commit in the Log; add Option to copy the commit hash.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.currentLineBlame}
              onchange={(event) => set("currentLineBlame", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Blame gutter<MemoryFlag setting="blameGutter" /></span>
              <span class="hint">A column with the commit, author and age of every block of lines. Also toggled with the Blame button in the path bar and the diff toolbar.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.blameGutter}
              onchange={(event) => set("blameGutter", event.currentTarget.checked)}
            />
          </label>
        {:else if section === "merge"}
          <label class="row toggle-row">
            <div class="label">
              <span>Ignore whitespace in the merge tool</span>
              <span class="hint">Start merges with whitespace-only differences hidden. The Ignore whitespace button in the merge tool changes this setting too.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.ignoreWhitespace}
              onchange={(event) => set("ignoreWhitespace", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Show all branches in the log</span>
              <span class="hint">Include every local and remote branch, like <code>git log --branches --remotes</code>. Tags and stashes are not followed.</span>
            </div>
            <input type="checkbox" class="switch" checked={settings.logAllRefs} onchange={(event) => set("logAllRefs", event.currentTarget.checked)} />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Auto fetch</span>
              <span class="hint">
                Fetch every remote in the background while the window is in use, one repository at a time. It never asks for a
                password; a failed fetch waits longer and shows a note in the status bar.
              </span>
            </div>
            <input type="checkbox" class="switch" checked={settings.autoFetch} onchange={(event) => set("autoFetch", event.currentTarget.checked)} />
          </label>
          {#if settings.autoFetch}
            <div class="row sub-row">
              <div class="label">
                <span>Fetch every</span>
                <span class="hint">
                  Minutes, from {AUTO_FETCH_INTERVAL_RANGE[0]} to {AUTO_FETCH_INTERVAL_RANGE[1]}. The default is
                  {defaultPreferences.autoFetchIntervalMinutes}.
                </span>
              </div>
              <input
                class="input number-input"
                type="number"
                inputmode="numeric"
                min={AUTO_FETCH_INTERVAL_RANGE[0]}
                max={AUTO_FETCH_INTERVAL_RANGE[1]}
                step="1"
                bind:value={autoFetchDraft}
                onchange={applyAutoFetchInterval}
                onkeydown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyAutoFetchInterval();
                  }
                }}
                aria-label="Auto fetch interval in minutes"
              />
            </div>
          {/if}
          <label class="row toggle-row">
            <div class="label">
              <span>Sign off commits</span>
              <span class="hint">Add a Signed-off-by trailer to every commit (<code>--signoff</code>). Also in Commit Options.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.commitSignOff}
              onchange={(event) => set("commitSignOff", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>GPG sign commits</span>
              <span class="hint">Default follows <code>commit.gpgSign</code>; Sign adds <code>-S</code>, Do not sign adds <code>--no-gpg-sign</code>.</span>
            </div>
            <select
              class="input select"
              value={settings.commitGpgSign}
              onchange={(event) => set("commitGpgSign", event.currentTarget.value as GpgSign)}
              aria-label="GPG sign commits"
            >
              {#each GPG_SIGN_CHOICES as choice (choice.value)}
                <option value={choice.value}>{choice.label}</option>
              {/each}
            </select>
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Git Console</span>
              <span class="hint">
                Keep a list of the git commands the app runs, with their output. It shows as the Git Console tab in the bottom
                panel, next to Terminal (View &gt; Git Console). Off, nothing is recorded or loaded.
              </span>
              {#if settings.gitConsole && repoStore.workspace}
                <button class="btn small show-console" onclick={showGitConsole}>Show Git Console</button>
              {/if}
            </div>
            <input type="checkbox" class="switch" checked={settings.gitConsole} onchange={(event) => set("gitConsole", event.currentTarget.checked)} />
          </label>
          <h4 class="group-title">Commit identity</h4>
          <div class="row stacked">
            <div class="label">
              <span>Name and email</span>
              <span class="hint">
                Written into every commit (<code>user.name</code> and <code>user.email</code>). A repository's own values win
                over the global ones; leave a field empty to remove it.
              </span>
            </div>
            <GitIdentitySettings />
          </div>
          <h4 class="group-title">Commit messages</h4>
          <label class="row toggle-row">
            <div class="label">
              <span>Message history</span>
              <span class="hint">
                The clock in the commit box (Cmd+E, or Up in an empty box) lists your recent commit messages and messages
                that were not committed. They are kept in state.json, up to 30 per repository.
              </span>
              {#if settings.commitMessageHistory && Object.keys(settings.commitMessages).length > 0}
                <button class="btn small show-console" onclick={() => void clearMessageHistory()}>Clear Saved Messages</button>
              {/if}
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.commitMessageHistory}
              onchange={(event) => set("commitMessageHistory", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Subject line guide</span>
              <span class="hint">A note under the commit box when the first line is longer than 72 characters.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.commitSubjectGuide}
              onchange={(event) => set("commitSubjectGuide", event.currentTarget.checked)}
            />
          </label>
          <div class="row stacked">
            <div class="label">
              <span>Templates</span>
              <span class="hint">
                Picked from the page icon in the commit box. A <code>commit.template</code> set in git config also fills an
                empty commit box.
              </span>
            </div>
            <CommitTemplateSettings />
          </div>
        {:else if section === "layout"}
          <label class="row toggle-row">
            <div class="label">
              <span>Do not disturb</span>
              <span class="hint">Only errors pop up. Every message is still kept in the bell at the bottom right.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.notificationsDoNotDisturb}
              onchange={(event) => set("notificationsDoNotDisturb", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Files panel</span>
              <span class="hint">Show the file tree on the right.</span>
            </div>
            <input type="checkbox" class="switch" checked={settings.explorerOpen} onchange={() => settings.toggleExplorer()} />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Confirm drag and drop</span>
              <span class="hint">Ask before dragging files or folders in the Files panel moves them.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.confirmDragAndDrop}
              onchange={(event) => set("confirmDragAndDrop", event.currentTarget.checked)}
            />
          </label>
          <div class="row">
            <div class="label">
              <span>Left sidebar</span>
              <span class="hint">Also toggled from the activity bar or with Cmd+B.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Left sidebar">
              {#each [{ value: "changes", label: "Changes" }, { value: "branches", label: "Branches" }, { value: null, label: "Hidden" }] as const as option (option.label)}
                <button
                  role="radio"
                  aria-checked={settings.leftPanel === option.value}
                  class:on={settings.leftPanel === option.value}
                  onclick={() => settings.setLeftPanel(option.value)}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Reopen windows on start</span>
              <span class="hint">
                Open every window that was open when you quit, each with its folders. Off: only the last folders you had open.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.reopenWindows}
              onchange={(event) => set("reopenWindows", event.currentTarget.checked)}
            />
          </label>
        {:else if section === "terminal"}
          <h4 class="group-title">Shell</h4>
          <div class="row">
            <div class="label">
              <span>Default shell</span>
              <span class="hint">
                New terminals start this shell. The arrow next to + in the terminal panel starts any other one.
              </span>
            </div>
            <select
              class="input select"
              value={settings.terminalShell ?? ""}
              onchange={(event) => set("terminalShell", event.currentTarget.value || null)}
              aria-label="Default shell"
            >
              <option value="">{loginShell ? `Login shell (${loginShell.name})` : "Login shell"}</option>
              {#each terminalStore.shells as shell (shell.id)}
                <option value={shell.id}>{shell.name} ({shell.path})</option>
              {/each}
              {#if settings.terminalShell && savedShellMissing}
                <option value={settings.terminalShell}>
                  {settings.terminalShell}{shellsLoaded ? " (not found, the login shell is used)" : ""}
                </option>
              {/if}
            </select>
          </div>

          <h4 class="group-title">Font</h4>
          <div class="row stacked">
            <div class="label">
              <span>Font family</span>
              <span class="hint">
                A comma-separated list. Leave it empty to use the editor font.
              </span>
            </div>
            <div class="font-row">
              <input
                class="input font-input"
                list="terminal-fonts"
                spellcheck="false"
                autocomplete="off"
                placeholder="Same as the editor font"
                bind:value={terminalFontDraft}
                onchange={applyTerminalFont}
                onkeydown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyTerminalFont();
                  }
                }}
                aria-label="Terminal font family"
              />
              <datalist id="terminal-fonts">
                {#each TERMINAL_FONT_PICKS as family (family)}
                  <option value={family}></option>
                {/each}
              </datalist>
              {#if settings.terminalFontFamily}
                <button
                  class="btn small"
                  onclick={() => {
                    terminalFontDraft = "";
                    applyTerminalFont();
                  }}
                >
                  Use the Editor Font
                </button>
              {/if}
            </div>
            <div class="font-picks">
              {#each TERMINAL_FONT_PICKS as family (family)}
                <button
                  class="font-pick"
                  style="font-family: '{family}', monospace"
                  onclick={() => addTerminalFont(family)}
                  title="Use {family}"
                >
                  {family}
                </button>
              {/each}
            </div>
            <pre
              class="font-preview terminal-preview"
              class:liga-on={settings.terminalLigatures}
              style:font-family={terminalPreviewFont}
              style:font-size="{settings.terminalFontSize}px"
              style:font-weight={xtermFontWeight(settings.terminalFontWeight)}
              style:letter-spacing="{settings.terminalLetterSpacing / (window.devicePixelRatio || 1)}px"
              style:--term-line-height={settings.terminalLineHeight}><div><span class="dim">&#xf07b; ~/git-manager &#xe0b0; &#xe0a0; main</span> &#x276f; git log --oneline</div><div><span style:font-weight={xtermFontWeight(settings.terminalFontWeightBold)}>a1b2c3d</span> fix: a =&gt; b != c === d -&gt; e</div><div>0O 1lI {"{ }"} [ ] | &amp;&amp; ||</div></pre>
          </div>
          <div class="row">
            <div class="label">
              <span>Font size</span>
            </div>
            <div class="range">
              <input
                type="range"
                min={FONT_SIZE_RANGE.terminal[0]}
                max={FONT_SIZE_RANGE.terminal[1]}
                step="0.5"
                value={settings.terminalFontSize}
                oninput={(event) => set("terminalFontSize", Number(event.currentTarget.value))}
                aria-label="Terminal font size"
              />
              <span class="value">{settings.terminalFontSize}px</span>
            </div>
          </div>
          <div class="row">
            <div class="label">
              <span>Line height</span>
              <span class="hint">A multiple of the font's own line height.</span>
            </div>
            <div class="range">
              <input
                type="range"
                min={TERMINAL_LINE_HEIGHT_RANGE[0]}
                max={TERMINAL_LINE_HEIGHT_RANGE[1]}
                step="0.1"
                value={settings.terminalLineHeight}
                oninput={(event) => set("terminalLineHeight", Math.round(Number(event.currentTarget.value) * 10) / 10)}
                aria-label="Terminal line height"
              />
              <span class="value">{settings.terminalLineHeight.toFixed(1)}</span>
            </div>
          </div>
          <div class="row">
            <div class="label">
              <span>Letter spacing</span>
              <span class="hint">Extra pixels between characters.</span>
            </div>
            <div class="range">
              <input
                type="range"
                min={TERMINAL_LETTER_SPACING_RANGE[0]}
                max={TERMINAL_LETTER_SPACING_RANGE[1]}
                step="1"
                value={settings.terminalLetterSpacing}
                oninput={(event) => set("terminalLetterSpacing", Number(event.currentTarget.value))}
                aria-label="Terminal letter spacing"
              />
              <span class="value">{settings.terminalLetterSpacing}px</span>
            </div>
          </div>
          <div class="row">
            <div class="label">
              <span>Font weight</span>
              <span class="hint">Medium needs a font that has it, such as SF Mono or JetBrains Mono.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Terminal font weight">
              {#each fontWeights as weight (weight.value)}
                <button
                  role="radio"
                  aria-checked={settings.terminalFontWeight === weight.value}
                  class:on={settings.terminalFontWeight === weight.value}
                  onclick={() => set("terminalFontWeight", weight.value)}
                >
                  {weight.label}
                </button>
              {/each}
            </div>
          </div>
          <div class="row">
            <div class="label">
              <span>Bold text weight</span>
              <span class="hint">For text that programs print in bold.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Terminal bold text weight">
              {#each fontWeights as weight (weight.value)}
                <button
                  role="radio"
                  aria-checked={settings.terminalFontWeightBold === weight.value}
                  class:on={settings.terminalFontWeightBold === weight.value}
                  onclick={() => set("terminalFontWeightBold", weight.value)}
                >
                  {weight.label}
                </button>
              {/each}
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Font ligatures</span>
              <span class="hint">
                Draw <code>=&gt;</code>, <code>!=</code> and similar as single glyphs with fonts such as Fira Code or
                JetBrains Mono. A ligature splits where colors change or under the cursor, and fonts whose ligatures
                change the text width can misalign columns. Ligatures draw without GPU acceleration.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalLigatures}
              onchange={(event) => set("terminalLigatures", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Icons from patched fonts</span>
              <span class="hint">
                Nerd Font and Powerline symbols used by prompts like Powerlevel10k, Starship and oh-my-posh. Install a
                Nerd Font such as MesloLGS NF, then pick it above, or install Symbols Nerd Font Mono to keep any font.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalNerdFontIcons}
              onchange={(event) => set("terminalNerdFontIcons", event.currentTarget.checked)}
            />
          </label>

          <h4 class="group-title">Cursor</h4>
          <div class="row">
            <div class="label">
              <span>Cursor style</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Terminal cursor style">
              {#each cursorStyles as style (style.value)}
                <button
                  role="radio"
                  aria-checked={settings.terminalCursorStyle === style.value}
                  class:on={settings.terminalCursorStyle === style.value}
                  onclick={() => set("terminalCursorStyle", style.value)}
                >
                  {style.label}
                </button>
              {/each}
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Cursor blink</span>
              <span class="hint">Blinks while the terminal has focus.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalCursorBlink}
              onchange={(event) => set("terminalCursorBlink", event.currentTarget.checked)}
            />
          </label>

          <h4 class="group-title">Behavior</h4>
          <div class="row">
            <div class="label">
              <span>Scrollback<MemoryFlag setting="terminalScrollback" /></span>
              <span class="hint">
                Lines kept for scrolling back, {TERMINAL_SCROLLBACK_RANGE[0].toLocaleString()} to
                {TERMINAL_SCROLLBACK_RANGE[1].toLocaleString()}. A full terminal uses about 2 KB per line in a wide window:
                about 10 MB at 5,000 lines and 200 MB at 100,000.
              </span>
            </div>
            <input
              class="input number-input"
              type="number"
              inputmode="numeric"
              min={TERMINAL_SCROLLBACK_RANGE[0]}
              max={TERMINAL_SCROLLBACK_RANGE[1]}
              step="1000"
              bind:value={scrollbackDraft}
              onchange={applyScrollback}
              onkeydown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyScrollback();
                }
              }}
              aria-label="Terminal scrollback lines"
            />
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Copy on selection</span>
              <span class="hint">Selecting text copies it to the clipboard.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalCopyOnSelect}
              onchange={(event) => set("terminalCopyOnSelect", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Find in terminal</span>
              <span class="hint">Cmd+F searches the output. Off, the search code is never loaded.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalFind}
              onchange={(event) => set("terminalFind", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Clickable file paths</span>
              <span class="hint">Cmd+click a path such as <code>src/app.ts:12:5</code> to open it at that line. Only files inside an open folder become links.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalFileLinks}
              onchange={(event) => set("terminalFileLinks", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Drop files to type their paths</span>
              <span class="hint">Dropping files from Finder on a terminal types their paths, quoted for the shell.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalDropPaths}
              onchange={(event) => set("terminalDropPaths", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Visual bell</span>
              <span class="hint">A short flash when the shell rings the bell, or a dot on a terminal that is out of sight.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalVisualBell}
              onchange={(event) => set("terminalVisualBell", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Smooth scrolling</span>
              <span class="hint">Animates scrolling with the mouse wheel.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalSmoothScrolling}
              onchange={(event) => set("terminalSmoothScrolling", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Option as Meta key</span>
              <span class="hint">macOS: Option+B, Option+F and other emacs keys work in the shell. Off, Option types characters such as å.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalOptionAsMeta}
              onchange={(event) => set("terminalOptionAsMeta", event.currentTarget.checked)}
            />
          </label>
          <div class="row">
            <div class="label">
              <span>Keyboard</span>
              <span class="hint">
                Ctrl+` shows or hides the terminal, Ctrl+Shift+` opens a new one. In a terminal, Cmd+C copies the
                selection, Cmd+V pastes, Cmd+K clears, Cmd+F finds and Cmd+\ splits; other Cmd shortcuts still work.
              </span>
            </div>
          </div>

          <h4 class="group-title">Rendering</h4>
          <label class="row toggle-row">
            <div class="label">
              <span>GPU acceleration<MemoryFlag setting="terminalGpuAcceleration" /></span>
              <span class="hint">Recommended. Draws with WebGL, which keeps busy output smooth and uses less CPU. It uses about 70 MB more for the first terminal, mostly graphics memory, and about 10 MB for each other one. With font ligatures on, the regular renderer is used.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalGpuAcceleration}
              onchange={(event) => set("terminalGpuAcceleration", event.currentTarget.checked)}
            />
          </label>
          <label class="row toggle-row">
            <div class="label">
              <span>Unicode 11 widths</span>
              <span class="hint">Emoji and wide characters take the right number of columns. Applies to output printed after the change.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.terminalUnicode11}
              onchange={(event) => set("terminalUnicode11", event.currentTarget.checked)}
            />
          </label>
        {:else if section === "keyboard"}
          <KeyboardShortcuts filter={foundShortcuts > 0 ? searchQuery : ""} />
        {:else if section === "github"}
          <div class="row stacked">
            <div class="label">
              <span>GitHub account</span>
              <span class="hint">
                Used by Git &gt; GitHub: Share Project on GitHub, Sync Fork and Create Gist. Pushing and pulling keep
                using git's own credentials.
              </span>
            </div>
            <GitHubSignInForm />
          </div>
        {:else if section === "automation"}
          <h4 class="group-title">MCP server</h4>
          <label class="row toggle-row">
            <div class="label">
              <span>MCP server</span>
              <span class="hint">
                MCP (Model Context Protocol) lets AI tools such as Claude Code or Cursor use Git Manager: read what it shows,
                run its features and measure its performance. Off by default. When on, it only listens on this Mac and every
                request needs the secret token below.
              </span>
            </div>
            <input type="checkbox" class="switch" checked={settings.mcpEnabled} onchange={(event) => set("mcpEnabled", event.currentTarget.checked)} />
          </label>
          <div class="row">
            <div class="label">
              <span>Status</span>
              <span class="hint selectable" class:status-error={mcpStatusFailed}>{mcpStatusLine}</span>
            </div>
            <button class="btn small" onclick={showMcpTools}>Available MCP Tools...</button>
          </div>
          <div class="row">
            <div class="label">
              <span>Port</span>
              <span class="hint" class:status-error={portError !== null}>
                {portError ?? "On 127.0.0.1, shared with the command line tool. A change restarts the server."}
              </span>
            </div>
            <input
              class="input number-input"
              inputmode="numeric"
              bind:value={portDraft}
              onchange={applyPort}
              onkeydown={(event) => {
                if (event.key === "Enter") {
                  applyPort();
                }
              }}
              aria-label="MCP server port"
            />
          </div>
          {#if mcpToken}
            <div class="row stacked">
              <div class="label">
                <span>Secret token</span>
                <span class="hint">Connected tools send it with every request. Keep it private.</span>
              </div>
              <div class="path-row">
                <code class="path selectable">{showToken ? mcpToken : maskToken(mcpToken)}</code>
                <button class="btn small" onclick={() => (showToken = !showToken)}>{showToken ? "Hide" : "Show"}</button>
                <button class="btn small" onclick={() => void copy(mcpToken)}>Copy</button>
                <button class="btn small danger" onclick={() => void mcpStore.regenerateToken()} disabled={mcpStore.working}>New Token</button>
              </div>
            </div>
            <div class="row stacked">
              <div class="label">
                <span>Connect Claude Code</span>
                <span class="hint">Run this once in a terminal.</span>
              </div>
              <div class="snippet">
                <pre class="command selectable">{claudeAddCommand(mcpUrl, showToken ? mcpToken : maskToken(mcpToken))}</pre>
                <button class="btn small" onclick={() => void copy(claudeAddCommand(mcpUrl, mcpToken))}>Copy</button>
              </div>
            </div>
            <div class="row stacked">
              <div class="label">
                <span>Other MCP clients</span>
                <span class="hint">Most MCP clients read a config like this one.</span>
              </div>
              <div class="snippet">
                <pre class="command selectable">{mcpJsonConfig(mcpUrl, showToken ? mcpToken : maskToken(mcpToken))}</pre>
                <button class="btn small" onclick={() => void copy(mcpJsonConfig(mcpUrl, mcpToken))}>Copy</button>
              </div>
            </div>
          {:else if serverWanted}
            <div class="row">
              <div class="label">
                <span>Secret token</span>
                <span class="hint">Made when the server first starts.</span>
              </div>
            </div>
          {/if}

          <h4 class="group-title">Command line tool</h4>
          <label class="row toggle-row">
            <div class="label">
              <span>Command line tool</span>
              <span class="hint">
                Lets scripts and AI agents in a terminal use the same tools, for example <code>git-manager cli tools</code> or
                <code>git-manager cli call git_status repoPath=...</code>. Git Manager must be running.
              </span>
            </div>
            <input type="checkbox" class="switch" checked={settings.cliEnabled} onchange={(event) => set("cliEnabled", event.currentTarget.checked)} />
          </label>
          {#if mcpStatus}
            <div class="row">
              <div class="label">
                <span>Install</span>
                <span class="hint selectable">
                  {mcpStatus.cliInstalledPath
                    ? `Installed at ${mcpStatus.cliInstalledPath}.`
                    : "Adds git-manager to ~/.local/bin, so you can type it in any folder."}
                </span>
              </div>
              {#if mcpStatus.cliInstalledPath}
                <button class="btn small" onclick={() => void mcpStore.uninstallCli()} disabled={mcpStore.working}>Remove</button>
              {:else}
                <button class="btn small" onclick={() => void mcpStore.installCli()} disabled={mcpStore.working}>Install in ~/.local/bin</button>
              {/if}
            </div>
            {#if !mcpStatus.cliOnPath}
              <div class="row stacked">
                <div class="label">
                  <span>~/.local/bin is not on your PATH</span>
                  <span class="hint">Add this line to <code>~/.zshrc</code>, then open a new terminal, to type <code>git-manager</code> anywhere.</span>
                </div>
                <div class="snippet">
                  <pre class="command selectable">{LOCAL_BIN_PATH_LINE}</pre>
                  <button class="btn small" onclick={() => void copy(LOCAL_BIN_PATH_LINE)}>Copy</button>
                </div>
              </div>
            {/if}
            <div class="row stacked">
              <div class="label">
                <span>Examples</span>
                <span class="hint">The tool switches in Help &gt; Available MCP Tools apply here too.</span>
              </div>
              {#each cliExamples(cliCommandPrefix) as example (example.command)}
                <div class="snippet">
                  <div class="example">
                    <pre class="command selectable">{example.command}</pre>
                    <span class="hint">{example.hint}</span>
                  </div>
                  <button class="btn small" onclick={() => void copy(example.command)}>Copy</button>
                </div>
              {/each}
            </div>
          {/if}

          <h4 class="group-title">Memory log</h4>
          <label class="row toggle-row">
            <div class="label">
              <span>Log memory changes</span>
              <span class="hint">
                For finding what uses memory: writes a line whenever the app's memory changes, next to what was on
                screen and when scrolling started and stopped. AI tools can read it with <code>read_memory_log</code>.
              </span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.memoryLogEnabled}
              onchange={(event) => set("memoryLogEnabled", event.currentTarget.checked)}
            />
          </label>
          <div class="row">
            <div class="label">
              <span>Read memory every</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Memory log interval">
              {#each [250, 500, 1000, 2000] as intervalMs (intervalMs)}
                <button
                  role="radio"
                  aria-checked={settings.memoryLogIntervalMs === intervalMs}
                  class:on={settings.memoryLogIntervalMs === intervalMs}
                  onclick={() => set("memoryLogIntervalMs", intervalMs)}
                >
                  {intervalMs < 1000 ? `${intervalMs} ms` : `${intervalMs / 1000} s`}
                </button>
              {/each}
            </div>
          </div>
          <div class="row">
            <div class="label">
              <span>Write a line when it changes by</span>
              <span class="hint">0 MB writes every reading.</span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Memory log threshold">
              {#each [0, 1, 5, 20] as thresholdMb (thresholdMb)}
                <button
                  role="radio"
                  aria-checked={settings.memoryLogThresholdMb === thresholdMb}
                  class:on={settings.memoryLogThresholdMb === thresholdMb}
                  onclick={() => set("memoryLogThresholdMb", thresholdMb)}
                >
                  {thresholdMb} MB
                </button>
              {/each}
            </div>
          </div>
          {#if memoryLog.status}
            <div class="row">
              <div class="label">
                <span>Log file</span>
                <code class="path selectable">{memoryLog.status.path}</code>
              </div>
              <button class="btn small" onclick={() => void revealMemoryLog()}>Reveal in Finder</button>
            </div>
          {/if}
        {:else if section === "updates"}
          <div class="row">
            <div class="label">
              <span>Version</span>
              <span class="hint">{checkedLabel()}</span>
            </div>
            <div class="update-actions">
              <code class="path">{updates.current ?? "unknown"}</code>
              <button class="btn small" onclick={() => void updates.check(true)} disabled={updates.checking}>Check Now</button>
            </div>
          </div>
          <label class="row toggle-row">
            <div class="label">
              <span>Check for updates automatically</span>
              <span class="hint">Asks GitHub for new releases every few hours. Nothing is downloaded or installed without you.</span>
            </div>
            <input
              type="checkbox"
              class="switch"
              checked={settings.checkForUpdates}
              onchange={(event) => set("checkForUpdates", event.currentTarget.checked)}
            />
          </label>
          <div class="row">
            <div class="label">
              <span>Update channel</span>
              <span class="hint">
                Stable gets finished releases only. Beta also gets pre-releases with new features to try early.
                Automatic follows betas only when this build is a beta. Now following: <strong>{updates.channel}</strong>.
              </span>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Update channel">
              {#each channels as option (option.value)}
                <button
                  role="radio"
                  aria-checked={settings.updateChannel === option.value}
                  class:on={settings.updateChannel === option.value}
                  onclick={() => {
                    set("updateChannel", option.value);
                    void updates.check(false);
                  }}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>
          <div class="row">
            <div class="label">
              <span>Release notes</span>
              <span class="hint">What changed in this version, from the changelog built into the app.</span>
            </div>
            <div class="update-actions">
              <button class="btn small" onclick={() => (updates.whatsNewOpen = true)}>What's New</button>
              <button class="btn small" onclick={() => void updates.openReleasesPage()}>All Releases</button>
            </div>
          </div>
          {#if settings.skippedVersion}
            <div class="row">
              <div class="label">
                <span>Skipped version</span>
                <span class="hint">{settings.skippedVersion} is not announced.</span>
              </div>
              <button class="btn small" onclick={() => updates.unskip()}>Announce Again</button>
            </div>
          {/if}
        {:else if section === "about"}
          <div class="about">
            <div class="about-logo"><Icon name="merge" size={26} /></div>
            <div>
              <div class="about-name">Git Manager</div>
              <div class="dim">Version {updates.current ?? "unknown"} &middot; {updates.channel} channel</div>
            </div>
          </div>
          <div class="link-list">
            <button class="link-row" onclick={() => void updates.openRepository()}>
              <Icon name="star" size={15} />
              <span>
                <strong>Star on GitHub</strong>
                <span class="hint">Like Git Manager? A star helps other people find it.</span>
              </span>
            </button>
            <button class="link-row" onclick={() => void updates.reportBug()}>
              <Icon name="bug" size={15} />
              <span>
                <strong>Report a Bug</strong>
                <span class="hint">Opens a GitHub issue with your version and system filled in.</span>
              </span>
            </button>
            <button class="link-row" onclick={() => void updates.requestFeature()}>
              <Icon name="lightbulb" size={15} />
              <span>
                <strong>Request a Feature</strong>
                <span class="hint">Suggest an idea or an improvement.</span>
              </span>
            </button>
            <button class="link-row" onclick={() => (updates.whatsNewOpen = true)}>
              <Icon name="history" size={15} />
              <span>
                <strong>Release Notes</strong>
                <span class="hint">What changed in this version.</span>
              </span>
            </button>
          </div>
        {:else if section === "files"}
          <div class="row stacked">
            <div class="label">
              <span>Settings folder</span>
              <span class="hint">
                Git Manager keeps its files here. You can edit
                <code>settings.json</code> by hand; <code>state.json</code> remembers recent folders and panel sizes.
              </span>
            </div>
            <div class="path-row">
              <code class="path selectable">{settings.configDir ?? "~/.gitmanager"}</code>
              {#if settings.configDir}
                <button class="btn small" onclick={() => void copy(`${settings.configDir}/settings.json`)}>Copy settings.json Path</button>
              {/if}
            </div>
          </div>
          <div class="row stacked">
            <div class="label">
              <span>Changed from defaults</span>
            </div>
            <ul class="changed">
              {#each settings.changedPreferences() as key (key)}
                <li><code>{key}</code>: {preferenceText(settings.preferences()[key])}</li>
              {:else}
                <li class="dim">Nothing yet</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 850;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 8vh;
    background: var(--overlay);
  }

  .dialog {
    width: min(760px, calc(100vw - 32px));
    height: min(520px, 84vh);
    display: flex;
    overflow: hidden;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    box-shadow: var(--shadow);
  }

  .drag-handle {
    cursor: grab;
    user-select: none;
  }

  .dialog.dragging,
  .dialog.dragging .drag-handle {
    cursor: grabbing;
  }

  .dialog.dragging {
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.32);
  }

  .nav {
    flex: none;
    width: 190px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 16px 10px 12px;
    background: var(--panel-alt);
    border-right: 1px solid var(--border-strong);
  }

  h2 {
    margin: 0 8px 12px;
    font-size: 15px;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    margin: 0 0 8px;
    padding: 0 6px 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--panel);
  }

  .search:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .magnifier {
    flex: none;
    display: flex;
    color: var(--text-faint);
  }

  .search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
  }

  .search .clear {
    flex: none;
    display: flex;
    padding: 2px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .search .clear:hover {
    background: var(--hover);
  }

  .nav-empty {
    padding: 6px 10px;
    color: var(--text-dim);
  }

  /* Blocks the search does not keep (settingsHighlight.ts sets the attribute). */
  .rows.searching :global([data-search-hidden]) {
    display: none;
  }

  .rows.unmatched {
    visibility: hidden;
  }

  .search-empty {
    margin: 4px 22px 0;
    color: var(--text-dim);
  }

  /* The Custom Highlight API paints matches without touching the rows. */
  :global(::highlight(settings-search)) {
    background-color: color-mix(in srgb, var(--warning) 40%, transparent);
    color: inherit;
  }

  .nav-item {
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .nav-item:hover {
    background: var(--hover);
  }

  .nav-item.active {
    background: var(--selected);
    font-weight: 500;
  }

  .nav-spacer {
    flex: 1;
  }

  .nav-item.reset {
    color: var(--danger);
    font-size: 12px;
  }

  .content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .content-head {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 12px 8px 22px;
  }

  h3 {
    margin: 0;
    font-size: 14px;
  }

  .rows {
    flex: 1;
    overflow-y: auto;
    padding: 4px 22px 20px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }

  .row.stacked {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .toggle-row {
    cursor: pointer;
  }

  .label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .show-console {
    align-self: flex-start;
    margin-top: 6px;
  }

  .label > span:first-child {
    font-weight: 500;
  }

  .hint {
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.45;
  }

  .segmented {
    flex: none;
    display: flex;
    padding: 2px;
    border-radius: 7px;
    background: var(--panel-alt);
    border: 1px solid var(--border-strong);
  }

  .segmented button {
    padding: 4px 12px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .segmented button.on {
    background: var(--panel);
    color: var(--text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
  }

  .range {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .range input {
    width: 160px;
    accent-color: var(--accent);
  }

  .value {
    width: 46px;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .weight-value {
    width: 76px;
  }

  .switch {
    flex: none;
    appearance: none;
    position: relative;
    width: 34px;
    height: 20px;
    margin: 0;
    border-radius: 10px;
    background: var(--border-strong);
    cursor: pointer;
    transition: background 0.15s;
  }

  .switch::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    transition: transform 0.15s;
  }

  .switch:checked {
    background: var(--accent);
  }

  .switch:checked::after {
    transform: translateX(14px);
  }

  .switch:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
    outline-offset: 2px;
  }

  .select {
    flex: none;
    max-width: 280px;
  }

  .font-row {
    display: flex;
    gap: 8px;
  }

  .theme-pickers {
    display: flex;
    gap: 14px;
  }

  .inline-link {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font-size: inherit;
    cursor: pointer;
  }

  .inline-link:hover {
    text-decoration: underline;
  }

  .font-input {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .font-picks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .font-pick {
    padding: 2px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    background: var(--panel);
    font-size: 12px;
    cursor: pointer;
  }

  .font-pick:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .font-preview {
    margin: 0;
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--editor-bg);
    border: 1px solid var(--border-strong);
    line-height: 1.55;
    white-space: pre;
    overflow-x: auto;
  }

  .terminal-preview {
    line-height: normal;
  }

  /* Each line is as tall as xterm's row: the font's normal line height times the setting. */
  .terminal-preview > div {
    line-height: calc(var(--term-line-height, 1) * 1lh);
  }

  .terminal-preview,
  .terminal-preview > div {
    font-variant-ligatures: none;
    font-feature-settings: "liga" 0, "calt" 0;
  }

  .terminal-preview.liga-on,
  .terminal-preview.liga-on > div {
    font-variant-ligatures: common-ligatures contextual;
    font-feature-settings: "liga" 1, "calt" 1;
  }

  .terminal-preview .dim {
    color: var(--text-dim);
  }

  .group-title {
    margin: 18px 0 0;
    padding-bottom: 2px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .group-title:first-child {
    margin-top: 6px;
  }

  .group-hint {
    margin: 2px 0 0;
    font-size: 11.5px;
    color: var(--text-faint);
  }

  .sub-row {
    padding-left: 18px;
  }

  .number-input {
    flex: none;
    width: 110px;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .about {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 8px 0 16px;
  }

  .about-logo {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: var(--accent);
    color: var(--accent-text);
  }

  .about-name {
    font-size: 16px;
    font-weight: 700;
  }

  .link-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .link-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--panel);
    text-align: left;
    cursor: pointer;
  }

  .link-row:hover {
    border-color: var(--accent);
  }

  .link-row :global(svg) {
    margin-top: 2px;
    color: var(--accent);
  }

  .link-row > span {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .update-actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .path-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .path {
    padding: 4px 8px;
    border-radius: 5px;
    background: var(--panel-alt);
    font-size: 12px;
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.92em;
  }

  .changed {
    margin: 0;
    padding-left: 18px;
    font-size: 12.5px;
    line-height: 1.7;
  }

  .error-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0 22px 8px;
    padding: 10px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--danger) 10%, var(--panel));
    color: var(--text);
    font-size: 12.5px;
  }

  .error-banner :global(svg) {
    color: var(--danger);
    margin-top: 1px;
  }

  .error-banner > div {
    flex: 1;
    min-width: 0;
  }

  .status-error {
    color: var(--danger);
  }

  .snippet {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .snippet > .btn {
    flex: none;
  }

  .example {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .command {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 6px 8px;
    border-radius: 5px;
    background: var(--panel-alt);
    font-family: var(--font-mono);
    font-size: 11.5px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .error-banner > .banner-actions {
    flex: none;
    display: flex;
    gap: 6px;
  }
</style>
