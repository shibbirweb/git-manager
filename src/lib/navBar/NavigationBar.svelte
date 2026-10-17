<!-- The Navigation Bar: the path as crumbs (library Breadcrumbs). Clicking a crumb, or Jump to Navigation Bar, opens
     a list of what that folder holds (CrumbPopup): typing filters it, Right or Enter goes into a folder, Left goes up,
     Enter opens a file. It lives in the file bar and on the welcome screen; Workspace.svelte floats it over the editor
     when no placed bar answers the jump. The logic is in navBarModel.ts, navBarView.ts and navListing.svelte.ts. -->
<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { currentPlatform } from "$lib/commands/commandRuntime";
  import { fileIcons } from "$lib/fileIcons/fileIcons.svelte";
  import { fileSearch } from "$lib/search/fileSearchStore.svelte";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import Breadcrumbs from "@nibtree/ui/components/Breadcrumbs.svelte";
  import CrumbPopup from "@nibtree/ui/components/CrumbPopup.svelte";
  import { workspaceChanges } from "$lib/views/files/explorerLook";
  import {
    crumbsFor,
    enterItem,
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
  import { NavListing } from "./navListing.svelte";
  import { floatingAnchor, navEntries, navMessage, SEARCH_ENTRY_ID, shownCrumbs } from "./navBarView";

  interface Props {
    /** The file (or, with `targetIsDir`, the folder) the crumbs lead to. */
    targetPath: string | null;
    targetIsDir?: boolean;
    /** Shown over the editor area by Jump to Navigation Bar, closed with its popup. */
    floating?: boolean;
    /** This bar answers the jump: the one of the tab on screen in the focused group, or of the welcome screen. */
    claimed?: boolean;
  }

  let { targetPath, targetIsDir = false, floating = false, claimed = false }: Props = $props();

  const mac = currentPlatform() === "macos";
  const owner = Symbol("navigation bar");

  let bar = $state<HTMLElement | null>(null);
  let breadcrumbs = $state<ReturnType<typeof Breadcrumbs> | null>(null);
  let popup = $state<ReturnType<typeof CrumbPopup> | null>(null);
  /** The crumb the open list belongs to. */
  let anchor = $state<HTMLElement | null>(null);
  /** Crumbs reached by moving through the popups; null shows the path of `targetPath`. */
  let trail = $state.raw<NavCrumb[] | null>(null);
  /** The crumb whose popup shows; null while the bar is idle. */
  let popupIndex = $state<number | null>(null);
  const listing = new NavListing((items) => {
    const selectPath = pendingSelection;
    pendingSelection = null;
    selected = query.trim() === "" ? rowIndexOf(navRows(items, ""), selectPath) : 0;
  });
  let query = $state("");
  let selected = $state(0);
  /** Where the floating bar sits: the top left of the focused editor group. */
  let floatAt = $state<{ top: number; left: number; maxWidth: number } | null>(null);
  /** The path to select once the listing arrives. */
  let pendingSelection: string | null = null;
  let handledJump = untrack(() => navBarStore.jumpToken);

  const folders = $derived(repoStore.workspace?.folders ?? []);
  const repoRoots = $derived(new Set(repoStore.repos.map((repo) => repo.root)));
  const base = $derived(crumbsFor(folders, repoStore.workspace?.name ?? "", targetPath, repoRoots, targetIsDir));
  const crumbs = $derived(trail ?? base);
  const rows = $derived(navRows(listing.items, query));
  const active = $derived(popupIndex !== null);

  /** Git status colors, as in the Files panel; worked out only while a list shows. */
  const tones = $derived(active ? workspaceChanges(repoStore.repos, repoStore.statuses) : null);

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
      floatAt = floatingAnchor();
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
    listing.clear();
    popupIndex = null;
    trail = null;
    query = "";
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
    anchor = breadcrumbs?.crumbElement(index) ?? bar;
    await listing.load(crumbList[listedIndex(crumbList, index)], folders, repoRoots);
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

  /** Right goes into a folder, Left up a level, Esc clears the filter first; the list moves and picks. */
  function onkeydown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
    const used = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (event.key === "ArrowRight" && plain) {
      used();
      const row = rows[selected];
      if (row?.item.isDir) {
        goInto(row.item);
      }
    } else if (event.key === "ArrowLeft" && plain) {
      used();
      goLeft();
    } else if (event.key === "Escape" && query !== "") {
      used();
      query = "";
    }
  }

  const iconOf = (fileName: string) => fileIcons.resolve?.(fileName) ?? null;
  const entries = $derived(
    navEntries(rows, query, !listing.loading && !listing.loadError, (path) => tones?.tone(path), iconOf),
  );
  const message = $derived(navMessage(listing.loading, listing.loadError, query, rows.length));

  function pick(entry: { id: string }, event: KeyboardEvent | MouseEvent): void {
    if (entry.id === SEARCH_ENTRY_ID) {
      searchEverywhere();
    } else {
      choose(
        rows.find((row) => row.item.path === entry.id),
        mac ? event.metaKey : event.ctrlKey,
      );
    }
  }
</script>

<Breadcrumbs
  bind:this={breadcrumbs}
  bind:element={bar}
  label="Navigation bar"
  crumbs={shownCrumbs(crumbs, iconOf)}
  open={popupIndex}
  variant={floating ? (floatAt ? "anchored" : "floating") : "inline"}
  at={floatAt}
  title={floating ? undefined : (targetPath ?? undefined)}
  onselect={(index) => onCrumbClick(index)}
/>

{#if popupIndex !== null}
  <CrumbPopup
    bind:this={popup}
    label="Navigation bar: {crumbs[listedIndex(crumbs, popupIndex)]?.name ?? ''}"
    placeholder="Type to search"
    {entries}
    bind:query
    bind:selected
    {message}
    error={listing.loadError !== null}
    note={listing.truncated ? "Only the first 5000 entries are shown" : ""}
    {anchor}
    onpick={pick}
    {onkeydown}
    onclose={() => exit()}
  />
{/if}
