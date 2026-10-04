<!--
  The Navigation Bar, like JetBrains': the path as crumbs. Clicking a crumb, or Jump to
  Navigation Bar (Cmd+Up on macOS, Alt+Home elsewhere), opens a popup of what that folder
  holds. Typing filters it, Up and Down pick, Right or Enter goes into a folder, Left goes
  up, Enter opens a file. Inside FileView it is the path bar; Workspace.svelte shows it
  floating when no file is on screen. The logic is in navBarModel.ts.
-->
<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { currentPlatform } from "$lib/commands/commandRuntime";
  import FileTypeIcon from "$lib/fileIcons/FileTypeIcon.svelte";
  import { fileSearch } from "$lib/search/fileSearchStore.svelte";
  import { moveSelection } from "$lib/search/fileSearchModel";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { folderFor, relativeTo } from "$lib/stores/workspacePaths";
  import Icon from "$lib/ui/Icon.svelte";
  import { portal } from "$lib/ui/portal";
  import { repoTones, type RepoTones, workspaceTones } from "$lib/views/files/tones";
  import {
    crumbsFor,
    enterItem,
    folderItems,
    itemsOf,
    listedIndex,
    type NavCrumb,
    type NavItem,
    type NavRow,
    navRows,
    previousPopup,
    rowIndexOf,
    selectedPathFor,
    startIndex,
  } from "./navBarModel";
  import { navBarStore } from "./navBarStore.svelte";

  interface Props {
    /** The file (or, with `targetIsDir`, the folder) the crumbs lead to. */
    targetPath: string | null;
    targetIsDir?: boolean;
    /** Shown over the editor area by Jump to Navigation Bar, closed with its popup. */
    floating?: boolean;
    /** This is the path bar of the tab on screen in the focused group: it answers the jump. */
    claimed?: boolean;
  }

  let { targetPath, targetIsDir = false, floating = false, claimed = false }: Props = $props();

  /** Rows moved by Page Up / Page Down. */
  const PAGE = 10;
  const POPUP_WIDTH = 340;
  const mac = currentPlatform() === "macos";
  const owner = Symbol("navigation bar");
  const listId = `nav-bar-list-${Math.random().toString(36).slice(2)}`;

  let bar = $state<HTMLElement | null>(null);
  let popup = $state<HTMLDivElement | null>(null);
  let input = $state<HTMLInputElement | null>(null);
  let list = $state<HTMLDivElement | null>(null);
  /** Crumbs reached by moving through the popups; null shows the path of `targetPath`. */
  let trail = $state.raw<NavCrumb[] | null>(null);
  /** The crumb whose popup shows; null while the bar is idle. */
  let popupIndex = $state<number | null>(null);
  let items = $state.raw<NavItem[]>([]);
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let truncated = $state(false);
  let query = $state("");
  let selected = $state(0);
  let position = $state({ top: 0, left: 0, maxHeight: 400 });
  let requestId = 0;
  /** The path to select once the listing arrives. */
  let pendingSelection: string | null = null;
  let handledJump = untrack(() => navBarStore.jumpToken);

  const folders = $derived(repoStore.workspace?.folders ?? []);
  const repoRoots = $derived(new Set(repoStore.repos.map((repo) => repo.root)));
  const base = $derived(crumbsFor(folders, repoStore.workspace?.name ?? "", targetPath, repoRoots, targetIsDir));
  const crumbs = $derived(trail ?? base);
  const rows = $derived(navRows(items, query));
  const active = $derived(popupIndex !== null);

  /** Git status colors, as in the Files panel. */
  const tones = $derived.by(() => {
    if (!active) {
      return null;
    }
    const perRepo: RepoTones[] = [];
    for (const repo of repoStore.repos) {
      const status = repoStore.statuses[repo.root];
      if (status) {
        perRepo.push(repoTones(status, repo.root));
      }
    }
    return workspaceTones(perRepo);
  });

  // The path bar of the tab on screen answers Jump to Navigation Bar.
  $effect(() => {
    if (claimed) {
      return navBarStore.claim(owner);
    }
  });

  $effect(() => {
    const token = navBarStore.jumpToken;
    if (token !== handledJump && navBarStore.active === owner) {
      handledJump = token;
      untrack(() => void openAt(startIndex(base)));
    }
  });

  // Another bar took the keyboard, or the bar was closed from outside (the MCP close_dialog tool).
  $effect(() => {
    if (navBarStore.active !== owner && popupIndex !== null) {
      untrack(reset);
    }
  });

  onMount(() => {
    if (floating) {
      navBarStore.enter(owner);
      void openAt(startIndex(base));
    }
    return () => {
      if (navBarStore.active === owner) {
        navBarStore.close(false);
      }
    };
  });

  // A click outside the bar and its popup leaves the bar; the click does what it does.
  $effect(() => {
    if (!active) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && (bar?.contains(target) || popup?.contains(target))) {
        return;
      }
      exit(false);
    };
    window.addEventListener("mousedown", onPointer, true);
    return () => window.removeEventListener("mousedown", onPointer, true);
  });

  // Keep the selected row visible.
  $effect(() => {
    const index = selected;
    untrack(() => {
      list?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
    });
  });

  // A new query starts on the best match.
  $effect(() => {
    void query;
    untrack(() => {
      if (pendingSelection === null) {
        selected = 0;
      }
    });
  });

  function reset(): void {
    requestId += 1;
    popupIndex = null;
    trail = null;
    items = [];
    query = "";
    loadError = null;
    loading = false;
  }

  /** Closes the popup and gives the bar up; `restore` puts the focus back where it was. */
  function exit(restore = true): void {
    reset();
    if (navBarStore.active === owner || floating) {
      navBarStore.close(restore);
    }
  }

  /** Opens the popup of crumb `index`, selecting `selectPath` (the next crumb by default). */
  async function openAt(index: number, selectPath: string | null = selectedPathFor(crumbs, index)): Promise<void> {
    const crumbList = crumbs;
    if (!crumbList[index]) {
      return;
    }
    navBarStore.enter(owner);
    if (trail === null) {
      trail = crumbList;
    }
    popupIndex = index;
    query = "";
    pendingSelection = selectPath;
    await tick();
    place(index);
    input?.focus();
    await load(crumbList, listedIndex(crumbList, index));
  }

  async function load(crumbList: NavCrumb[], index: number): Promise<void> {
    const crumb = crumbList[index];
    const request = ++requestId;
    loadError = null;
    truncated = false;
    if (!crumb) {
      items = [];
      return;
    }
    if (crumb.kind === "workspace") {
      showItems(folderItems(folders, repoRoots));
      return;
    }
    const folder = folderFor(folders, crumb.path);
    if (!folder) {
      items = [];
      loadError = "This folder is not in the workspace.";
      return;
    }
    loading = true;
    try {
      const [listing] = await api.listDirectories(folder.root, [relativeTo(folder.root, crumb.path)], [...repoRoots]);
      if (request !== requestId) {
        return;
      }
      if (!listing || listing.error) {
        items = [];
        loadError = listing?.error ?? "Could not read this folder.";
      } else {
        truncated = listing.truncated;
        showItems(itemsOf(crumb.path, listing.entries ?? []));
      }
    } catch (error) {
      if (request === requestId) {
        items = [];
        loadError = errorMessage(error);
      }
    } finally {
      if (request === requestId) {
        loading = false;
      }
    }
  }

  function showItems(next: NavItem[]): void {
    items = next;
    const selectPath = pendingSelection;
    pendingSelection = null;
    selected = query.trim() === "" ? rowIndexOf(navRows(next, ""), selectPath) : 0;
  }

  /** Puts the popup under crumb `index`, inside the window. */
  function place(index: number): void {
    const crumb = bar?.querySelector<HTMLElement>(`[data-crumb="${index}"]`);
    const rect = (crumb ?? bar)?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const width = Math.min(POPUP_WIDTH, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left - 4, window.innerWidth - width - 8));
    const top = rect.bottom + 3;
    position = { top, left, maxHeight: Math.max(120, Math.min(440, window.innerHeight - top - 12)) };
  }

  /** Right or Enter on a folder: it becomes the last crumb and its popup opens. */
  function goInto(item: NavItem): void {
    if (popupIndex === null) {
      return;
    }
    const next = enterItem(crumbs, popupIndex, item);
    trail = next;
    void openAt(next.length - 1, null);
  }

  async function openFile(item: NavItem, toSide: boolean): Promise<void> {
    exit(false);
    await navigation.openFileAt(item.path, null, null, { pin: true, toSide });
  }

  function choose(row: NavRow | undefined, toSide = false): void {
    if (!row) {
      return;
    }
    if (row.item.isDir) {
      goInto(row.item);
    } else {
      void openFile(row.item, toSide);
    }
  }

  /** No match here: look for the name in the whole workspace (Search Everywhere, Files). */
  function searchEverywhere(): void {
    const text = query.trim();
    exit(false);
    fileSearch.open("files", text);
  }

  function goLeft(): void {
    if (popupIndex === null) {
      return;
    }
    const previous = previousPopup(crumbs, popupIndex);
    if (previous !== popupIndex) {
      void openAt(previous);
    }
  }

  function onCrumbClick(index: number): void {
    if (popupIndex === index) {
      exit();
      return;
    }
    void openAt(index);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }
    const ctrlOnly = event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
    let step = 0;
    if ((plain && event.key === "ArrowDown") || (ctrlOnly && event.key === "n")) {
      step = 1;
    } else if ((plain && event.key === "ArrowUp") || (ctrlOnly && event.key === "p")) {
      step = -1;
    } else if (plain && event.key === "PageDown") {
      step = PAGE;
    } else if (plain && event.key === "PageUp") {
      step = -PAGE;
    }
    if (step !== 0) {
      event.preventDefault();
      event.stopPropagation();
      selected = moveSelection(selected, rows.length, step);
      return;
    }
    let handled = true;
    if (event.key === "Home" && plain && query === "") {
      selected = 0;
    } else if (event.key === "End" && plain && query === "") {
      selected = Math.max(0, rows.length - 1);
    } else if (event.key === "ArrowRight" && plain) {
      const row = rows[selected];
      if (row?.item.isDir) {
        goInto(row.item);
      }
    } else if (event.key === "ArrowLeft" && plain) {
      goLeft();
    } else if (event.key === "Enter") {
      if (rows.length === 0 && query.trim() !== "") {
        searchEverywhere();
      } else {
        choose(rows[selected], mac ? event.metaKey : event.ctrlKey);
      }
    } else if (event.key === "Escape") {
      if (query !== "") {
        query = "";
      } else {
        exit();
      }
    } else if (event.key === "Tab") {
      // Keeps the focus in the field.
    } else {
      handled = false;
    }
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /** Shrink weight of a crumb `distance` crumbs before the last: the farthest give up their width first. */
  function crumbShrink(index: number): number {
    const distance = crumbs.length - 1 - index;
    return distance === 0 ? 1 : 10 ** Math.min(distance, 6);
  }

  function crumbIcon(crumb: NavCrumb): "folder-git" | "folder" | "app-window" | null {
    if (crumb.kind === "workspace") {
      return "app-window";
    }
    if (crumb.kind === "file") {
      return null;
    }
    return crumb.isRepo ? "folder-git" : crumb.kind === "folder" ? "folder" : null;
  }
</script>

<nav class="nav-bar" class:floating class:active bind:this={bar} aria-label="Navigation bar" title={floating ? null : targetPath}>
  {#each crumbs as crumb, index (crumb.path)}
    {@const icon = crumbIcon(crumb)}
    {#if index > 0}
      <span class="sep" aria-hidden="true"><Icon name="chevron-right" size={11} /></span>
    {/if}
    <button
      class="crumb {crumb.kind}"
      class:repo={crumb.isRepo}
      class:has-icon={icon !== null || crumb.kind === "file"}
      class:open={popupIndex === index}
      type="button"
      tabindex="-1"
      data-crumb={index}
      style:flex-shrink={crumbShrink(index)}
      aria-haspopup="listbox"
      aria-expanded={popupIndex === index}
      onmousedown={(event) => event.preventDefault()}
      onclick={() => onCrumbClick(index)}
    >
      {#if crumb.kind === "file"}
        <FileTypeIcon fileName={crumb.name} size={12} />
      {:else if icon}
        <Icon name={icon} size={12} />
      {/if}
      <span class="crumb-name">{crumb.name}</span>
    </button>
  {/each}
</nav>

{#if popupIndex !== null}
  <div
    class="nav-popup"
    role="dialog"
    aria-label="Navigation bar: {crumbs[listedIndex(crumbs, popupIndex)]?.name ?? ''}"
    bind:this={popup}
    use:portal
    style:top="{position.top}px"
    style:left="{position.left}px"
    style:width="{Math.min(POPUP_WIDTH, window.innerWidth - 16)}px"
  >
    <div class="field" class:empty={query === ""}>
      <Icon name="search" size={12} />
      <input
        bind:this={input}
        bind:value={query}
        type="text"
        placeholder="Type to search"
        spellcheck="false"
        autocomplete="off"
        role="combobox"
        aria-label="Filter"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={rows[selected] ? `${listId}-${selected}` : undefined}
        onkeydown={onKeydown}
      />
    </div>
    <div class="list" role="listbox" id={listId} aria-label="Contents" bind:this={list} style:max-height="{position.maxHeight - 34}px">
      {#each rows as row, index (row.item.path)}
        {@const tone = row.item.isDir ? "" : (tones?.tone(row.item.path) ?? "")}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="row {tone}"
          class:selected={index === selected}
          class:ignored={row.item.ignored}
          id="{listId}-{index}"
          role="option"
          tabindex="-1"
          aria-selected={index === selected}
          data-index={index}
          title={row.item.path}
          onmousemove={() => (selected = index)}
          onmousedown={(event) => event.preventDefault()}
          onclick={(event) => choose(row, mac ? event.metaKey : event.ctrlKey)}
        >
          <span class="icon">
            {#if row.item.isDir}
              <Icon name={row.item.isRepo ? "folder-git" : "folder"} size={14} />
            {:else}
              <FileTypeIcon fileName={row.item.name} />
            {/if}
          </span>
          <span class="name"
            >{#each row.nameParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}</span
          >
          {#if row.item.isDir}
            <span class="more" aria-hidden="true"><Icon name="chevron-right" size={11} /></span>
          {/if}
        </div>
      {:else}
        {#if loading}
          <div class="message">Loading...</div>
        {:else if loadError}
          <div class="message error">{loadError}</div>
        {:else if query.trim() !== ""}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="row selected search"
            role="option"
            tabindex="-1"
            aria-selected="true"
            onmousedown={(event) => event.preventDefault()}
            onclick={searchEverywhere}
          >
            <span class="icon"><Icon name="search" size={13} /></span>
            <span class="name">Search everywhere for "{query.trim()}"</span>
          </div>
        {:else}
          <div class="message">Empty folder</div>
        {/if}
      {/each}
      {#if truncated}
        <div class="message">Only the first 5000 entries are shown</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Overflow goes off the left edge, so the file name is the last thing to disappear. */
  .nav-bar {
    flex: 0 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1px;
    overflow: hidden;
    white-space: nowrap;
  }

  .nav-bar.floating {
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 885;
    max-width: calc(100vw - 32px);
    height: 30px;
    padding: 0 6px;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    box-shadow: var(--shadow);
    color: var(--text-dim);
    font-size: 12px;
  }

  .sep {
    flex: none;
    display: inline-flex;
    color: var(--text-faint);
  }

  .crumb {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    /* flex-shrink comes from the markup; a folder keeps room for an ellipsis. */
    flex-grow: 0;
    flex-basis: auto;
    min-width: 1.4em;
    height: 22px;
    padding: 0 3px;
    overflow: hidden;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    font: inherit;
    cursor: pointer;
  }

  .crumb:hover {
    background: var(--hover);
    color: var(--text);
  }

  .crumb.open {
    background: var(--selected);
    color: var(--text);
  }

  .crumb.has-icon {
    min-width: calc(16px + 1.4em);
  }

  .crumb :global(svg),
  .crumb :global(.file-type-icon),
  .crumb :global(.file-type-image) {
    flex: none;
  }

  .crumb-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .crumb.repo {
    color: var(--accent);
  }

  .crumb.file {
    color: var(--text);
    font-weight: 600;
  }

  .nav-popup {
    position: fixed;
    z-index: 890;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    box-shadow: var(--shadow);
    overflow: hidden;
    font-size: 12.5px;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 8px;
    color: var(--text-faint);
    border-bottom: 1px solid var(--border-strong);
  }

  .field input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
  }

  .field input::placeholder {
    color: var(--text-faint);
  }

  .list {
    overflow-y: auto;
    padding: 3px;
  }

  .row,
  .message {
    height: 24px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px;
    border-radius: 4px;
    color: var(--text);
  }

  .row {
    cursor: pointer;
  }

  .row.selected {
    background: var(--selected);
  }

  .message {
    color: var(--text-faint);
  }

  .message.error {
    color: var(--danger);
  }

  .icon {
    flex: none;
    display: inline-flex;
    width: 16px;
    justify-content: center;
    color: var(--text-dim);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
  }

  .row.modified .name {
    color: var(--accent);
  }

  .row.added .name {
    color: var(--success);
  }

  .row.conflict .name,
  .row.deleted .name {
    color: var(--danger);
  }

  .row.ignored .name,
  .row.ignored .icon {
    color: var(--text-faint);
  }

  .row.search .name {
    color: var(--text-dim);
  }

  .more {
    flex: none;
    display: inline-flex;
    color: var(--text-faint);
  }

  b {
    font-weight: 600;
    color: var(--accent);
  }
</style>
