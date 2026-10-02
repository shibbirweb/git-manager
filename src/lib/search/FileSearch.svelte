<!--
  Search Everywhere popup, like JetBrains: All, Classes, Files, Symbols and Text tabs.
  Opened by double Shift (All), Cmd+O (Classes), Cmd+P or Shift+Cmd+O (Files),
  Option+Cmd+O (Symbols), Shift+Cmd+F (Text, Find in Files) and Shift+Cmd+R (Text with
  its Replace field, Replace in Files).
-->
<script lang="ts">
  import { Channel } from "@tauri-apps/api/core";
  import { onMount, tick, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import SearchToggles from "$lib/ui/SearchToggles.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type {
    FileSearchProgress,
    ReplaceOutcome,
    ReplaceRequest,
    SymbolScope,
    SymbolSearchProgress,
    TextSearchBatch,
    TextSearchOptions,
  } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { fileSearch } from "./fileSearchStore.svelte";
  import { pathRows, recentFiles, resultRows, type SearchRow, splitLocation } from "./fileSearchModel";
  import {
    emptySource,
    firstSelectable,
    isSelectable,
    keepSelectedKey,
    moveSelectable,
    type PopupRow,
    scrollToShow,
    type SourceResults,
    tabRows,
    visibleRange,
  } from "./popupRows";
  import SearchTabs from "./SearchTabs.svelte";
  import { nothingToReplace, replaceConfirm, replaceSummary } from "./replaceModel";
  import { isReplaceKey, stepTab, tabForKey, type SearchTab, usesSymbols } from "./searchTabs";
  import SymbolResult from "./SymbolResult.svelte";
  import { symbolRows, type SymbolRow } from "./symbolSearchModel";
  import TextResult from "./TextResult.svelte";
  import { appendBatch, DEFAULT_TEXT_OPTIONS, EMPTY_TEXT, nextSearchId, searchable, type TextResults, textStatus } from "./textSearchModel";

  const FILE_LIMIT = 50;
  const SYMBOL_LIMIT = 50;
  /** Rows moved by Page Up / Page Down. */
  const PAGE = 10;
  /** Every row has this height, so the list can be virtualized without measuring. */
  const ROW_HEIGHT = 26;
  /** Re-run a query this often while an index is still building. */
  const RETRY_MS = 250;

  const folders = $derived(repoStore.workspace?.folders ?? []);
  const roots = $derived(folders.map((folder) => folder.root));

  let input = $state<HTMLInputElement | null>(null);
  let list = $state<HTMLDivElement | null>(null);
  let tab = $state<SearchTab>(untrack(() => fileSearch.initialTab));
  let query = $state(untrack(() => fileSearch.initialQuery));
  let textOptions = $state<TextSearchOptions>({ ...DEFAULT_TEXT_OPTIONS });
  /** Replace in Files: the Text tab's Replace field shows. */
  let replaceOpen = $state(untrack(() => fileSearch.initialReplace));
  let replacement = $state("");
  let replaceInput = $state<HTMLInputElement | null>(null);
  /** A Replace All on its way: counting for the confirmation, or writing the files. */
  let replacing = $state<"counting" | "writing" | null>(null);

  // Results per source; each stays on screen until the next answer for it arrives.
  let recent = $state.raw<SearchRow[]>([]);
  let files = $state.raw<SourceResults<SearchRow>>(emptySource());
  let classes = $state.raw<SourceResults<SymbolRow>>(emptySource());
  let members = $state.raw<SourceResults<SymbolRow>>(emptySource());
  let symbols = $state.raw<SourceResults<SymbolRow>>(emptySource());
  let text = $state.raw<TextResults>(EMPTY_TEXT);
  let textRunning = $state(false);
  /** The query the shown file and symbol results answer. */
  let shownQuery = $state(untrack(() => fileSearch.initialQuery));

  let fileIndex = $state.raw<FileSearchProgress | null>(null);
  let symbolIndex = $state.raw<SymbolSearchProgress | null>(null);
  let error = $state<string | null>(null);

  let selected = $state(0);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);

  const requests = { files: 0, classes: 0, members: 0, symbols: 0 };
  let textSearchId = 0;
  let replaceId = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let symbolsOpened = false;
  let closed = false;
  /** Select the first row when the next results arrive (new query or tab). */
  let resetSelection = true;
  /** Focus goes back here when the popup closes without opening anything. */
  let previousFocus: HTMLElement | null = null;

  const hasQuery = $derived(splitLocation(shownQuery).text !== "");
  const rows = $derived(tabRows(tab, { hasQuery, recent, files, classes, members, symbols, text }));
  const range = $derived(visibleRange(scrollTop, viewportHeight, ROW_HEIGHT, rows.length));
  const visible = $derived(rows.slice(range.start, range.end).map((row, offset) => ({ row, index: range.start + offset })));

  onMount(() => {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    input?.focus();
    input?.select();
    const tabPaths = repoStore.tabs.map((openTab) => openTab.path);
    recent = pathRows(recentFiles(repoStore.openFilePath, navigation.recentFilePaths(), tabPaths), folders);
    // Start (or reuse) the file index without waiting: the field is already usable.
    const progress = new Channel<FileSearchProgress>();
    progress.onmessage = (update) => {
      if (closed) {
        return;
      }
      fileIndex = update;
      if (tab !== "text" && splitLocation(query).text !== "") {
        void runQuery();
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
    void runQuery();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      // Counting has no use any more; a write already started finishes and reports.
      if (replacing === "counting") {
        cancelReplace();
      }
      void api.fileSearchClose().catch(() => {});
    };
  });

  /** The symbol index starts the first time a tab needs it. */
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
      if (usesSymbols(tab) && splitLocation(query).text !== "") {
        void runQuery();
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

  /** Runs the current tab's queries; only the latest answer of each is shown. */
  async function runQuery(): Promise<void> {
    clearTimeout(retryTimer);
    if (tab === "text") {
      runTextSearch();
      return;
    }
    if (usesSymbols(tab)) {
      ensureSymbols();
    }
    const value = query;
    if (splitLocation(value).text === "") {
      shownQuery = value;
      return;
    }
    const work: Promise<boolean>[] = [];
    if (tab === "all" || tab === "files") {
      work.push(queryFiles(value));
    }
    if (tab === "all" || tab === "classes") {
      work.push(querySymbols(value, "classes"));
    }
    if (tab === "all") {
      work.push(querySymbols(value, "members"));
    }
    if (tab === "symbols") {
      work.push(querySymbols(value, "all"));
    }
    const building = await Promise.all(work);
    if (closed || value !== query) {
      return;
    }
    if (building.some(Boolean)) {
      // Keeps results growing while indexing even if a progress message is missed.
      retryTimer = setTimeout(() => void runQuery(), RETRY_MS);
    }
  }

  /** Resolves to whether the file index is still building. */
  async function queryFiles(value: string): Promise<boolean> {
    const id = ++requests.files;
    try {
      const results = await api.fileSearchQuery(roots, value, FILE_LIMIT);
      if (id !== requests.files || closed) {
        return false;
      }
      files = { rows: resultRows(results.items, folders), matched: results.matched };
      fileIndex = { indexed: results.indexed, done: results.done, truncated: results.truncated };
      shownQuery = value;
      error = null;
      return !results.done;
    } catch (cause) {
      if (id === requests.files && !closed) {
        error = errorMessage(cause);
      }
      return false;
    }
  }

  /** Resolves to whether the symbol index is still building. */
  async function querySymbols(value: string, scope: SymbolScope): Promise<boolean> {
    const source = scope === "classes" ? "classes" : scope === "members" ? "members" : "symbols";
    const id = ++requests[source];
    try {
      const results = await api.symbolSearchQuery(roots, value, scope, SYMBOL_LIMIT);
      if (id !== requests[source] || closed) {
        return false;
      }
      const next = { rows: symbolRows(results.items, folders), matched: results.matched };
      if (source === "classes") {
        classes = next;
      } else if (source === "members") {
        members = next;
      } else {
        symbols = next;
      }
      symbolIndex = { files: results.files, symbols: results.symbols, done: results.done, truncated: results.truncated };
      shownQuery = value;
      error = null;
      return !results.done;
    } catch (cause) {
      if (id === requests[source] && !closed) {
        error = errorMessage(cause);
      }
      return false;
    }
  }

  /** Starts a text search, stopping the previous one; its results stream in batches. */
  function runTextSearch(): void {
    const value = query;
    const options = { ...textOptions };
    const searchId = nextSearchId();
    textSearchId = searchId;
    if (!searchable(value)) {
      textRunning = false;
      text = EMPTY_TEXT;
      void api.textSearchCancel(searchId).catch(() => {});
      return;
    }
    textRunning = true;
    let first = true;
    const results = new Channel<TextSearchBatch>();
    results.onmessage = (batch) => {
      if (closed || searchId !== textSearchId) {
        return;
      }
      // The old results stay until the new search has something to show.
      text = appendBatch(text, batch, folders, first);
      first = false;
      if (batch.done) {
        textRunning = false;
      }
    };
    api.textSearch(roots, searchId, value, options, results).catch((cause) => {
      if (!closed && searchId === textSearchId) {
        textRunning = false;
        text = { ...EMPTY_TEXT, error: errorMessage(cause) };
      }
    });
  }

  // Keep the same row selected while results refresh; the first one after a new query or tab.
  let previousRows: PopupRow[] = [];
  $effect(() => {
    const next = rows;
    untrack(() => {
      if (resetSelection && (next.length > 0 || previousRows.length > 0)) {
        selected = firstSelectable(next);
        resetSelection = next.length === 0;
      } else {
        selected = keepSelectedKey(previousRows, selected, next);
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
      const top = scrollToShow(index, list.scrollTop, list.clientHeight, ROW_HEIGHT, firstSelectable(rows));
      if (top !== list.scrollTop) {
        list.scrollTop = top;
        scrollTop = top;
      }
    });
  });

  function switchTab(next: SearchTab): void {
    if (next === tab) {
      return;
    }
    if (tab === "text" && textRunning) {
      // Nothing shows its results any more.
      textSearchId = nextSearchId();
      textRunning = false;
      void api.textSearchCancel(textSearchId).catch(() => {});
    }
    tab = next;
    resetSelection = true;
    if (list) {
      list.scrollTop = 0;
    }
    scrollTop = 0;
    void runQuery();
  }

  function toggleOption(option: keyof TextSearchOptions): void {
    textOptions = { ...textOptions, [option]: !textOptions[option] };
    resetSelection = true;
    if (tab === "text") {
      runTextSearch();
    }
  }

  function toggleReplace(): void {
    replaceOpen = !replaceOpen;
    void tick().then(() => (replaceOpen ? replaceInput : input)?.focus());
  }

  function cancelReplace(): void {
    replaceId = nextSearchId();
    replacing = null;
    void api.replaceInFilesCancel(replaceId).catch(() => {});
  }

  /** Text tab results can be replaced: a valid query with matches. */
  const canReplace = $derived(searchable(query) && text.error === null && text.rows.length > 0);

  /**
   * Replace All (every file) or one file's Replace: counts first, asks, then writes in the
   * backend. Files open with unsaved edits are never written.
   */
  async function replaceMatches(filePaths: string[] | null): Promise<void> {
    if (replacing !== null) {
      cancelReplace();
      return;
    }
    if (!canReplace) {
      return;
    }
    const request: ReplaceRequest = {
      query,
      options: { ...textOptions },
      replacement,
      filePaths,
      skipPaths: repoStore.dirtyPaths,
      preview: true,
    };
    const previewId = nextSearchId();
    replaceId = previewId;
    replacing = "counting";
    let preview: ReplaceOutcome;
    try {
      preview = await api.replaceInFiles(roots, previewId, request);
    } catch (cause) {
      if (replaceId === previewId) {
        replacing = null;
      }
      toast.error("Replace failed", errorMessage(cause));
      return;
    }
    if (replaceId !== previewId || preview.cancelled) {
      return;
    }
    replacing = null;
    const question = replaceConfirm(preview, request.replacement);
    if (!question) {
      toast.info("Nothing to replace", nothingToReplace(preview));
      return;
    }
    const ok = await dialogs.confirm({ ...question, danger: true });
    if (replaceId !== previewId || replacing !== null) {
      return;
    }
    if (!ok || closed) {
      void tick().then(() => replaceInput?.focus());
      return;
    }
    const writeId = nextSearchId();
    replaceId = writeId;
    replacing = "writing";
    let done: ReplaceOutcome;
    try {
      done = await api.replaceInFiles(roots, writeId, { ...request, skipPaths: repoStore.dirtyPaths, preview: false });
    } catch (cause) {
      if (replaceId === writeId) {
        replacing = null;
      }
      toast.error("Replace failed", errorMessage(cause));
      return;
    }
    if (replaceId === writeId) {
      replacing = null;
    }
    // Reported even after a Stop: the files written so far stay written.
    const summary = replaceSummary(done);
    if (summary.kind === "error") {
      toast.error(summary.title, summary.detail);
    } else {
      toast.success(summary.title, summary.detail);
    }
    if (done.files.length > 0) {
      void repoStore.filesWritten(done.files.map((replaced) => replaced.path));
    }
    if (!closed) {
      runTextSearch();
      void tick().then(() => replaceInput?.focus());
    }
  }

  function close(): void {
    fileSearch.close(tab);
  }

  function cancel(): void {
    close();
    const focus = previousFocus;
    void tick().then(() => {
      if (focus?.isConnected) {
        focus.focus();
      }
    });
  }

  function activate(row: PopupRow, pin: boolean): void {
    if (row.kind === "more") {
      switchTab(row.tab);
      return;
    }
    if (row.kind === "file") {
      // From the query as typed, even if its results are still on the way.
      const { line, column } = splitLocation(query);
      close();
      void navigation.openFileAt(row.file.path, line !== null ? Math.max(0, line - 1) : null, column !== null ? Math.max(0, column - 1) : null, {
        pin,
      });
      return;
    }
    if (row.kind === "symbol") {
      close();
      void navigation.openFileAt(row.symbol.path, Math.max(0, row.symbol.line - 1), Math.max(0, row.symbol.column - 1), { pin });
      return;
    }
    if (row.kind === "textLine") {
      close();
      void navigation.openFileAt(row.path, Math.max(0, row.line - 1), Math.max(0, row.column - 1), { pin });
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }
    // Option+C / W / X toggle Match case, Words and Regex, as in JetBrains.
    if (tab === "text" && event.altKey && !event.metaKey && !event.ctrlKey) {
      const option = event.code === "KeyC" ? "matchCase" : event.code === "KeyW" ? "wholeWords" : event.code === "KeyX" ? "regex" : null;
      if (option) {
        event.preventDefault();
        event.stopPropagation();
        toggleOption(option);
        return;
      }
    }
    const ctrlOnly = event.ctrlKey && !event.metaKey && !event.altKey;
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
      selected = moveSelectable(rows, selected, step);
      return;
    }
    // Shift+Cmd+R: the Text tab with its Replace field.
    if (isReplaceKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      switchTab("text");
      replaceOpen = true;
      void tick().then(() => replaceInput?.focus());
      return;
    }
    // After the moves: Ctrl+P (up) would also read as Cmd+P, the Files key.
    const tabShortcut = tabForKey(event);
    if (tabShortcut) {
      event.preventDefault();
      event.stopPropagation();
      switchTab(tabShortcut);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const row = rows[selected];
      if (row && isSelectable(row)) {
        // Shift+Enter or Cmd+Enter opens a preview tab; Enter keeps the tab.
        activate(row, !(event.shiftKey || event.metaKey));
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
      event.preventDefault();
      event.stopPropagation();
      switchTab(stepTab(tab, event.shiftKey ? -1 : 1));
    }
  }

  function count(value: number, word: string): string {
    return `${value.toLocaleString()} ${word}${value === 1 ? "" : "s"}`;
  }

  function shownOf(source: SourceResults<unknown>, word: string): string {
    if (source.matched > source.rows.length) {
      return `Showing the first ${source.rows.length} of ${source.matched.toLocaleString()}`;
    }
    return count(source.matched, word);
  }

  const fileIndexing = $derived(fileIndex !== null && !fileIndex.done);
  const symbolIndexing = $derived(symbolIndex !== null && !symbolIndex.done);

  const status = $derived.by(() => {
    if (tab === "text" && replacing !== null) {
      return replacing === "counting" ? "Counting matches..." : "Replacing...";
    }
    if (tab === "text") {
      return textStatus(text, textRunning);
    }
    if (error) {
      return error;
    }
    if ((tab === "files" || tab === "all") && fileIndexing) {
      return `Indexing ${count(fileIndex?.indexed ?? 0, "file")}...`;
    }
    if (usesSymbols(tab) && symbolIndexing) {
      return `Indexing symbols in ${count(symbolIndex?.files ?? 0, "file")}...`;
    }
    if (!hasQuery) {
      return "";
    }
    if (tab === "files") {
      return shownOf(files, "file");
    }
    if (tab === "classes") {
      return shownOf(classes, "class");
    }
    if (tab === "symbols") {
      return shownOf(symbols, "symbol");
    }
    return "";
  });

  const statusIsError = $derived(tab === "text" ? text.error !== null : error !== null);

  const capped = $derived.by(() => {
    if ((tab === "files" || tab === "all") && fileIndex?.truncated) {
      return `Only the first ${fileIndex.indexed.toLocaleString()} files are searched`;
    }
    if (usesSymbols(tab) && symbolIndex?.truncated) {
      return `Only the first ${symbolIndex.symbols.toLocaleString()} symbols are kept`;
    }
    if (tab === "text" && fileIndex?.truncated) {
      return `Only the first ${fileIndex.indexed.toLocaleString()} files are searched`;
    }
    return null;
  });

  const emptyText = $derived.by(() => {
    if (tab === "text") {
      if (!searchable(query)) {
        return "Type at least 2 characters to search file contents";
      }
      if (text.error) {
        return text.error;
      }
      return textRunning ? "Searching..." : "No matches";
    }
    if (!hasQuery) {
      if (tab === "classes") {
        return "Type a class, interface or type name";
      }
      if (tab === "symbols") {
        return "Type a function, method or constant name (Cart.add works too)";
      }
      return "No recent files";
    }
    if (usesSymbols(tab) && symbolIndexing) {
      return "Indexing...";
    }
    if (tab !== "classes" && tab !== "symbols" && fileIndexing) {
      return "Indexing...";
    }
    if (tab === "classes") {
      return "No classes match";
    }
    if (tab === "symbols") {
      return "No symbols match";
    }
    return tab === "files" ? "No files match" : "Nothing found";
  });

  const placeholder = $derived.by(() => {
    switch (tab) {
      case "all":
        return "Search classes, files and symbols";
      case "classes":
        return "Search classes by name";
      case "files":
        return "Search files by name (use : for a line)";
      case "symbols":
        return "Search functions, methods and constants";
      case "text":
        return "Search file contents";
    }
  });
</script>

<!-- Clicking anywhere outside the popup closes it. -->
<div class="backdrop" role="presentation" onmousedown={cancel}></div>

<div class="popup" role="dialog" aria-label="Search Everywhere">
  <div class="top">
    <SearchTabs {tab} onSelect={switchTab} />
    <span class="status" class:error={statusIsError}>{status}</span>
    {#if capped}
      <span class="capped" title={capped}>Capped</span>
    {/if}
  </div>
  <div class="field">
    {#if tab === "text"}
      <button
        type="button"
        class="chevron"
        title={replaceOpen ? "Hide Replace Field" : "Show Replace Field (Shift+Cmd+R)"}
        aria-label={replaceOpen ? "Hide Replace Field" : "Show Replace Field"}
        aria-expanded={replaceOpen}
        onmousedown={(event) => event.preventDefault()}
        onclick={toggleReplace}
      >
        <Icon name={replaceOpen ? "chevron-down" : "chevron-right"} size={14} />
      </button>
    {/if}
    <Icon name="search" size={15} />
    <input
      bind:this={input}
      value={query}
      class="query"
      type="text"
      {placeholder}
      spellcheck="false"
      autocomplete="off"
      aria-label={placeholder}
      oninput={(event) => {
        query = event.currentTarget.value;
        resetSelection = true;
        void runQuery();
      }}
      onkeydown={onKeydown}
    />
    {#if tab === "text"}
      <SearchToggles options={textOptions} onToggle={toggleOption} />
    {/if}
  </div>
  {#if tab === "text" && replaceOpen}
    <div class="field replace">
      <span class="replace-indent"></span>
      <input
        bind:this={replaceInput}
        value={replacement}
        class="query"
        type="text"
        placeholder="Replace with"
        spellcheck="false"
        autocomplete="off"
        aria-label="Replace with"
        oninput={(event) => (replacement = event.currentTarget.value)}
        onkeydown={onKeydown}
      />
      <button
        type="button"
        class="btn small"
        class:danger={replacing === null}
        disabled={replacing === null && !canReplace}
        title={replacing !== null ? "Stop replacing" : "Replace every match in every file (asks first)"}
        onmousedown={(event) => event.preventDefault()}
        onclick={() => void replaceMatches(null)}>{replacing !== null ? "Stop" : "Replace All"}</button
      >
    </div>
  {/if}
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
        {:else if row.kind === "textFile"}
          <div class="row heading" role="presentation" style="top: {index * ROW_HEIGHT}px" title={row.path}>
            <TextResult {row} />
            {#if replaceOpen}
              <button
                type="button"
                class="row-replace"
                disabled={replacing !== null || !canReplace}
                title="Replace the matches in this file (asks first)"
                onmousedown={(event) => event.preventDefault()}
                onclick={() => void replaceMatches([row.path])}>Replace</button
              >
            {/if}
          </div>
        {:else}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="row"
            class:selected={index === selected}
            class:more={row.kind === "more"}
            role="option"
            tabindex="-1"
            aria-selected={index === selected}
            style="top: {index * ROW_HEIGHT}px"
            title={row.kind === "file" ? row.file.path : row.kind === "symbol" ? row.symbol.title : undefined}
            onmousemove={() => (selected = index)}
            onmousedown={(event) => event.preventDefault()}
            onclick={(event) => activate(row, !(event.shiftKey || event.metaKey))}
          >
            {#if row.kind === "file"}
              <Icon name="file" size={14} />
              <span class="name">{#each row.file.nameParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}</span>
              <span class="folder">{#each row.file.folderParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}</span>
            {:else if row.kind === "symbol"}
              <SymbolResult symbol={row.symbol} />
            {:else if row.kind === "more"}
              <Icon name="more" size={14} />
              <span class="name">{row.label}</span>
            {:else}
              <TextResult {row} />
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  </div>
  {#if rows.length === 0}
    <div class="empty">{emptyText}</div>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 880;
  }

  .popup {
    position: fixed;
    top: 12vh;
    left: 50%;
    transform: translateX(-50%);
    z-index: 885;
    width: min(720px, calc(100vw - 32px));
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 12px 0 6px;
    border-bottom: 1px solid var(--border-strong);
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .status {
    margin-left: auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status.error {
    color: var(--danger);
  }

  .capped {
    color: var(--warning);
    white-space: nowrap;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px 0 12px;
    height: 40px;
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

  .chevron {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-left: -6px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .chevron:hover {
    background: var(--hover);
    color: var(--text);
  }

  .field.replace {
    height: 36px;
  }

  /* Lines the Replace text up with the query text (the search icon's place). */
  .replace-indent {
    flex: none;
    width: 15px;
    margin-left: 24px;
  }

  .row-replace {
    flex: none;
    height: 20px;
    padding: 0 7px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--accent);
    font-size: 11.5px;
    cursor: pointer;
    visibility: hidden;
  }

  .row.heading:hover .row-replace:not(:disabled) {
    visibility: visible;
  }

  .row-replace:hover {
    background: var(--hover);
  }

  .list {
    max-height: min(468px, 60vh);
    overflow-y: auto;
    padding: 2px 4px 4px;
  }

  .canvas {
    position: relative;
  }

  .row,
  .section {
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

  .row.heading {
    cursor: default;
    gap: 6px;
  }

  .row.selected {
    background: var(--selected);
  }

  .row.more {
    color: var(--text-dim);
  }

  .section {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .name {
    flex: none;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    color: var(--text);
  }

  .more .name {
    color: var(--text-dim);
  }

  .folder {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    text-align: right;
    font-size: 12px;
    color: var(--text-faint);
  }

  .name b,
  .folder b {
    font-weight: 600;
    color: var(--accent);
  }

  .empty {
    padding: 14px 12px 16px;
    color: var(--text-faint);
    text-align: center;
  }
</style>
