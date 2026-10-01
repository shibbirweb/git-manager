<!-- Tab bar above the editor area: the Diff tab plus every open file. -->
<script lang="ts">
  import { errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { tabLabels } from "$lib/stores/tabs";
  import { folderFor, relativeTo } from "$lib/stores/workspacePaths";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { changesSelection } from "./changes/selection.svelte";

  let stripEl = $state<HTMLDivElement | null>(null);

  const shownView = $derived(changesSelection.shownView);
  const labels = $derived(tabLabels(repoStore.tabs));
  const diffName = $derived(changesSelection.selected?.path.split("/").pop() ?? "Diff");
  const diffTitle = $derived(
    changesSelection.selected
      ? `Diff: ${changesSelection.selected.path} (${changesSelection.selected.area === "staged" ? "staged" : "working tree"})`
      : "",
  );

  // Keep the active tab scrolled into view.
  $effect(() => {
    const active = repoStore.openFilePath;
    void shownView;
    if (!stripEl || !active) {
      return;
    }
    const element = stripEl.querySelector<HTMLElement>(`[data-path="${CSS.escape(active)}"]`);
    element?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  function activate(filePath: string): void {
    void repoStore.openFile(filePath);
  }

  function onAuxClick(event: MouseEvent, filePath: string): void {
    // Middle click closes, like browsers and editors.
    if (event.button === 1) {
      event.preventDefault();
      void repoStore.closeTab(filePath);
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

  function openMenu(event: MouseEvent, filePath: string, preview: boolean): void {
    const index = repoStore.tabs.findIndex((tab) => tab.path === filePath);
    contextMenu.open(event, [
      ...(preview ? [{ label: "Keep Open", action: () => repoStore.pinFile(filePath) }, { separator: true as const }] : []),
      { label: "Close", action: () => void repoStore.closeTab(filePath) },
      { label: "Close Others", disabled: repoStore.tabs.length < 2, action: () => void repoStore.closeOtherTabs(filePath) },
      {
        label: "Close to the Right",
        disabled: index < 0 || index === repoStore.tabs.length - 1,
        action: () => void repoStore.closeTabsToRight(filePath),
      },
      { label: "Close All", action: () => void repoStore.closeAllTabs() },
      { separator: true },
      { label: "Copy Path", action: () => void copy(filePath) },
      {
        label: "Copy Relative Path",
        action: () => {
          const folder = folderFor(repoStore.workspace?.folders ?? [], filePath);
          void copy(folder ? relativeTo(folder.root, filePath) : filePath);
        },
      },
    ]);
  }

  /** Vertical wheel scrolls the strip sideways. */
  function onWheel(event: WheelEvent): void {
    if (stripEl && Math.abs(event.deltaY) > Math.abs(event.deltaX) && !event.ctrlKey && !event.metaKey) {
      stripEl.scrollLeft += event.deltaY;
    }
  }
</script>

<div class="tab-strip" bind:this={stripEl} onwheel={onWheel} role="tablist" aria-label="Open editors">
  {#if changesSelection.selected}
    <div class="tab diff" class:active={shownView === "diff"} title={diffTitle} role="presentation">
      <button class="tab-main" role="tab" aria-selected={shownView === "diff"} onclick={() => (repoStore.view = "diff")}>
        <Icon name="git-compare" size={13} />
        <span class="name">{diffName}</span>
        <span class="hint">Diff</span>
      </button>
      <button class="tab-close" onclick={() => changesSelection.close()} aria-label="Close diff" title="Close">
        <Icon name="x" size={12} />
      </button>
    </div>
  {/if}
  {#each repoStore.tabs as tab (tab.path)}
    {@const label = labels.get(tab.path)}
    {@const active = shownView === "file" && repoStore.openFilePath === tab.path}
    <div
      class="tab"
      class:active
      class:preview={tab.preview}
      class:dirty={tab.dirty}
      data-path={tab.path}
      title="{tab.path}{tab.preview ? ' (preview: double-click to keep open)' : ''}"
      role="presentation"
      onauxclick={(event) => onAuxClick(event, tab.path)}
      oncontextmenu={(event) => openMenu(event, tab.path, tab.preview)}
    >
      <button
        class="tab-main"
        role="tab"
        aria-selected={active}
        onclick={() => activate(tab.path)}
        ondblclick={() => repoStore.pinFile(tab.path)}
      >
        <Icon name="file" size={13} />
        <span class="name">{label?.name ?? tab.path}</span>
        {#if label?.hint}
          <span class="hint">{label.hint}</span>
        {/if}
      </button>
      <button
        class="tab-close"
        onclick={() => void repoStore.closeTab(tab.path)}
        aria-label={tab.dirty ? "Close (unsaved changes)" : "Close"}
        title={tab.dirty ? "Unsaved changes. Close" : "Close"}
      >
        <span class="dot"></span>
        <span class="x"><Icon name="x" size={12} /></span>
      </button>
    </div>
  {/each}
</div>

<style>
  .tab-strip {
    flex: none;
    display: flex;
    align-items: stretch;
    height: 34px;
    overflow-x: auto;
    overflow-y: hidden;
    background: var(--panel-alt);
    border-bottom: 1px solid var(--border-strong);
    scrollbar-width: none;
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

  .tab.diff .tab-close {
    opacity: 0;
  }

  .tab:hover .tab-close .x,
  .tab.active .tab-close .x,
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
</style>
