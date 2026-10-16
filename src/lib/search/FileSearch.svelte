<!--
  Search Everywhere popup: All, Classes, Files, Symbols and Text tabs.
  Opened by double Shift (All), Cmd+O (Classes), Cmd+P or Shift+Cmd+O (Files),
  Option+Cmd+O (Symbols), Shift+Cmd+F (Text, Find in Files) and Shift+Cmd+R (Text with
  its Replace field, Replace in Files). The UI library's CommandPalette draws it with a virtual List;
  searchQueries.svelte.ts asks the backend and searchReplace.svelte.ts replaces.
-->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import CommandPalette from "@git-manager/ui/components/CommandPalette.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import Input from "@git-manager/ui/components/Input.svelte";
  import Tag from "@git-manager/ui/components/Tag.svelte";
  import { onMount, tick, untrack } from "svelte";
  import { windowKeys, withCommandKeys } from "$lib/commands/commandRuntime";
  import { recentFilesStore } from "$lib/recentFiles/recentFilesStore.svelte";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { TextSearchOptions } from "$lib/types";
  import SearchToggles from "$lib/ui/SearchToggles.svelte";
  import { fileSearch } from "./fileSearchStore.svelte";
  import { pathRows, recentFiles, splitLocation } from "./fileSearchModel";
  import { type PopupRow, tabRows } from "./popupRows";
  import { SearchQueries } from "./searchQueries.svelte";
  import SearchResults from "./SearchResults.svelte";
  import { SearchReplace } from "./searchReplace.svelte";
  import SearchTabs from "./SearchTabs.svelte";
  import { isReplaceKey, stepTab, tabForKey, type SearchTab } from "./searchTabs";
  import { searchCapped, searchEmptyText, searchPlaceholder, searchStatus, statusIsError } from "./searchTexts";
  import { DEFAULT_TEXT_OPTIONS, searchable } from "./textSearchModel";

  const folders = $derived(repoStore.workspace?.folders ?? []);
  let field = $state<HTMLInputElement | null>(null);
  let replaceInput = $state<HTMLInputElement | null>(null);
  let tab = $state<SearchTab>(untrack(() => fileSearch.initialTab));
  let query = $state(untrack(() => fileSearch.initialQuery));
  let textOptions = $state<TextSearchOptions>({ ...DEFAULT_TEXT_OPTIONS });
  /** Replace in Files: the Text tab's Replace field shows. */
  let replaceOpen = $state(untrack(() => fileSearch.initialReplace));
  let replacement = $state("");
  /** The highlighted row; null after a new query or tab, so the first row is highlighted. */
  let selected = $state<string | null>(null);
  /** Focus goes back here when the popup closes without opening anything. */
  let previousFocus: HTMLElement | null = null;

  const search = new SearchQueries(
    () => folders,
    () => ({ tab, query, textOptions }),
    untrack(() => fileSearch.initialQuery),
  );
  const replace = new SearchReplace(
    () => search.closed,
    () => {
      search.runText();
      void tick().then(() => replaceInput?.focus());
    },
    () => void tick().then(() => replaceInput?.focus()),
  );

  const hasQuery = $derived(splitLocation(search.shownQuery).text !== "");
  const rows = $derived(tabRows(tab, { hasQuery, recent: search.recent, ...sources(), text: search.text }));
  /** Everything the status, the capped note and the empty text read. */
  const shown = $derived({
    tab,
    query,
    hasQuery,
    ...sources(),
    text: search.text,
    textRunning: search.textRunning,
    replacing: replace.replacing,
    fileIndex: search.fileIndex,
    symbolIndex: search.symbolIndex,
    error: search.error,
  });
  const capped = $derived(searchCapped(shown));
  /** Text tab results can be replaced: a valid query with matches. */
  const canReplace = $derived(searchable(query) && search.text.error === null && search.text.rows.length > 0);

  function sources() {
    return { files: search.files, classes: search.classes, members: search.members, symbols: search.symbols };
  }

  onMount(() => {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    field?.select();
    const tabPaths = repoStore.tabs.map((openTab) => openTab.path);
    search.recent = pathRows(recentFiles(repoStore.openFilePath, recentFilesStore.filePaths(), tabPaths), folders);
    search.open();
    return () => {
      // Counting has no use any more; a write already started finishes and reports.
      if (replace.replacing === "counting") {
        replace.cancel();
      }
      search.close();
    };
  });

  // Typing runs the tab's queries from the first row again.
  let lastQuery = untrack(() => query);
  $effect(() => {
    if (query !== lastQuery) {
      lastQuery = query;
      untrack(() => {
        selected = null;
        void search.run();
      });
    }
  });

  function switchTab(next: SearchTab): void {
    if (next === tab) {
      return;
    }
    if (tab === "text") {
      search.stopText();
    }
    tab = next;
    selected = null;
    void search.run();
  }

  function toggleOption(option: keyof TextSearchOptions): void {
    textOptions = { ...textOptions, [option]: !textOptions[option] };
    selected = null;
    if (tab === "text") {
      search.runText();
    }
  }

  function toggleReplace(): void {
    replaceOpen = !replaceOpen;
    void tick().then(() => (replaceOpen ? replaceInput : field)?.focus());
  }

  function replaceIn(filePaths: string[] | null): void {
    if (canReplace || replace.replacing !== null) {
      const roots = folders.map((folder) => folder.root);
      void replace.run({ roots, query, options: textOptions, replacement }, filePaths);
    }
  }

  function close(): void {
    fileSearch.close(tab);
  }

  function cancel(): void {
    close();
    const focus = previousFocus;
    void tick().then(() => focus?.isConnected && focus.focus());
  }

  /** Enter or a click: Shift or Cmd opens a preview tab, otherwise the tab is kept. */
  function activate(row: PopupRow, event?: { shiftKey: boolean; metaKey: boolean }): void {
    const pin = !(event?.shiftKey || event?.metaKey);
    const at = (value: number | null) => (value !== null ? Math.max(0, value - 1) : null);
    if (row.kind === "more") {
      switchTab(row.tab);
    } else if (row.kind === "file") {
      // From the query as typed, even if its results are still on the way.
      const { line, column } = splitLocation(query);
      close();
      void navigation.openFileAt(row.file.path, at(line), at(column), { pin });
    } else if (row.kind === "symbol") {
      close();
      void navigation.openFileAt(row.symbol.path, at(row.symbol.line), at(row.symbol.column), { pin });
    } else if (row.kind === "textLine") {
      close();
      void navigation.openFileAt(row.path, at(row.line), at(row.column), { pin });
    }
  }

  /** The tabs' keys, Tab, Shift+Cmd+R and Option+C / W / X; the List moves and Enter picks. */
  function onkeydown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }
    const used = (run: () => void) => {
      event.preventDefault();
      event.stopPropagation();
      run();
    };
    const option = tab === "text" && event.altKey && !event.metaKey && !event.ctrlKey ? textOption(event.code) : null;
    const ctrlMove = event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "n" || event.key === "p");
    const tabShortcut = ctrlMove ? null : tabForKey(event, windowKeys());
    if (option) {
      used(() => toggleOption(option));
    } else if (isReplaceKey(event, windowKeys())) {
      used(() => {
        switchTab("text");
        replaceOpen = true;
        void tick().then(() => replaceInput?.focus());
      });
    } else if (tabShortcut) {
      used(() => switchTab(tabShortcut));
    } else if (event.key === "Tab") {
      used(() => switchTab(stepTab(tab, event.shiftKey ? -1 : 1)));
    } else if (event.key === "Escape" && event.target === replaceInput) {
      // The palette closes on Esc in its own field; the Replace field is the caller's.
      used(cancel);
    } else if (event.key === "Enter" || event.key === "Escape" || event.key.startsWith("Arrow")) {
      // The palette and the List take them; the window's own keys must not see them too.
      event.stopPropagation();
    }
  }

  function textOption(code: string): keyof TextSearchOptions | null {
    return code === "KeyC" ? "matchCase" : code === "KeyW" ? "wholeWords" : code === "KeyX" ? "regex" : null;
  }
</script>

{#snippet scopes()}
  <SearchTabs {tab} onSelect={switchTab} />
  {#if capped}<Tag size="small" title={capped}>Capped</Tag>{/if}
{/snippet}

{#snippet replaceToggle()}
  <IconButton
    icon={replaceOpen ? "chevron-down" : "chevron-right"}
    size="small"
    iconSize="normal"
    keepFocus
    label={replaceOpen ? "Hide Replace Field" : "Show Replace Field"}
    title={replaceOpen ? "Hide Replace Field" : withCommandKeys("Show Replace Field", "edit.replaceInFiles")}
    onclick={toggleReplace}
  />
{/snippet}

{#snippet toggles()}
  <SearchToggles options={textOptions} onToggle={toggleOption} />
{/snippet}

{#snippet replaceRow()}
  <Input
    bind:element={replaceInput}
    bind:value={replacement}
    placeholder="Replace with"
    aria-label="Replace with"
    width="fill"
    {onkeydown}
  />
  <Button
    size="small"
    variant={replace.replacing === null ? "danger" : "default"}
    keepFocus
    disabled={replace.replacing === null && !canReplace}
    title={replace.replacing !== null ? "Stop replacing" : "Replace every match in every file (asks first)"}
    onclick={() => replaceIn(null)}
  >
    {replace.replacing !== null ? "Stop" : "Replace All"}
  </Button>
{/snippet}

{#snippet results()}
  <SearchResults
    {rows}
    {field}
    bind:selected
    {replaceOpen}
    replaceDisabled={replace.replacing !== null || !canReplace}
    emptyText={searchEmptyText(shown)}
    onactivate={activate}
    onreplace={(filePath) => replaceIn([filePath])}
  />
{/snippet}

<CommandPalette
  label="Search Everywhere"
  size="wide"
  bind:query
  bind:field
  placeholder={searchPlaceholder(tab)}
  status={searchStatus(shown)}
  statusTone={statusIsError(shown) ? "warning" : "faint"}
  {scopes}
  fieldStart={tab === "text" ? replaceToggle : undefined}
  fieldEnd={tab === "text" ? toggles : undefined}
  replace={tab === "text" && replaceOpen ? replaceRow : undefined}
  {results}
  {onkeydown}
  onclose={cancel}
/>
