<!--
  Quick Open, like VS Code: Cmd+P finds files (recently opened first), Shift+Cmd+P opens it on
  ">" for the Command Palette. ":" goes to a line, "@" to a symbol of the file, "#" to a
  symbol of the workspace and "?" lists the prefixes. Separate from Search Everywhere (double
  Shift, FileSearch.svelte); both use the Rust file and symbol indexes. Mounted only while open.
-->
<script lang="ts">
  import { EditorView } from "@codemirror/view";
  import { Channel } from "@tauri-apps/api/core";
  import { onMount, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { currentCommandViews, currentPlatform, runCommand, shortcutFor } from "$lib/commands/commandRuntime";
  import { matchesAccelerator } from "$lib/commands/keybinding";
  import { type PaletteItem, paletteList } from "$lib/commands/registry";
  import { lineTargetPosition } from "$lib/editor/textCommands";
  import { currentMenuInputs } from "$lib/menu/appMenu.svelte";
  import { countLabel } from "$lib/search/countLabel";
  import { pathRows, recentFiles, resultRows, type SearchRow, splitLocation } from "$lib/search/fileSearchModel";
  import { scrollToShow, visibleRange } from "$lib/search/popupRows";
  import SymbolResult from "$lib/search/SymbolResult.svelte";
  import { symbolRows, type SymbolRow } from "$lib/search/symbolSearchModel";
  import { recentFilesStore } from "$lib/recentFiles/recentFilesStore.svelte";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { FileSearchProgress, OutlineResult, SymbolSearchProgress } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import {
    type CaretInfo,
    commandRows,
    fileRows,
    firstSelectableRow,
    helpRows,
    isSelectableRow,
    lineRow,
    matchingRecent,
    moveSelectableRow,
    outlineRows,
    parsePickQuery,
    parseQuickOpen,
    PREFIXES,
    type QuickOpenMode,
    type QuickRow,
    recentOrder,
  } from "./quickOpenModel";
  import { quickOpen } from "./quickOpenStore.svelte";

  const FILE_LIMIT = 50;
  const SYMBOL_LIMIT = 50;
  /** Rows moved by Page Up / Page Down. */
  const PAGE = 10;
  /** Every row has this height, so the list is virtualized without measuring. */
  const ROW_HEIGHT = 26;
  /** Re-run a query this often while an index is still building. */
  const RETRY_MS = 250;
  /** Bigger documents are not sent for their symbols (the backend would skip them too). */
  const MAX_OUTLINE_CHARS = 8 * 1024 * 1024;

  const platform = currentPlatform();
  const folders = $derived(repoStore.workspace?.folders ?? []);
  const roots = $derived(folders.map((folder) => folder.root));
  /** The editor the popup opened over: ":" and "@" act on it, and so do the editor commands. */
  const target = quickOpen.target;

  let input = $state<HTMLInputElement | null>(null);
  let list = $state<HTMLDivElement | null>(null);
  /** Compare with...: the popup picks a file instead of opening it. */
  const picker = quickOpen.picker;
  let value = $state(untrack(() => quickOpen.initialValue));
  const parsed = $derived(picker ? parsePickQuery(value) : parseQuickOpen(value));

  // Read once: the state when the popup opened, with the editor it opened over as the focused one.
  const views = currentCommandViews({
    ...currentMenuInputs("app"),
    editor: {
      focused: target !== null,
      inText: target?.inText ?? false,
      writable: (target?.inText ?? false) && !(target?.view.state.readOnly ?? true),
    },
  });
  const caret: CaretInfo | null = target ? caretOf(target.view) : null;
  const recent: SearchRow[] = recentRows();

  let files = $state.raw<SearchRow[]>([]);
  let fileIndex = $state.raw<FileSearchProgress | null>(null);
  let symbols = $state.raw<SymbolRow[]>([]);
  let symbolIndex = $state.raw<SymbolSearchProgress | null>(null);
  let outline = $state.raw<OutlineResult | null>(null);
  let error = $state<string | null>(null);
  /** Why the selected command cannot run, after Enter on it. */
  let notice = $state<string | null>(null);

  let selected = $state(0);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);

  const requests = { files: 0, symbols: 0 };
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let filesOpened = false;
  let symbolsOpened = false;
  let outlineRequested = false;
  let closed = false;
  /** Select the first row when the next rows come (new query or mode). */
  let resetSelection = true;

  /** Recently opened files, from Recent Files (Cmd+E) and the open tabs. */
  function recentRows(): SearchRow[] {
    const tabPaths = repoStore.tabs.map((tab) => tab.path);
    const filePaths = recentOrder(recentFiles(null, recentFilesStore.filePaths(), tabPaths), repoStore.openFilePath);
    return pathRows(filePaths, repoStore.workspace?.folders ?? []);
  }

  function caretOf(view: EditorView): CaretInfo {
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    return { line: line.number, column: head - line.from + 1, lineCount: view.state.doc.lines };
  }

  function message(label: string): QuickRow[] {
    return [{ kind: "message", key: "message", label }];
  }

  const fileIndexing = $derived(fileIndex !== null && !fileIndex.done);
  const symbolIndexing = $derived(symbolIndex !== null && !symbolIndex.done);

  const rows = $derived.by((): QuickRow[] => {
    const text = parsed.text;
    switch (parsed.mode) {
      case "files": {
        if (roots.length === 0) {
          return message("Open a folder to search its files, or type > for commands");
        }
        const query = splitLocation(text).text;
        const shown = fileRows(matchingRecent(recent, query), query ? files : [], query !== "");
        if (shown.length > 0) {
          return shown;
        }
        if (!query) {
          return message("No recent files. Type to search files by name.");
        }
        return message(fileIndexing ? "Indexing..." : "No files match");
      }
      case "commands": {
        const palette = paletteList(views, text, settings.recentCommands, platform);
        const shown = commandRows(palette.recent, palette.other);
        return shown.length > 0 ? shown : message("No commands match");
      }
      case "line": {
        const info = lineRow(text, caret);
        return [{ kind: "line", key: "line", label: info.label, target: info.target }];
      }
      case "symbols": {
        if (!target?.filePath) {
          return message("Open a file in the editor to go to its symbols");
        }
        if (outline === null) {
          return message("Reading symbols...");
        }
        if (!outline.supported) {
          return message("No symbols for this kind of file");
        }
        if (outline.items.length === 0) {
          return message(outline.truncated ? "The file is too big to list its symbols" : "No symbols in this file");
        }
        const shown = outlineRows(outline.items, text);
        if (shown.length === 0) {
          return message("No symbols match");
        }
        return shown.map((item) => ({ kind: "outline", key: item.key, item }));
      }
      case "workspaceSymbols": {
        if (roots.length === 0) {
          return message("Open a folder to search its symbols");
        }
        if (!text) {
          return message("Type a class, function or constant name");
        }
        if (symbols.length > 0) {
          return symbols.map((symbol) => ({ kind: "symbol", key: symbol.key, symbol }));
        }
        return message(symbolIndexing ? "Indexing symbols..." : "No symbols match");
      }
      case "help":
        return helpRows();
    }
  });

  const range = $derived(visibleRange(scrollTop, viewportHeight, ROW_HEIGHT, rows.length));
  const visible = $derived(rows.slice(range.start, range.end).map((row, offset) => ({ row, index: range.start + offset })));

  const modeLabel = $derived(PREFIXES.find((entry) => entry.mode === parsed.mode)?.label ?? "");

  const status = $derived.by(() => {
    if (notice) {
      return notice;
    }
    if (error) {
      return error;
    }
    if (parsed.mode === "files" && fileIndexing) {
      return `Indexing ${countLabel(fileIndex?.indexed ?? 0, "file")}...`;
    }
    if (parsed.mode === "workspaceSymbols" && symbolIndexing) {
      return `Indexing symbols in ${countLabel(symbolIndex?.files ?? 0, "file")}...`;
    }
    return modeLabel;
  });

  onMount(() => {
    input?.focus();
    // After the prefix, like VS Code, so typing goes on from ">".
    const end = input?.value.length ?? 0;
    input?.setSelectionRange(end, end);
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      if (filesOpened) {
        void api.fileSearchClose().catch(() => {});
      }
      quickOpen.release();
    };
  });

  // Each change of the text runs its mode's query; only the latest answer of each is shown.
  $effect(() => {
    const { mode, text } = parsed;
    untrack(() => runMode(mode, text));
  });

  function runMode(mode: QuickOpenMode, text: string): void {
    clearTimeout(retryTimer);
    notice = null;
    if (mode === "files" && roots.length > 0) {
      ensureFiles();
      void queryFiles(text);
    } else if (mode === "workspaceSymbols" && roots.length > 0) {
      ensureFiles();
      ensureSymbols();
      void querySymbols(text);
    } else if (mode === "symbols") {
      ensureOutline();
    }
  }

  /** The file index starts (or is reused) the first time a mode needs it. */
  function ensureFiles(): void {
    if (filesOpened) {
      return;
    }
    filesOpened = true;
    const progress = new Channel<FileSearchProgress>();
    progress.onmessage = (update) => {
      if (closed) {
        return;
      }
      fileIndex = update;
      if (parsed.mode === "files") {
        void queryFiles(parsed.text);
      }
    };
    api
      .fileSearchOpen(roots, progress)
      .then((update) => {
        // Progress messages can overtake this answer; they are newer.
        if (!closed && fileIndex === null) {
          fileIndex = update;
        }
      })
      .catch((cause) => {
        if (!closed) {
          error = errorMessage(cause);
        }
      });
  }

  function ensureSymbols(): void {
    if (symbolsOpened) {
      return;
    }
    symbolsOpened = true;
    const progress = new Channel<SymbolSearchProgress>();
    progress.onmessage = (update) => {
      if (closed) {
        return;
      }
      symbolIndex = update;
      if (parsed.mode === "workspaceSymbols") {
        void querySymbols(parsed.text);
      }
    };
    api
      .symbolSearchOpen(roots, progress)
      .then((update) => {
        if (!closed && symbolIndex === null) {
          symbolIndex = update;
        }
      })
      .catch((cause) => {
        if (!closed) {
          error = errorMessage(cause);
        }
      });
  }

  /** Keeps results growing while an index builds, even if a progress message is missed. */
  function retryWhile(mode: "files" | "workspaceSymbols", text: string, run: (text: string) => Promise<void>): void {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      if (!closed && parsed.mode === mode && parsed.text === text) {
        void run(text);
      }
    }, RETRY_MS);
  }

  async function queryFiles(text: string): Promise<void> {
    const id = ++requests.files;
    if (splitLocation(text).text === "") {
      files = [];
      return;
    }
    try {
      const results = await api.fileSearchQuery(roots, text, FILE_LIMIT);
      if (id !== requests.files || closed) {
        return;
      }
      files = resultRows(results.items, folders);
      fileIndex = { indexed: results.indexed, done: results.done, truncated: results.truncated };
      error = null;
      if (!results.done) {
        retryWhile("files", text, queryFiles);
      }
    } catch (cause) {
      if (id === requests.files && !closed) {
        error = errorMessage(cause);
      }
    }
  }

  async function querySymbols(text: string): Promise<void> {
    const id = ++requests.symbols;
    if (text === "") {
      symbols = [];
      return;
    }
    try {
      const results = await api.symbolSearchQuery(roots, text, "all", SYMBOL_LIMIT);
      if (id !== requests.symbols || closed) {
        return;
      }
      symbols = symbolRows(results.items, folders);
      symbolIndex = { files: results.files, symbols: results.symbols, done: results.done, truncated: results.truncated };
      error = null;
      if (!results.done) {
        retryWhile("workspaceSymbols", text, querySymbols);
      }
    } catch (cause) {
      if (id === requests.symbols && !closed) {
        error = errorMessage(cause);
      }
    }
  }

  /** The "@" list is read once per popup, from the editor's text (unsaved edits included). */
  function ensureOutline(): void {
    if (outlineRequested || !target?.filePath) {
      return;
    }
    outlineRequested = true;
    const doc = target.view.state.doc;
    if (doc.length > MAX_OUTLINE_CHARS) {
      outline = { items: [], supported: true, truncated: true };
      return;
    }
    api
      .documentSymbols(target.filePath, doc.toString())
      .then((result) => {
        if (!closed) {
          outline = result;
        }
      })
      .catch((cause) => {
        if (!closed) {
          outline = { items: [], supported: true, truncated: false };
          error = errorMessage(cause);
        }
      });
  }

  // Keep the same row selected while results refresh; the first one after a new query or mode.
  let previousRows: QuickRow[] = [];
  $effect(() => {
    const next = rows;
    untrack(() => {
      if (resetSelection) {
        selected = firstSelectableRow(next);
        resetSelection = false;
      } else {
        const key = previousRows[selected]?.key;
        const index = key ? next.findIndex((row) => row.key === key) : -1;
        selected = index >= 0 && isSelectableRow(next[index]) ? index : firstSelectableRow(next);
      }
      previousRows = next;
    });
  });

  // Keep the selected row visible.
  $effect(() => {
    const index = selected;
    const count = rows.length;
    untrack(() => {
      if (!list || count === 0) {
        return;
      }
      const top = scrollToShow(index, list.scrollTop, list.clientHeight, ROW_HEIGHT, firstSelectableRow(rows));
      if (top !== list.scrollTop) {
        list.scrollTop = top;
        scrollTop = top;
      }
    });
  });

  function setValue(next: string): void {
    value = next;
    resetSelection = true;
    if (list) {
      list.scrollTop = 0;
    }
    scrollTop = 0;
    input?.focus();
  }

  function cancel(): void {
    quickOpen.close();
    quickOpen.restoreFocus();
  }

  /** Moves the caret of the editor the popup opened over, and gives it the focus. */
  function goToPosition(line: number, column: number): void {
    quickOpen.close();
    const view = target?.view ?? null;
    if (!view?.dom.isConnected) {
      quickOpen.restoreFocus();
      return;
    }
    const position = lineTargetPosition(view.state, { line, column });
    view.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: "center" }) });
    view.focus();
  }

  /** `toSide` (Cmd+Enter) opens it in the other editor group, as in VS Code. */
  function openFile(filePath: string, line: number | null, column: number | null, toSide = false): void {
    quickOpen.close();
    if (picker) {
      picker.onPick(filePath);
      return;
    }
    void navigation.openFileAt(filePath, line !== null ? Math.max(0, line - 1) : null, column !== null ? Math.max(0, column - 1) : null, {
      pin: true,
      toSide,
    });
  }

  function runPaletteCommand(command: PaletteItem): void {
    // Go to File from the palette switches the popup to files, like VS Code.
    if (command.commandId === "edit.goToFile") {
      setValue("");
      return;
    }
    if (!command.enabled) {
      notice = command.reason;
      return;
    }
    quickOpen.close();
    // The command sees the app as it was: focus back first (editor commands need it).
    quickOpen.restoreFocus();
    if (command.commandId !== "commands.clearRecent") {
      settings.rememberCommand(command.commandId);
    }
    runCommand(command.commandId, target?.view ?? null);
  }

  function activate(row: QuickRow, toSide = false): void {
    switch (row.kind) {
      case "file": {
        // From the text as typed ("cart:42"), even if its results are still on the way.
        const { line, column } = splitLocation(parsed.text);
        openFile(row.file.path, line, column, toSide);
        break;
      }
      case "symbol":
        openFile(row.symbol.path, row.symbol.line, row.symbol.column, toSide);
        break;
      case "command":
        runPaletteCommand(row.command);
        break;
      case "outline":
        goToPosition(row.item.line, row.item.column);
        break;
      case "line":
        if (row.target) {
          goToPosition(row.target.line, row.target.column);
        }
        break;
      case "help":
        setValue(row.prefix);
        break;
      case "header":
      case "message":
        break;
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }
    const ctrlOnly = event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
    let step = 0;
    if (event.key === "ArrowDown" || (ctrlOnly && event.key === "n")) {
      step = 1;
    } else if (event.key === "ArrowUp" || (ctrlOnly && event.key === "p")) {
      step = -1;
    } else if (event.key === "PageDown") {
      step = PAGE;
    } else if (event.key === "PageUp") {
      step = -PAGE;
    }
    if (step !== 0) {
      event.preventDefault();
      event.stopPropagation();
      notice = null;
      selected = moveSelectableRow(rows, selected, step);
      return;
    }
    // Cmd+P and Shift+Cmd+P again: switch to files or commands, or step down when already there (VS Code).
    const filesKey = shortcutFor("edit.goToFile");
    const commandsKey = shortcutFor("view.commandPalette");
    const files = filesKey !== null && matchesAccelerator(event, filesKey, platform);
    const commands = commandsKey !== null && matchesAccelerator(event, commandsKey, platform);
    if (files || commands) {
      event.preventDefault();
      event.stopPropagation();
      const mode = commands ? "commands" : "files";
      if (parsed.mode === mode) {
        selected = moveSelectableRow(rows, selected, 1);
      } else {
        setValue(commands ? ">" : "");
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      // Cmd+Enter opens a file to the side (the other editor group), as in VS Code.
      const toSide = platform === "macos" ? event.metaKey : event.ctrlKey;
      const row = rows[selected];
      if (row && isSelectableRow(row)) {
        activate(row, toSide);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (event.key === "Tab") {
      // Keeps the focus in the field.
      event.preventDefault();
      event.stopPropagation();
    }
  }

  const placeholder = picker?.placeholder ?? "Search files by name, or type ? for help";
</script>

<!-- Clicking anywhere outside the popup closes it. -->
<div class="backdrop" role="presentation" onmousedown={cancel}></div>

<div class="popup" role="dialog" aria-label="Quick Open">
  <div class="field">
    <Icon name={parsed.mode === "commands" ? "carets" : "search"} size={15} />
    <input
      bind:this={input}
      {value}
      class="query"
      type="text"
      {placeholder}
      spellcheck="false"
      autocomplete="off"
      aria-label="Quick Open"
      oninput={(event) => {
        value = event.currentTarget.value;
        resetSelection = true;
      }}
      onkeydown={onKeydown}
    />
    <span class="status" class:notice={notice !== null || error !== null}>{status}</span>
  </div>
  <div
    class="list"
    role="listbox"
    aria-label="Results"
    bind:this={list}
    bind:clientHeight={viewportHeight}
    onscroll={() => (scrollTop = list?.scrollTop ?? 0)}
  >
    <div class="canvas" style="height: {rows.length * ROW_HEIGHT}px">
      {#each visible as { row, index } (row.key)}
        {#if row.kind === "header"}
          <div class="section" role="presentation" style="top: {index * ROW_HEIGHT}px">{row.label}</div>
        {:else if row.kind === "message" || (row.kind === "line" && row.target === null)}
          <div class="message" role="presentation" style="top: {index * ROW_HEIGHT}px">{row.label}</div>
        {:else}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="row"
            class:selected={index === selected}
            class:disabled={row.kind === "command" && !row.command.enabled}
            role="option"
            tabindex="-1"
            aria-selected={index === selected}
            aria-disabled={row.kind === "command" && !row.command.enabled}
            style="top: {index * ROW_HEIGHT}px"
            title={row.kind === "file"
              ? row.file.path
              : row.kind === "symbol"
                ? row.symbol.title
                : row.kind === "command" && !row.command.enabled
                  ? (row.command.reason ?? undefined)
                  : undefined}
            onmousemove={() => (selected = index)}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => activate(row)}
          >
            {#if row.kind === "file"}
              <Icon name="file" size={14} />
              <span class="name">{#each row.file.nameParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}</span>
              <span class="folder">{#each row.file.folderParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}</span>
            {:else if row.kind === "command"}
              <span class="title"
                ><span class="category">{#each row.command.categoryParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}:</span
                > {#each row.command.titleParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}</span
              >
              {#if row.command.checked}
                <span class="check" title="On"><Icon name="check" size={13} /></span>
              {/if}
              {#if !row.command.enabled && row.command.reason}
                <span class="reason">{row.command.reason}</span>
              {/if}
              {#if row.command.shortcut}
                <kbd>{row.command.shortcut}</kbd>
              {/if}
            {:else if row.kind === "symbol"}
              <SymbolResult symbol={row.symbol} />
            {:else if row.kind === "outline"}
              <span class="indent" style="width: {row.item.depth * 14}px"></span>
              <span class="badge {row.item.kind.tone}" title={row.item.kind.label}>{row.item.kind.letter}</span>
              <span class="name">{#each row.item.nameParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}</span>
              {#if row.item.container}
                <span class="container">in {row.item.container}</span>
              {/if}
              <span class="folder">:{row.item.line}</span>
            {:else if row.kind === "line"}
              <Icon name="arrow-right" size={14} />
              <span class="name">{row.label}</span>
            {:else if row.kind === "help"}
              <kbd class="prefix">{row.prefix === "" ? "..." : row.prefix}</kbd>
              <span class="name">{row.label}</span>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 880;
  }

  .popup {
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 885;
    width: min(620px, calc(100vw - 32px));
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 38px;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border-strong);
  }

  .query {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 14px;
  }

  .query::placeholder {
    color: var(--text-faint);
  }

  .status {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11.5px;
    color: var(--text-faint);
  }

  .status.notice {
    color: var(--warning);
  }

  .list {
    max-height: min(468px, 60vh);
    overflow-y: auto;
    padding: 4px;
  }

  .canvas {
    position: relative;
    min-height: 26px;
  }

  .row,
  .section,
  .message {
    position: absolute;
    left: 0;
    right: 0;
    height: 26px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    border-radius: 4px;
    color: var(--text-dim);
  }

  .row {
    cursor: pointer;
  }

  .row.selected {
    background: var(--selected);
  }

  .row.disabled {
    cursor: default;
  }

  .row.disabled .title,
  .row.disabled kbd {
    color: var(--text-faint);
  }

  .section {
    justify-content: flex-end;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .message {
    color: var(--text-faint);
  }

  .name,
  .title {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 70%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    color: var(--text);
  }

  .title {
    max-width: none;
    flex: 1;
  }

  .category {
    color: var(--text-dim);
  }

  .folder,
  .container,
  .reason {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    font-size: 12px;
    color: var(--text-faint);
  }

  .folder {
    text-align: right;
  }

  .reason {
    flex: 0 1 auto;
    font-style: italic;
  }

  .container {
    flex: 0 1 auto;
  }

  .check {
    flex: none;
    display: inline-flex;
    color: var(--accent);
  }

  .indent {
    flex: none;
  }

  kbd {
    flex: none;
    padding: 0 6px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--panel-alt);
    color: var(--text-dim);
    font-family: var(--font-ui);
    font-size: 11.5px;
    line-height: 18px;
    white-space: nowrap;
  }

  kbd.prefix {
    min-width: 26px;
    text-align: center;
    font-family: var(--font-mono);
  }

  .badge {
    flex: none;
    width: 15px;
    height: 15px;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9.5px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--panel);
  }

  .badge.type {
    background: var(--tok-type);
  }

  .badge.interface {
    background: var(--tok-keyword);
  }

  .badge.function {
    background: var(--tok-function);
  }

  .badge.constant {
    background: var(--tok-property);
  }

  b {
    font-weight: 600;
    color: var(--accent);
  }
</style>
