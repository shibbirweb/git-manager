<!--
  Tab bar of one editor group: the first group's strip starts with the Diff tab, then every
  file, commit and terminal tab open in that group, pinned tabs first. Tabs reorder by drag
  and, with Settings > Editor > Wrap tabs, wrap onto more rows instead of scrolling.
-->
<script lang="ts">
  import { flip } from "svelte/animate";
  import { localHistory } from "$lib/localHistory/localHistory.svelte";
  import { errorMessage } from "$lib/api";
  import { parseCommitTabPath } from "$lib/stores/commitTabs";
  import { gitTabTitle, parseGitTabPath } from "$lib/stores/gitTabs";
  import { branchTabTitle, parseBranchTabPath } from "$lib/stores/branchTabs";
  import { isPseudoTab } from "$lib/stores/pseudoTabs";
  import { compareStore, compareTabTooltip } from "$lib/compare/compareStore.svelte";
  import { isCompareTab } from "$lib/compare/compareTabs";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { moveTab, otherPaths, pathsToRight, tabLabels, unpinnedPaths } from "$lib/stores/tabs";
  import { shellNameFor } from "$lib/terminal/terminals";
  import { terminalStore } from "$lib/terminal/terminalStore.svelte";
  import { parseTerminalTabPath } from "$lib/terminal/terminalTabs";
  import { folderFor, relativeTo } from "$lib/stores/workspacePaths";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { changesSelection } from "./changes/selection.svelte";
  import { pastDragThreshold } from "./files/dragDrop";
  import { dropGap, edgeScrollStep, type TabBox } from "./tabDrag";
  import { moveEditorTab, splitEditorRight } from "./workspaceActions";

  let { groupId }: { groupId: number } = $props();

  let stripEl = $state<HTMLDivElement | null>(null);

  const group = $derived(repoStore.groupById(groupId));
  const tabs = $derived(group?.tabs ?? []);
  /** The first group: it has the Diff tab. */
  const primary = $derived(repoStore.primaryGroupId === groupId);
  const split = $derived(repoStore.groups.length > 1);
  /** With two groups, the strip of the unfocused one is dimmed. */
  const focused = $derived(!split || repoStore.focusedGroupId === groupId);
  const diffShown = $derived(primary && changesSelection.primaryView === "diff");
  const labels = $derived(tabLabels(tabs));
  const wrap = $derived(settings.wrapTabs);

  /** A press on a tab that may become a drag once the pointer moves a few pixels. */
  interface TabPress {
    tabPath: string;
    pointerId: number;
    startX: number;
    startY: number;
  }

  /** A tab drag: boxes and grab offset are in the strip's content coordinates (see tabDrag.ts). */
  interface TabDrag {
    tabPath: string;
    boxes: TabBox[];
    grabX: number;
    grabY: number;
    clientX: number;
    clientY: number;
    gap: number;
  }

  let press: TabPress | null = null;
  let drag = $state.raw<TabDrag | null>(null);
  let scrollFrame = 0;
  /** Set when a drag ends, so the click the browser sends after the pointerup is ignored. */
  let swallowClick = false;
  /** While dragging, the strip shows the order the drop would make. */
  const shownTabs = $derived(drag ? moveTab({ tabs, active: group?.active ?? null }, drag.tabPath, drag.gap).tabs : tabs);
  const diffName = $derived(changesSelection.selected?.path.split("/").pop() ?? "Diff");
  const diffTitle = $derived(
    changesSelection.selected
      ? `Diff: ${changesSelection.selected.path} (${changesSelection.selected.area === "staged" ? "staged" : "working tree"})`
      : "",
  );

  // Keep the active tab scrolled into view.
  $effect(() => {
    const active = group?.active ?? null;
    void diffShown;
    if (!stripEl || !active) {
      return;
    }
    const element = stripEl.querySelector<HTMLElement>(`[data-path="${CSS.escape(active)}"]`);
    element?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  function activate(filePath: string): void {
    repoStore.activateTab(groupId, filePath);
  }

  function onAuxClick(event: MouseEvent, filePath: string): void {
    // Middle click closes, like browsers and editors.
    if (event.button === 1) {
      event.preventDefault();
      void repoStore.closeTab(filePath, groupId);
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

  /** A commit tab's tooltip: the hash, the subject and the repository. */
  function commitTitle(tabPath: string): string {
    const ref = parseCommitTabPath(tabPath);
    if (!ref) {
      return tabPath;
    }
    const summary = repoStore.commitTabs[tabPath]?.summary;
    const repoName = ref.repoRoot.slice(ref.repoRoot.lastIndexOf("/") + 1);
    return `Commit ${ref.commitId.slice(0, 8)}${summary ? `: ${summary}` : ""} (${repoName})`;
  }

  /** A terminal tab's tooltip: its name, shell and folder. */
  function terminalTitle(terminalKey: number): string {
    const entry = terminalStore.find(terminalKey);
    if (!entry) {
      return "Terminal";
    }
    return [entry.name, `Shell: ${shellNameFor(entry.shellId, terminalStore.shells)}`, `Folder: ${entry.cwd ?? "~"}`].join("\n");
  }

  /** The items after the Close ones: what to copy, or what to do with a terminal. */
  function tabItems(filePath: string): MenuItem[] {
    const terminalKey = parseTerminalTabPath(filePath);
    if (terminalKey !== null) {
      return terminalStore.tabMenuItems(terminalKey);
    }
    const commit = parseCommitTabPath(filePath);
    if (commit) {
      return [{ label: "Copy Commit Hash", action: () => void copy(commit.commitId) }];
    }
    if (parseBranchTabPath(filePath) || isCompareTab(filePath)) {
      return [];
    }
    const gitTab = parseGitTabPath(filePath);
    if (gitTab) {
      return gitTab.kind === "reflog" ? [] : [{ label: "Copy Relative Path", action: () => void copy(gitTab.filePath) }];
    }
    return [
      { label: "Show Local History", action: () => localHistory.openFile(filePath) },
      { separator: true },
      { label: "Copy Path", action: () => void copy(filePath) },
      {
        label: "Copy Relative Path",
        action: () => {
          const folder = folderFor(repoStore.workspace?.folders ?? [], filePath);
          void copy(folder ? relativeTo(folder.root, filePath) : filePath);
        },
      },
      ...compareStore.fileTabItems(filePath),
    ];
  }

  /** Split Right, the move to the other group and Close Group, while the split editor setting is on. */
  function groupItems(filePath: string): MenuItem[] {
    if (!settings.splitEditor) {
      return [];
    }
    const items: MenuItem[] = [];
    if (primary && !isPseudoTab(filePath)) {
      items.push({
        label: "Split Right",
        action: () => {
          repoStore.activateTab(groupId, filePath);
          splitEditorRight(filePath);
        },
      });
    }
    items.push({ label: primary ? "Move to Right Group" : "Move to Left Group", action: () => moveEditorTab(filePath, groupId) });
    if (split) {
      items.push({ label: "Close Group", action: () => void repoStore.closeGroup(groupId) });
    }
    return [...items, { separator: true }];
  }

  function openMenu(event: MouseEvent, filePath: string, preview: boolean): void {
    const pinned = repoStore.isPinned(filePath);
    const state = { tabs, active: group?.active ?? null };
    // Close Others, Close to the Right and Close All leave pinned tabs open.
    contextMenu.open(event, [
      ...(preview ? [{ label: "Keep Open", action: () => repoStore.pinFile(filePath, groupId) }] : []),
      { label: pinned ? "Unpin Tab" : "Pin Tab", action: () => repoStore.setTabPinned(filePath, !pinned) },
      { separator: true },
      { label: "Close", action: () => void repoStore.closeTab(filePath, groupId) },
      {
        label: "Close Others",
        disabled: otherPaths(state, filePath).length === 0,
        action: () => void repoStore.closeOtherTabs(filePath, groupId),
      },
      {
        label: "Close to the Right",
        disabled: pathsToRight(state, filePath).length === 0,
        action: () => void repoStore.closeTabsToRight(filePath, groupId),
      },
      { label: "Close All", disabled: unpinnedPaths(tabs).length === 0, action: () => void repoStore.closeAllTabs(groupId) },
      { separator: true },
      ...groupItems(filePath),
      ...tabItems(filePath),
    ]);
  }

  /** Vertical wheel scrolls the strip sideways (wrapped tabs never scroll). */
  function onWheel(event: WheelEvent): void {
    if (stripEl && !wrap && Math.abs(event.deltaY) > Math.abs(event.deltaX) && !event.ctrlKey && !event.metaKey) {
      stripEl.scrollLeft += event.deltaY;
    }
  }

  // Dragging tabs, JetBrains style: the other tabs slide aside and the dragged one follows the
  // pointer. Pointer events, so it works however the window handles native drags; the window
  // listeners live only while a press or a drag does.

  function onTabPointerDown(event: PointerEvent, tabPath: string): void {
    if (event.button !== 0 || drag || (event.target as HTMLElement).closest(".tab-close")) {
      return;
    }
    press = { tabPath, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", cancelDrag);
    window.addEventListener("keydown", onDragKey, true);
  }

  /** The pointer in the strip's content coordinates. */
  function contentPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = stripEl?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0) + (stripEl?.scrollLeft ?? 0),
      y: clientY - (rect?.top ?? 0) + (stripEl?.scrollTop ?? 0),
    };
  }

  function startDrag(current: TabPress): TabDrag | null {
    if (!stripEl) {
      return null;
    }
    const elements = Array.from(stripEl.querySelectorAll<HTMLElement>(".tab[data-path]"));
    const index = elements.findIndex((element) => element.dataset.path === current.tabPath);
    if (index < 0 || elements.length < 2) {
      return null;
    }
    const boxes = elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const topLeft = contentPoint(rect.left, rect.top);
      return { left: topLeft.x, right: topLeft.x + rect.width, top: topLeft.y, bottom: topLeft.y + rect.height };
    });
    const start = contentPoint(current.startX, current.startY);
    return {
      tabPath: current.tabPath,
      boxes,
      grabX: start.x - boxes[index].left,
      grabY: start.y - boxes[index].top,
      clientX: current.startX,
      clientY: current.startY,
      gap: index,
    };
  }

  function updateDrag(clientX: number, clientY: number): void {
    if (!drag) {
      return;
    }
    const point = contentPoint(clientX, clientY);
    const gap = dropGap(drag.boxes, point.x, point.y, wrap);
    drag = { ...drag, clientX, clientY, gap };
  }

  function onPointerMove(event: PointerEvent): void {
    if (!press || event.pointerId !== press.pointerId) {
      return;
    }
    if (!drag) {
      if (!pastDragThreshold({ x: press.startX, y: press.startY }, { x: event.clientX, y: event.clientY })) {
        return;
      }
      drag = startDrag(press);
      if (!drag) {
        endPress();
        return;
      }
      scrollFrame = requestAnimationFrame(edgeScroll);
    }
    updateDrag(event.clientX, event.clientY);
  }

  /** Near the strip's ends, a single row of tabs scrolls while dragging. */
  function edgeScroll(): void {
    if (!drag || !stripEl) {
      return;
    }
    if (!wrap) {
      const rect = stripEl.getBoundingClientRect();
      const step = edgeScrollStep(drag.clientX, rect.left, rect.right);
      if (step !== 0) {
        stripEl.scrollLeft += step;
        updateDrag(drag.clientX, drag.clientY);
      }
    }
    scrollFrame = requestAnimationFrame(edgeScroll);
  }

  function onPointerUp(event: PointerEvent): void {
    if (!press || event.pointerId !== press.pointerId) {
      return;
    }
    const finished = drag;
    endPress();
    if (finished) {
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 0);
      repoStore.moveTab(groupId, finished.tabPath, finished.gap);
      // The dragged tab comes to the front, as a press on it does in JetBrains IDEs.
      repoStore.activateTab(groupId, finished.tabPath);
    }
  }

  function cancelDrag(): void {
    endPress();
  }

  function onDragKey(event: KeyboardEvent): void {
    if (event.key === "Escape" && drag) {
      event.preventDefault();
      event.stopPropagation();
      endPress();
    }
  }

  function endPress(): void {
    press = null;
    drag = null;
    cancelAnimationFrame(scrollFrame);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", cancelDrag);
    window.removeEventListener("keydown", onDragKey, true);
  }

  function onClickCapture(event: MouseEvent): void {
    if (swallowClick) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // The dragged tab follows the pointer from wherever the new order put it (offsetLeft and
  // offsetTop ignore the translate). In one row it only moves sideways, inside the strip.
  $effect(() => {
    const current = drag;
    if (!current || !stripEl) {
      return;
    }
    const element = stripEl.querySelector<HTMLElement>(`.tab[data-path="${CSS.escape(current.tabPath)}"]`);
    if (!element) {
      return;
    }
    const point = contentPoint(current.clientX, current.clientY);
    let left = point.x - current.grabX;
    if (!wrap) {
      left = Math.max(0, Math.min(left, stripEl.scrollWidth - element.offsetWidth));
    }
    const top = wrap ? point.y - current.grabY - element.offsetTop : 0;
    element.style.translate = `${left - element.offsetLeft}px ${top}px`;
    return () => {
      element.style.translate = "";
    };
  });

  $effect(() => endPress);
</script>

<div
  class="tab-strip"
  class:unfocused={!focused}
  class:wrap
  class:dragging={drag !== null}
  bind:this={stripEl}
  onwheel={onWheel}
  onclickcapture={onClickCapture}
  role="tablist"
  aria-label={split ? (primary ? "Open editors, left group" : "Open editors, right group") : "Open editors"}
>
  {#if primary && changesSelection.selected}
    <div class="tab diff" class:active={diffShown} title={diffTitle} role="presentation">
      <button class="tab-main" role="tab" aria-selected={diffShown} onclick={() => (repoStore.view = "diff")}>
        <Icon name="git-compare" size={13} />
        <span class="name">{diffName}</span>
        <span class="hint">Diff</span>
      </button>
      <button class="tab-close" onclick={() => changesSelection.close()} aria-label="Close diff" title="Close">
        <Icon name="x" size={12} />
      </button>
    </div>
  {/if}
  {#each shownTabs as tab (tab.path)}
    {@const label = labels.get(tab.path)}
    {@const active = changesSelection.tabShown(groupId, tab.path)}
    {@const commit = parseCommitTabPath(tab.path) !== null}
    {@const gitTab = parseGitTabPath(tab.path)}
    {@const branchTab = parseBranchTabPath(tab.path)}
    {@const terminalKey = parseTerminalTabPath(tab.path)}
    {@const terminal = terminalKey !== null ? terminalStore.find(terminalKey) : null}
    <div
      class="tab"
      class:active
      class:preview={tab.preview}
      class:dirty={tab.dirty}
      class:pinned={tab.pinned}
      class:lifted={drag?.tabPath === tab.path}
      data-path={tab.path}
      animate:flip={{ duration: drag?.tabPath === tab.path ? 0 : 120 }}
      title={terminalKey !== null
        ? terminalTitle(terminalKey)
        : commit
          ? commitTitle(tab.path)
          : gitTab
            ? gitTabTitle(gitTab).title
            : branchTab
              ? branchTabTitle(branchTab).title
              : (compareTabTooltip(tab.path) ?? `${tab.path}${tab.preview ? " (preview: double-click to keep open)" : ""}`)}
      role="presentation"
      onpointerdown={(event) => onTabPointerDown(event, tab.path)}
      onauxclick={(event) => onAuxClick(event, tab.path)}
      oncontextmenu={(event) => openMenu(event, tab.path, tab.preview)}
    >
      <button
        class="tab-main"
        role="tab"
        aria-selected={active}
        onclick={() => activate(tab.path)}
        ondblclick={() => repoStore.pinFile(tab.path, groupId)}
      >
        <Icon
          name={terminalKey !== null
            ? "terminal"
            : commit
              ? "commit"
              : gitTab
                ? gitTab.kind === "compare"
                  ? "git-compare"
                  : gitTab.kind === "reflog"
                    ? "undo"
                    : "history"
                : branchTab || isCompareTab(tab.path)
                  ? "git-compare"
                  : "file"}
          size={13}
        />
        <span class="name" class:mono={commit}>{terminal?.name ?? label?.name ?? tab.path}</span>
        {#if label?.hint}
          <span class="hint">{label.hint}</span>
        {/if}
      </button>
      {#if tab.pinned}
        <!-- A pinned tab's button unpins it, as in JetBrains IDEs; it still closes with a middle click or Close. -->
        <button
          class="tab-close"
          onclick={() => repoStore.setTabPinned(tab.path, false)}
          aria-label={tab.dirty ? "Unpin (unsaved changes)" : "Unpin"}
          title={tab.dirty ? "Pinned, unsaved changes. Unpin" : "Pinned. Unpin"}
        >
          <span class="dot"></span>
          <span class="x"><Icon name="pin" size={12} /></span>
        </button>
      {:else}
        <button
          class="tab-close"
          onclick={() => void repoStore.closeTab(tab.path, groupId)}
          aria-label={tab.dirty ? "Close (unsaved changes)" : "Close"}
          title={tab.dirty ? "Unsaved changes. Close" : "Close"}
        >
          <span class="dot"></span>
          <span class="x"><Icon name="x" size={12} /></span>
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .tab-strip {
    flex: none;
    position: relative;
    display: flex;
    align-items: stretch;
    height: 34px;
    overflow-x: auto;
    overflow-y: hidden;
    background: var(--panel-alt);
    border-bottom: 1px solid var(--border-strong);
    scrollbar-width: none;
    user-select: none;
  }

  /* Wrap tabs: more rows instead of a sideways scroll; each row has its own bottom line. */
  .tab-strip.wrap {
    flex-wrap: wrap;
    height: auto;
    min-height: 34px;
    overflow: hidden;
  }

  .tab-strip.wrap .tab {
    height: 34px;
    max-width: min(240px, 100%);
    margin-bottom: -1px;
    border-bottom: 1px solid var(--border-strong);
  }

  .tab-strip.dragging,
  .tab-strip.dragging .tab-main {
    cursor: grabbing;
  }

  /* The tab being dragged floats above the others while they slide aside. */
  .tab.lifted {
    z-index: 2;
    background: var(--editor-bg);
    box-shadow: var(--shadow);
  }

  .tab-strip::-webkit-scrollbar {
    display: none;
  }

  .tab {
    flex: none;
    position: relative;
    display: flex;
    align-items: center;
    max-width: 240px;
    padding-right: 4px;
    border-right: 1px solid var(--border-strong);
    color: var(--text-dim);
  }

  .tab:hover {
    background: var(--hover);
  }

  .tab.active {
    background: var(--editor-bg);
    color: var(--text);
  }

  /* Accent line on the active tab, like VS Code. */
  .tab.active::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 2px;
    background: var(--accent);
  }

  /* The group without the focus: its tab on screen keeps the editor color but no accent. */
  .tab-strip.unfocused .tab.active::before {
    background: var(--border-strong);
  }

  .tab-strip.unfocused .tab.active {
    color: var(--text-dim);
  }

  .tab-main {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    height: 100%;
    padding: 0 6px 0 12px;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .tab-main :global(svg) {
    flex: none;
    opacity: 0.8;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab.preview .name {
    font-style: italic;
  }

  .hint {
    flex: none;
    font-size: 11.5px;
    color: var(--text-faint);
  }

  .tab.diff .hint {
    font-style: normal;
  }

  .tab-close {
    flex: none;
    display: flex;
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

  .tab-close:hover {
    background: var(--border-strong);
    color: var(--text);
  }

  /* Close button: hidden until hover or active; a dot while there are unsaved edits. */
  .tab .tab-close .x,
  .tab.diff .tab-close {
    opacity: 0;
  }

  .tab:hover .tab-close .x,
  .tab.active .tab-close .x,
  .tab.pinned .tab-close .x,
  .tab.diff:hover .tab-close,
  .tab.diff.active .tab-close {
    opacity: 1;
  }

  .x {
    display: flex;
  }

  .dot {
    display: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-dim);
  }

  .tab.dirty .dot {
    display: block;
  }

  .tab.dirty .tab-close .x {
    display: none;
  }

  .tab.dirty .tab-close:hover .dot {
    display: none;
  }

  .tab.dirty .tab-close:hover .x {
    display: flex;
    opacity: 1;
  }

  /* Rounded panels: rounded tabs on the editor color, the active one tinted and outlined, like JetBrains Islands. */
  :global(html[data-rounded-panels]) .tab-strip {
    align-items: center;
    gap: 2px;
    padding: 0 6px;
    background: var(--editor-bg);
    border-bottom-color: var(--border);
  }

  :global(html[data-rounded-panels]) .tab-strip.wrap {
    padding: 4px 6px;
    row-gap: 4px;
  }

  :global(html[data-rounded-panels]) .tab-strip .tab {
    height: 26px;
    margin-bottom: 0;
    border: 1px solid transparent;
    border-radius: 6px;
  }

  :global(html[data-rounded-panels]) .tab-strip .tab.active {
    background: var(--selected);
    border-color: color-mix(in srgb, var(--accent) 50%, var(--editor-bg));
  }

  :global(html[data-rounded-panels]) .tab.active::before {
    display: none;
  }

  :global(html[data-rounded-panels]) .tab-strip.unfocused .tab.active {
    background: var(--selected-inactive);
    border-color: var(--border-strong);
  }

  :global(html[data-rounded-panels]) .tab-main {
    padding-left: 10px;
  }
</style>
