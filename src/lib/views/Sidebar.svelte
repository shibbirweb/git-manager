<script lang="ts">
  import { tick } from "svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import {
    checkoutLocalBranch,
    checkoutRemoteBranch,
    checkoutTag,
    deleteLocalBranch,
    localBranchMenu,
    localSectionMenu,
    remoteBranchMenu,
    stashMenu,
    tagMenu,
  } from "./sidebar/actions";
  import { collapse } from "./sidebar/collapse.svelte";
  import RowContent from "./sidebar/RowContent.svelte";
  import { buildRows, isCollapsible, type SidebarRow } from "./sidebar/tree";
  import { worktreeMenu, worktreeSectionMenu } from "./git/worktrees/worktreeActions";
  import { worktreeStore } from "./git/worktrees/worktreeStore.svelte";

  const ROW_ID_PREFIX = "sidebar-row-";

  let filter = $state("");
  let selectedKey = $state<string | null>(null);
  let treeEl = $state<HTMLDivElement | null>(null);

  const filtering = $derived(filter.trim().length > 0);
  const rows = $derived(
    buildRows({
      refs: repoStore.refs,
      stashes: repoStore.stashes,
      worktrees: worktreeStore.repoRoot !== null && worktreeStore.repoRoot === repoStore.repo?.root ? worktreeStore.list : undefined,
      filter,
      isExpanded: (key) => collapse.isExpanded(key, filtering),
    }),
  );

  // Worktrees are read again whenever the active repository's branches are (refs is replaced on every refresh).
  $effect(() => {
    void repoStore.refs;
    void worktreeStore.load(repoStore.repo?.root ?? null);
  });
  const selectedIndex = $derived(rows.findIndex((row) => row.key === selectedKey));
  const hasMatches = $derived(!filtering || rows.length > 0);

  function rowId(index: number): string {
    return `${ROW_ID_PREFIX}${index}`;
  }

  function indent(row: SidebarRow): number {
    const leafOffset = isCollapsible(row) ? 0 : 14;
    return 6 + row.depth * 12 + leafOffset;
  }

  function toggle(row: SidebarRow): void {
    if (isCollapsible(row)) {
      collapse.toggle(row.key, filtering);
    }
  }

  function setExpanded(row: SidebarRow, expanded: boolean): void {
    if (isCollapsible(row)) {
      collapse.setExpanded(row.key, filtering, expanded);
    }
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

  function activate(row: SidebarRow | null): void {
    if (!row || repoStore.busy !== null) {
      return;
    }
    if (row.kind === "local") {
      if (!row.branch.isHead) {
        checkoutLocalBranch(row.branch.name);
      }
    } else if (row.kind === "remote") {
      checkoutRemoteBranch(row.branch);
    } else if (row.kind === "tag") {
      void checkoutTag(row.tagName);
    }
  }

  function menuFor(row: SidebarRow): MenuItem[] {
    switch (row.kind) {
      case "section":
        if (row.section === "worktrees") {
          return worktreeSectionMenu();
        }
        return row.section === "local" ? localSectionMenu() : [];
      case "local":
        return localBranchMenu(row.branch);
      case "remote":
        return remoteBranchMenu(row.branch);
      case "tag":
        return tagMenu(row.tagName);
      case "stash":
        return stashMenu(row.stash);
      case "worktree":
        return worktreeMenu(row.worktree);
      default:
        return [];
    }
  }

  function openMenu(event: MouseEvent, row: SidebarRow): void {
    const items = menuFor(row);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    contextMenu.open(event, items);
  }

  function onRowClick(row: SidebarRow): void {
    selectedKey = row.key;
    treeEl?.focus({ preventScroll: true });
    toggle(row);
  }

  function onRowContextMenu(event: MouseEvent, row: SidebarRow): void {
    selectedKey = row.key;
    treeEl?.focus({ preventScroll: true });
    openMenu(event, row);
  }

  function openMenuFromKeyboard(index: number): void {
    const row = rows[index] ?? null;
    const element = document.getElementById(rowId(index));
    if (!row || !element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const event = new MouseEvent("contextmenu", { clientX: rect.left + 24, clientY: rect.bottom });
    openMenu(event, row);
  }

  function onRowKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    onTreeKeydown(event);
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
        if (isCollapsible(row) && !row.expanded) {
          setExpanded(row, true);
        } else if (isCollapsible(row)) {
          void selectIndex(index + 1);
        }
        break;
      case "ArrowLeft":
        if (isCollapsible(row) && row.expanded) {
          setExpanded(row, false);
        } else if (row?.parentKey) {
          const parentIndex = rows.findIndex((candidate) => candidate.key === row.parentKey);
          void selectIndex(parentIndex);
        }
        break;
      case "Enter":
      case " ":
        if (isCollapsible(row)) {
          toggle(row);
        } else if (event.key === "Enter") {
          activate(row);
        }
        break;
      case "Delete":
      case "Backspace":
        if (row?.kind === "local" && !row.branch.isHead && repoStore.busy === null) {
          void deleteLocalBranch(row.branch.name);
        }
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

  function onFilterInput(): void {
    collapse.resetFilterState();
  }

  function onFilterKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && filter) {
      event.preventDefault();
      filter = "";
      collapse.resetFilterState();
    } else if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      const firstLeaf = rows.findIndex((row) => row.kind !== "section" && row.kind !== "group" && row.kind !== "empty");
      treeEl?.focus();
      void selectIndex(firstLeaf >= 0 ? firstLeaf : 0);
    }
  }
</script>

<div class="sidebar-view">
  <div class="filter">
    <span class="filter-icon"><Icon name="search" size={13} /></span>
    <input
      class="input filter-input"
      type="text"
      placeholder="Filter branches and tags"
      spellcheck="false"
      autocomplete="off"
      bind:value={filter}
      oninput={onFilterInput}
      onkeydown={onFilterKeydown}
    />
    {#if filter}
      <button
        class="icon-btn clear"
        title="Clear filter"
        onclick={() => {
          filter = "";
          collapse.resetFilterState();
        }}
      >
        <Icon name="x" size={12} />
      </button>
    {/if}
  </div>

  <div
    bind:this={treeEl}
    class="tree"
    role="tree"
    tabindex="0"
    aria-label="Branches, tags and stashes"
    aria-activedescendant={selectedIndex >= 0 ? rowId(selectedIndex) : undefined}
    onkeydown={onTreeKeydown}
  >
    {#each rows as row, index (row.key)}
      <div
        id={rowId(index)}
        class="sidebar-row"
        class:selected={index === selectedIndex}
        class:section={row.kind === "section"}
        role="treeitem"
        tabindex="-1"
        aria-level={row.depth + 1}
        aria-selected={index === selectedIndex}
        aria-expanded={isCollapsible(row) ? row.expanded : undefined}
        style="padding-left: {indent(row)}px"
        onclick={() => onRowClick(row)}
        ondblclick={() => activate(row)}
        oncontextmenu={(event) => onRowContextMenu(event, row)}
        onkeydown={onRowKeydown}
      >
        <RowContent {row} />
      </div>
    {/each}
    {#if !hasMatches}
      <div class="no-matches dim">No matching branches, tags or stashes</div>
    {/if}
  </div>
</div>

<style>
  .sidebar-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .filter {
    position: relative;
    display: flex;
    align-items: center;
    flex: none;
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }

  .filter-icon {
    position: absolute;
    left: 16px;
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
    right: 11px;
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

  .sidebar-row {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding-right: 6px;
    white-space: nowrap;
    outline: none;
  }

  .sidebar-row.section {
    margin-top: 4px;
  }

  .sidebar-row:hover {
    background: var(--hover);
  }

  .sidebar-row.selected {
    background: var(--selected-inactive);
  }

  .tree:focus .sidebar-row.selected,
  .tree:focus-within .sidebar-row.selected {
    background: var(--selected);
  }

  .no-matches {
    padding: 12px 16px;
    font-size: 12px;
  }
</style>
