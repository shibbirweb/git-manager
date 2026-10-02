<script lang="ts">
  import { type Chunk, MergeView } from "@codemirror/merge";
  import type { Extension } from "@codemirror/state";
  import { EditorView, keymap, panels } from "@codemirror/view";
  import type { ChangeMark } from "$lib/editor/lineDiff";
  import { createStrip, jumpToLine, layoutTicks, renderTicks } from "$lib/editor/scrollMarkers";
  import { baseExtensions, languageFor } from "$lib/editor/setup";
  import type { FileDiff } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { chunkKinds, diffTheme, revertButton } from "./mergeExtensions";
  import { diffPrefs } from "./prefs.svelte";
  import { type BlameTarget, blameExtension, loadBlame, setBlameDisplay } from "$lib/editor/blame";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { clampDiffSplit, DEFAULT_DIFF_SPLIT, splitFromPointer } from "./split";
  import { lfsContentChanged, lfsSizeText } from "$lib/views/git/lfs/lfsModel";

  export type DiffMode = "unstaged" | "staged" | "readonly";

  interface Props {
    diff: FileDiff;
    /** Repo-relative path, used for language detection. */
    path: string;
    /**
     * unstaged: left = index, right = work tree; chunk control stages (right -> left).
     * staged: left = HEAD, right = index; chunk control unstages (left -> right).
     * readonly: no chunk controls (commit diffs).
     */
    mode: DiffMode;
    leftLabel: string;
    rightLabel: string;
    /** Called with the full new text of the side a chunk control changed. */
    onChange?: (target: "original" | "modified", content: string) => void;
    /** Blame the right side: which commit last touched each line. */
    blame?: BlameTarget | null;
    /** Scroll the right side to this 0-based line (Back / Forward); a new token repeats it. */
    revealLine?: { line: number; token: number } | null;
    /**
     * The file in the work tree (absolute path), for the Open File button. `sameLines` when the
     * right side is the work tree itself, so the file opens at the line you are on.
     */
    workingFile?: { filePath: string; sameLines: boolean } | null;
  }

  let { diff, path, mode, leftLabel, rightLabel, onChange, blame = null, revealLine = null, workingFile = null }: Props = $props();

  let revealedToken = -1;

  function applyReveal(merge: MergeView): boolean {
    if (!revealLine || revealLine.token === revealedToken) {
      return false;
    }
    revealedToken = revealLine.token;
    const doc = merge.b.state.doc;
    const position = doc.line(Math.max(1, Math.min(revealLine.line + 1, doc.lines))).from;
    merge.b.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: "center" }) });
    return true;
  }

  // A reveal for the diff that is already on screen.
  $effect(() => {
    void revealLine;
    if (view) {
      applyReveal(view);
    }
  });

  // Apply the blame preferences to the open diff as they change.
  $effect(() => {
    const display = { inline: settings.currentLineBlame, gutter: settings.blameGutter };
    if (view && blame) {
      setBlameDisplay(view.b, display);
    }
  });

  let host = $state<HTMLDivElement | null>(null);
  /** Where the line between the two sides is, for the drag handle; null until the diff is drawn. */
  let handleLeft = $state<number | null>(null);
  let splitDragging = $state(false);
  const split = $derived(clampDiffSplit(settings.diffSplitRatio));
  /**
   * Each side's find bar sits above the diff: both sides share one scroller, so a bar inside
   * an editor would scroll away and push its side out of line with the other.
   */
  let findHostA = $state<HTMLDivElement | null>(null);
  let findHostB = $state<HTMLDivElement | null>(null);
  let chunkCount = $state(0);
  let current = $state(-1);

  let view: MergeView | null = null;
  /** Change overview ruler beside the diff's scrollbar. */
  let strip: HTMLDivElement | null = null;
  let stripFrame = 0;
  let stripObserver: ResizeObserver | null = null;
  let buildToken = 0;
  /** Scroll position of the last view, restored when the same file is rebuilt. */
  let lastScroll: { key: string; top: number } | null = null;

  /** A Git LFS file: its sizes replace the pointer text. */
  const lfs = $derived(diff.lfs ?? null);
  const textual = $derived(!diff.binary && !diff.tooLarge && lfs === null);
  const identical = $derived(textual && diff.original === diff.modified);
  const fileName = $derived(path.split("/").pop() ?? path);

  /** The right side's line to open the file at: the cursor line when it is on screen, else the top line. */
  function lineOnScreen(merge: MergeView): number {
    const editor = merge.b;
    const head = editor.state.selection.main.head;
    if (editor.hasFocus || editor.visibleRanges.some((range) => head >= range.from && head <= range.to)) {
      return editor.state.doc.lineAt(head).number - 1;
    }
    const top = editor.lineBlockAtHeight(editor.scrollDOM.scrollTop);
    return editor.state.doc.lineAt(top.from).number - 1;
  }

  /** Opens the real file in an editor tab, at the same line when the right side is the work tree. */
  async function openWorkingFile(): Promise<void> {
    const target = workingFile;
    if (!target) {
      return;
    }
    if (!(await navigation.fileExists(target.filePath))) {
      toast.info(`${fileName} is not in the work tree`, "It was deleted or never existed there, so there is no file to open.");
      return;
    }
    const line = target.sameLines && view ? lineOnScreen(view) : null;
    await navigation.openFileAt(target.filePath, line, null, { pin: true });
  }
  const directory = $derived(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
  const counterLabel = $derived.by(() => {
    if (chunkCount === 0) {
      return "No changes";
    }
    if (current < 0) {
      return chunkCount === 1 ? "1 change" : `${chunkCount} changes`;
    }
    return `${current + 1} of ${chunkCount}`;
  });

  $effect(() => {
    const target = host;
    if (!target || !textual || identical) {
      return;
    }
    const token = ++buildToken;
    const collapse = diffPrefs.collapseUnchanged;
    const scrollKey = `${mode}:${collapse}:${path}`;
    void build(target, diff, path, mode, collapse, token, scrollKey);
    return () => {
      buildToken++;
      teardown(scrollKey);
    };
  });

  function teardown(scrollKey: string): void {
    if (!view) {
      return;
    }
    lastScroll = { key: scrollKey, top: view.dom.scrollTop };
    cancelAnimationFrame(stripFrame);
    stripObserver?.disconnect();
    stripObserver = null;
    strip?.remove();
    strip = null;
    view.destroy();
    view = null;
  }

  async function build(
    target: HTMLDivElement,
    fileDiff: FileDiff,
    filePath: string,
    diffMode: DiffMode,
    collapse: boolean,
    token: number,
    scrollKey: string,
  ): Promise<void> {
    const language = await languageFor(filePath);
    if (token !== buildToken) {
      return;
    }
    const changedSide = diffMode === "unstaged" ? "original" : "modified";
    const navigation = keymap.of([
      { key: "F7", run: () => goToChunk(1) },
      { key: "Shift-F7", run: () => goToChunk(-1) },
    ]);
    const listener = EditorView.updateListener.of((update) => {
      if (!update.docChanged || !update.transactions.some((transaction) => transaction.isUserEvent("revert"))) {
        return;
      }
      chunkCount = view?.chunks.length ?? 0;
      if (current >= chunkCount) {
        current = -1;
      }
      onChange?.(changedSide, update.state.doc.toString());
    });
    const geometry = EditorView.updateListener.of((update) => {
      if (update.docChanged || update.geometryChanged || update.heightChanged) {
        scheduleStrip();
      }
    });
    const sideExtensions = (changes: boolean, findHost: HTMLElement | null): Extension[] =>
      baseExtensions({
        readOnly: true,
        extensions: [
          language,
          diffTheme,
          chunkKinds,
          navigation,
          geometry,
          changes ? listener : [],
          findHost ? panels({ topContainer: findHost }) : [],
        ],
      });

    const merge = new MergeView({
      a: { doc: fileDiff.original, extensions: sideExtensions(diffMode === "unstaged", findHostA) },
      b: {
        doc: fileDiff.modified,
        extensions: [
          sideExtensions(diffMode === "staged", findHostB),
          blame ? blameExtension({ inline: settings.currentLineBlame, gutter: settings.blameGutter }) : [],
        ],
      },
      parent: target,
      gutter: true,
      highlightChanges: true,
      collapseUnchanged: collapse ? { margin: 3, minSize: 4 } : undefined,
      revertControls: diffMode === "unstaged" ? "b-to-a" : diffMode === "staged" ? "a-to-b" : undefined,
      renderRevertControl:
        diffMode === "unstaged"
          ? () => revertButton("Stage this change", "chevrons-left")
          : () => revertButton("Unstage this change", "chevrons-right"),
    });
    view = merge;
    if (blame) {
      void loadBlame(merge.b, blame, fileDiff.modifiedEol);
    }
    chunkCount = merge.chunks.length;
    current = -1;
    strip = createStrip((line) => jumpToLine(merge.b, line));
    target.appendChild(strip);
    stripObserver = new ResizeObserver(() => {
      scheduleStrip();
      placeSplitHandle();
    });
    stripObserver.observe(target);
    scheduleStrip();

    const restore = lastScroll?.key === scrollKey ? lastScroll.top : null;
    requestAnimationFrame(() => {
      if (view !== merge) {
        return;
      }
      placeSplitHandle();
      if (applyReveal(merge)) {
        return;
      }
      if (restore !== null) {
        merge.dom.scrollTop = restore;
      } else if (merge.chunks.length > 0) {
        current = 0;
        revealChunk(merge, merge.chunks[0]);
      }
    });
  }

  /** Change marks on the right side, in its line numbers. */
  function diffMarks(merge: MergeView): ChangeMark[] {
    const doc = merge.b.state.doc;
    return merge.chunks.map((chunk) => {
      const from = doc.lineAt(Math.min(chunk.fromB, doc.length)).number - 1;
      if (chunk.fromB === chunk.toB) {
        return { from, to: from, kind: "deleted" };
      }
      const last = doc.lineAt(Math.max(chunk.fromB, Math.min(chunk.toB - 1, doc.length))).number;
      return { from, to: last, kind: chunk.fromA === chunk.toA ? "added" : "modified" };
    });
  }

  // The editors change width with the split; keep the handle on the line between them.
  $effect(() => {
    void split;
    const frame = requestAnimationFrame(placeSplitHandle);
    return () => cancelAnimationFrame(frame);
  });

  function placeSplitHandle(): void {
    const first = host?.querySelector<HTMLElement>(".cm-mergeViewEditor");
    if (!host || !first) {
      handleLeft = null;
      return;
    }
    handleLeft = first.getBoundingClientRect().right - host.getBoundingClientRect().left;
  }

  function startSplitDrag(event: PointerEvent): void {
    const editors = host?.querySelector<HTMLElement>(".cm-mergeViewEditors");
    if (event.button !== 0 || !editors) {
      return;
    }
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    // The change arrows between the sides keep their width.
    const gutter = editors.querySelector<HTMLElement>(".cm-merge-revert")?.offsetWidth ?? 0;
    splitDragging = true;
    document.body.classList.add("resizing-columns");
    const move = (moveEvent: PointerEvent): void => {
      const rect = editors.getBoundingClientRect();
      settings.diffSplitRatio = splitFromPointer(moveEvent.clientX, rect.left, rect.width, gutter);
    };
    const stop = (): void => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      splitDragging = false;
      document.body.classList.remove("resizing-columns");
      settings.save();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function setSplit(ratio: number): void {
    settings.diffSplitRatio = clampDiffSplit(ratio);
    settings.save();
  }

  function onSplitKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      setSplit(split + (event.key === "ArrowRight" ? 0.02 : -0.02) * (event.shiftKey ? 3 : 1));
    }
  }

  function scheduleStrip(): void {
    cancelAnimationFrame(stripFrame);
    stripFrame = requestAnimationFrame(() => {
      if (view && strip) {
        renderTicks(strip, layoutTicks(view.b, diffMarks(view), strip.clientHeight));
      }
    });
  }

  function revealChunk(merge: MergeView, chunk: Chunk): void {
    const posA = Math.min(chunk.fromA, merge.a.state.doc.length);
    const posB = Math.min(chunk.fromB, merge.b.state.doc.length);
    merge.a.dispatch({ selection: { anchor: posA } });
    merge.b.dispatch({
      selection: { anchor: posB },
      effects: EditorView.scrollIntoView(posB, { y: "center" }),
    });
  }

  function goToChunk(direction: 1 | -1): boolean {
    const merge = view;
    if (!merge || merge.chunks.length === 0) {
      return false;
    }
    const count = merge.chunks.length;
    if (current < 0 || current >= count) {
      current = direction > 0 ? 0 : count - 1;
    } else {
      current = (current + direction + count) % count;
    }
    revealChunk(merge, merge.chunks[current]);
    return true;
  }
</script>

<div class="diff-view" style="--diff-left: {split}; --diff-right: {1 - split}">
  <div class="toolbar">
    <button
      class="icon-btn small"
      onclick={() => goToChunk(-1)}
      disabled={!textual || identical || chunkCount === 0}
      title="Previous change (Shift+F7)"
    >
      <Icon name="arrow-up" size={14} />
    </button>
    <button
      class="icon-btn small"
      onclick={() => goToChunk(1)}
      disabled={!textual || identical || chunkCount === 0}
      title="Next change (F7)"
    >
      <Icon name="arrow-down" size={14} />
    </button>
    {#if textual && !identical}
      <span class="counter dim">{counterLabel}</span>
    {/if}
    <div class="divider"></div>
    <button
      class="toggle"
      class:active={diffPrefs.collapseUnchanged}
      onclick={() => diffPrefs.toggleCollapse()}
      aria-pressed={diffPrefs.collapseUnchanged}
      disabled={!textual || identical}
      title="Collapse unchanged fragments"
    >
      <Icon name="list-tree" size={13} />
      Collapse unchanged
    </button>
    {#if blame && textual && !identical}
      <button
        class="toggle"
        class:active={settings.blameGutter}
        onclick={() => settings.setPreference("blameGutter", !settings.blameGutter)}
        aria-pressed={settings.blameGutter}
        title="Show who changed each line and when (git blame)"
      >
        <Icon name="history" size={13} />
        Blame
      </button>
    {/if}
    {#if workingFile}
      <button class="toggle" onclick={() => void openWorkingFile()} title="Open the file itself in an editor tab">
        <Icon name="external-link" size={13} />
        Open File
      </button>
    {/if}
    <span class="path truncate" title={path}>
      <span class="name">{fileName}</span>
      {#if directory}
        <span class="dim">{directory}</span>
      {/if}
    </span>
  </div>

  {#if !textual}
    {#if lfs}
      <div class="message lfs-message">
        <span class="lfs-title">Stored in Git LFS</span>
        <span class="dim">{lfsSizeText(lfs)}{lfsContentChanged(lfs) ? "" : ", same content"}</span>
      </div>
    {:else}
      <div class="message dim">{diff.tooLarge ? "File too large to diff" : "Binary file, no text diff"}</div>
    {/if}
  {:else if identical}
    <div class="message dim">No content changes</div>
  {:else}
    <div class="labels" class:with-controls={mode !== "readonly"}>
      <span class="label truncate" title={leftLabel}>{leftLabel}</span>
      <span class="gap"></span>
      <span class="label truncate" title={rightLabel}>{rightLabel}</span>
    </div>
    <div class="find-bars" class:with-controls={mode !== "readonly"}>
      <div class="find-host" bind:this={findHostA}></div>
      <span class="gap"></span>
      <div class="find-host" bind:this={findHostB}></div>
    </div>
    <div class="body" bind:this={host}>
      {#if handleLeft !== null}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <div
          class="split-handle"
          class:dragging={splitDragging}
          style="left: {handleLeft}px"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the two sides of the diff"
          aria-valuenow={Math.round(split * 100)}
          aria-valuemin={15}
          aria-valuemax={85}
          tabindex="0"
          title="Drag to resize the two sides, double-click to make them equal"
          onpointerdown={startSplitDrag}
          ondblclick={() => setSplit(DEFAULT_DIFF_SPLIT)}
          onkeydown={onSplitKeydown}
        ></div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .diff-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    height: 100%;
    background: var(--editor-bg);
  }

  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 34px;
    padding: 0 8px;
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel);
  }

  .icon-btn.small {
    height: 24px;
    min-width: 24px;
    padding: 0 4px;
  }

  .counter {
    margin-left: 6px;
    font-size: 12px;
    white-space: nowrap;
  }

  .divider {
    width: 1px;
    height: 16px;
    margin: 0 8px;
    background: var(--border-strong);
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 8px;
    border: none;
    border-radius: var(--radius);
    background: transparent;
    color: var(--text-dim);
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
  }

  .toggle:hover:not(:disabled) {
    background: var(--hover);
  }

  .toggle.active {
    background: var(--selected-inactive);
    color: var(--text);
  }

  .toggle:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .path {
    flex: 1;
    min-width: 0;
    margin-left: 12px;
    text-align: right;
    font-size: 12px;
  }

  .path .name {
    font-weight: 600;
    margin-right: 6px;
  }

  .labels {
    flex: none;
    display: flex;
    align-items: center;
    height: 24px;
    border-bottom: 1px solid var(--border);
    background: var(--panel-alt);
    color: var(--text-dim);
    font-size: 11.5px;
  }

  .label {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 12px;
  }

  /* The labels, find bars and editors share the split, so they stay lined up. */
  .label:first-child,
  .find-host:first-child,
  .body :global(.cm-mergeViewEditor:first-child) {
    flex-grow: var(--diff-left, 1);
  }

  .label:last-child,
  .find-host:last-child,
  .body :global(.cm-mergeViewEditor:last-child) {
    flex-grow: var(--diff-right, 1);
  }

  .split-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 7px;
    margin-left: -3px;
    z-index: 5;
    cursor: col-resize;
    outline: none;
  }

  .split-handle::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 2px;
    width: 3px;
    background: transparent;
    transition: background 0.12s;
  }

  .split-handle:hover::after,
  .split-handle:focus-visible::after,
  .split-handle.dragging::after {
    background: var(--accent);
  }

  .gap {
    flex: none;
    width: 1px;
    align-self: stretch;
    background: var(--border-strong);
  }

  .labels.with-controls .gap {
    width: 24px;
    background: transparent;
    border-left: 1px solid var(--border-strong);
    border-right: 1px solid var(--border-strong);
  }

  /* Shown only while a side's find bar is open. */
  .find-bars {
    flex: none;
    display: flex;
    background: var(--panel);
  }

  .find-bars:not(:has(.cm-panels)) {
    display: none;
  }

  .find-host {
    flex: 1 1 0;
    min-width: 0;
    border-bottom: 1px solid var(--border-strong);
  }

  .find-host:empty {
    border-bottom-color: transparent;
  }

  .find-host :global(.cm-find-bar) {
    border-bottom: none;
  }

  .find-bars .gap {
    border-bottom: 1px solid var(--border-strong);
  }

  .find-bars.with-controls .gap {
    width: 24px;
    background: transparent;
  }

  .body {
    flex: 1;
    min-height: 0;
    position: relative;
    /* Room for the change overview ruler. */
    padding-right: 12px;
  }

  .message {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
  }

  .body :global(.cm-mergeView) {
    position: absolute;
    inset: 0;
    overflow-y: auto;
  }

  .body :global(.cm-mergeViewEditor + .cm-mergeViewEditor) {
    border-left: 1px solid var(--border-strong);
  }

  .body :global(.cm-merge-revert) {
    width: 24px;
    background: var(--panel-alt);
    border-left: 1px solid var(--border-strong);
    border-right: 1px solid var(--border-strong);
  }

  .body :global(.cm-merge-revert .diff-revert) {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    padding: 0;
    border-radius: 4px;
    color: var(--accent);
  }

  .body :global(.cm-merge-revert .diff-revert:hover) {
    background: var(--hover);
    color: var(--accent-hover);
  }

  .body :global(.cm-merge-revert .diff-revert svg) {
    pointer-events: none;
  }

  .lfs-message {
    flex-direction: column;
    gap: 4px;
  }

  .lfs-title {
    font-weight: 600;
  }
</style>
