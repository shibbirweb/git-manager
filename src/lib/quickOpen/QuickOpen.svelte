<!--
  Quick Open: Cmd+P finds files (recently opened first), Shift+Cmd+P opens it on
  ">" for the Command Palette. ":" goes to a line, "@" to a symbol of the file, "#" to a
  symbol of the workspace and "?" lists the prefixes. Separate from Search Everywhere (double
  Shift, FileSearch.svelte); both use the Rust file and symbol indexes. Mounted only while open.
  The UI library's CommandPalette draws it; quickOpenSearch.svelte.ts asks the backend.
-->
<script lang="ts">
  import CommandPalette from "@nibtree/ui/components/CommandPalette.svelte";
  import type { PaletteItem as Item } from "@nibtree/ui/logic/palette";
  import { EditorView } from "@codemirror/view";
  import { onMount, untrack } from "svelte";
  import { currentCommandViews, currentPlatform, runCommand, shortcutFor } from "$lib/commands/commandRuntime";
  import { matchesAccelerator } from "$lib/commands/keybinding";
  import { type PaletteItem, paletteList } from "$lib/commands/registry";
  import { lineTargetPosition } from "$lib/editor/textCommands";
  import { currentMenuInputs } from "$lib/menu/appMenu.svelte";
  import { recentFilesStore } from "$lib/recentFiles/recentFilesStore.svelte";
  import { countLabel } from "$lib/search/countLabel";
  import { pathRows, recentFiles, type SearchRow, splitLocation } from "$lib/search/fileSearchModel";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { quickOpenItems } from "./quickOpenItems";
  import {
    type CaretInfo,
    commandRows,
    fileRows,
    helpRows,
    lineRow,
    matchingRecent,
    outlineRows,
    parsePickQuery,
    parseQuickOpen,
    PREFIXES,
    type QuickRow,
    recentOrder,
  } from "./quickOpenModel";
  import { QuickOpenSearch } from "./quickOpenSearch.svelte";
  import { quickOpen } from "./quickOpenStore.svelte";

  const platform = currentPlatform();
  const folders = $derived(repoStore.workspace?.folders ?? []);
  /** The editor the popup opened over: ":" and "@" act on it, and so do the editor commands. */
  const target = quickOpen.target;
  /** Compare with...: the popup picks a file instead of opening it. */
  const picker = quickOpen.picker;
  let value = $state(untrack(() => quickOpen.initialValue));
  const parsed = $derived(picker ? parsePickQuery(value) : parseQuickOpen(value));
  let palette = $state<ReturnType<typeof CommandPalette> | null>(null);

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
  const search = new QuickOpenSearch(
    () => folders,
    () => parsed,
  );

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

  const rows = $derived.by((): QuickRow[] => {
    const text = parsed.text;
    const outline = search.outline;
    switch (parsed.mode) {
      case "files": {
        if (folders.length === 0) {
          return message("Open a folder to search its files, or type > for commands");
        }
        const query = splitLocation(text).text;
        const shown = fileRows(matchingRecent(recent, query), query ? search.files : [], query !== "");
        if (shown.length > 0) {
          return shown;
        }
        if (!query) {
          return message("No recent files. Type to search files by name.");
        }
        return message(search.fileIndexing ? "Indexing..." : "No files match");
      }
      case "commands": {
        const list = paletteList(views, text, settings.recentCommands, platform);
        const shown = commandRows(list.recent, list.other);
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
        return shown.length > 0
          ? shown.map((item) => ({ kind: "outline", key: item.key, item }))
          : message("No symbols match");
      }
      case "workspaceSymbols": {
        if (folders.length === 0) {
          return message("Open a folder to search its symbols");
        }
        if (!text) {
          return message("Type a class, function or constant name");
        }
        if (search.symbols.length > 0) {
          return search.symbols.map((symbol) => ({ kind: "symbol", key: symbol.key, symbol }));
        }
        return message(search.symbolIndexing ? "Indexing symbols..." : "No symbols match");
      }
      case "help":
        return helpRows();
    }
  });
  const list = $derived(quickOpenItems(rows));

  const status = $derived.by(() => {
    if (search.error) {
      return search.error;
    }
    if (parsed.mode === "files" && search.fileIndexing) {
      return `Indexing ${countLabel(search.fileIndex?.indexed ?? 0, "file")}...`;
    }
    if (parsed.mode === "workspaceSymbols" && search.symbolIndexing) {
      return `Indexing symbols in ${countLabel(search.symbolIndex?.files ?? 0, "file")}...`;
    }
    return PREFIXES.find((entry) => entry.mode === parsed.mode)?.label ?? "";
  });

  onMount(() => () => {
    search.close();
    quickOpen.release();
  });

  // Each change of the text runs its mode's query; only the latest answer of each is shown.
  $effect(() => {
    const { mode, text } = parsed;
    untrack(() => search.run(mode, text, target ? { view: target.view, filePath: target.filePath } : null));
  });

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

  /** `toSide` (Cmd+Enter) opens it in the other editor group. */
  function openFile(filePath: string, line: number | null, column: number | null, toSide: boolean): void {
    quickOpen.close();
    if (picker) {
      picker.onPick(filePath);
      return;
    }
    const at = (value: number | null) => (value !== null ? Math.max(0, value - 1) : null);
    void navigation.openFileAt(filePath, at(line), at(column), { pin: true, toSide });
  }

  function runPaletteCommand(command: PaletteItem): void {
    // Go to File from the palette switches the popup to files.
    if (command.commandId === "edit.goToFile") {
      value = "";
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

  function pick(item: Item, event: KeyboardEvent | MouseEvent): void {
    const row = list.rows.get(item.id);
    // Cmd+Enter (Ctrl+Enter) opens a file to the side.
    const toSide = platform === "macos" ? event.metaKey : event.ctrlKey;
    switch (row?.kind) {
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
        value = row.prefix;
        break;
    }
  }

  /** Cmd+P and Shift+Cmd+P again switch to files or commands, or step down when already there; Tab stays. */
  function onkeydown(event: KeyboardEvent): void {
    const filesKey = shortcutFor("edit.goToFile");
    const commandsKey = shortcutFor("view.commandPalette");
    const files = filesKey !== null && matchesAccelerator(event, filesKey, platform);
    const commands = commandsKey !== null && matchesAccelerator(event, commandsKey, platform);
    if (files || commands) {
      event.preventDefault();
      event.stopPropagation();
      if (parsed.mode === (commands ? "commands" : "files")) {
        palette?.step(1);
      } else {
        value = commands ? ">" : "";
      }
    } else if (event.key === "Tab") {
      event.preventDefault();
    } else if (event.key === "Enter" || event.key === "Escape") {
      // The palette handles them; the window's own keys must not see them too.
      event.stopPropagation();
    }
  }
</script>

<CommandPalette
  bind:this={palette}
  label="Quick Open"
  bind:query={value}
  items={list.items}
  emptyText={list.empty}
  placeholder={picker?.placeholder ?? "Search files by name, or type ? for help"}
  fieldIcon={parsed.mode === "commands" ? "carets" : "search"}
  {status}
  statusTone={search.error ? "warning" : "faint"}
  onpick={pick}
  {onkeydown}
  onclose={cancel}
/>
