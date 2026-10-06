<script lang="ts">
  import { type Chunk, MergeView } from "@codemirror/merge";
  import type { Extension } from "@codemirror/state";
  import { EditorView, keymap, panels } from "@codemirror/view";
  import type { ChangeMark } from "$lib/editor/lineDiff";
  import { createStrip, jumpToLine, layoutTicks, renderTicks } from "$lib/editor/scrollMarkers";
  import { baseExtensions, editorLanguage } from "$lib/editor/setup";
  import type { FileDiff, LineAction, LineHunk, LineSelection } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { hunkDiff, hunkRanges, SCAN_LIMIT } from "./hunkDiff";
  import {
    applyBlock,
    buildInlineDoc,
    docLineOf,
    fallbackHunks,
    inlineChangeMarks,
    type InlineDoc,
    inlineSelection,
    newLineAt,
  } from "./inlineDoc";
  import { inlineDiffExtensions } from "./inlineView";
  import { chunkKinds, diffTheme, revertButton } from "./mergeExtensions";
  import { diffPrefs } from "./prefs.svelte";
  import { type BlameTarget, blameExtension, loadBlame, setBlameDisplay } from "$lib/editor/blame";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { type DiffLayout, settings } from "$lib/stores/settings.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { clampDiffSplit, DEFAULT_DIFF_SPLIT, splitFromPointer } from "./split";
  import { lfsContentChanged, lfsSizeText } from "$lib/views/git/lfs/lfsModel";
  import { type PreviewSides, showsBinaryPreview } from "./binaryPreview";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { commandSpecs, currentPlatform, shortcutOverrides } from "$lib/commands/commandRuntime";
  import { formatAccelerator } from "$lib/commands/keybinding";
  import { effectiveShortcut } from "$lib/commands/registry";
  import { diffLines } from "./diffLines.svelte";
  import { type DiffSide, rangeLines, selectedChangeLines, selectionSize } from "./lineSelection";

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
    /** Where the two sides come from, so a binary image or PDF shows side by side. */
    previewSides?: PreviewSides | null;
    /**
     * Stage, Unstage or Discard Selected Lines (the Changes diff): called with the changed
     * lines the selection picks. Without it the diff offers no line actions.
     */
    onLines?: ((action: LineAction, selection: LineSelection) => void) | null;
  }

  let {
    diff,
    path,
    mode,
    leftLabel,
    rightLabel,
    onChange,
    blame = null,
    revealLine = null,
    workingFile = null,
    previewSides = null,
    onLines = null,
  }: Props = $props();

  let revealedToken = -1;

  function applyReveal(editor: EditorView): boolean {
    if (!revealLine || revealLine.token === revealedToken) {
      return false;
    }
    revealedToken = revealLine.token;
    const doc = editor.state.doc;
    const line = inlineDoc ? docLineOf(inlineDoc, revealLine.line) : revealLine.line;
    const position = doc.line(Math.max(1, Math.min(line + 1, doc.lines))).from;
    editor.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: "center" }) });
    return true;
  }

  // A reveal for the diff that is already on screen.
  $effect(() => {
    void revealLine;
    const editor = newEditor();
    if (editor) {
      applyReveal(editor);
    }
  });

  // Apply the blame preferences to the open diff as they change.
  $effect(() => {
    const display = { inline: settings.currentLineBlame, gutter: settings.blameGutter };
    const editor = newEditor();
    if (editor && blame) {
      setBlameDisplay(editor, display);
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
  /** Changed lines the selection picks, for the line action buttons. */
  let selectedLines = $state(0);
  let selectionFrame = 0;
  /** The side the last selection was made in: the line actions read its selection. */
  let activeSide: DiffSide = "new";
  /** The backend's hunks of the texts on screen; null once a chunk control changed a side. */
  let viewHunks: LineHunk[] | null = null;

  let view: MergeView | null = null;
  /** The inline layout's one editor, and its document of old and new lines (inlineDoc.ts). */
  let inlineView: EditorView | null = null;
  let inlineDoc: InlineDoc | null = null;
  const inline = $derived(settings.diffLayout === "inline");
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
  const binaryPreview = $derived(showsBinaryPreview(diff, path, previewSides));
  /** 0 while the diff is hidden (a background tab), so the preview frees its files. */
  let previewWidth = $state(0);
  const fileName = $derived(path.split("/").pop() ?? path);
  /** Which line actions the diff offers: Stage and Discard (unstaged), Unstage (staged), or none. */
  const lineMode = $derived(onLines && textual && !identical && mode !== "readonly" ? mode : null);

  // The Git menu and the Command Palette run the line actions here while this diff is shown.
  $effect(() => {
    const target = lineMode;
    if (!target) {
      return;
    }
    return diffLines.attach({ mode: target, run: (action) => runLines(action) });
  });

  /** The editor with the new text: the right side, or the inline layout's only editor. */
  function newEditor(): EditorView | null {
    return view?.b ?? inlineView;
  }

  function changeCount(): number {
    return view ? view.chunks.length : (inlineDoc?.blocks.length ?? 0);
  }

  /** The new text's line to open the file at: the cursor line when it is on screen, else the top line. */
  function lineOnScreen(editor: EditorView): number {
    const head = editor.state.selection.main.head;
    let line: number;
    if (editor.hasFocus || editor.visibleRanges.some((range) => head >= range.from && head <= range.to)) {
      line = editor.state.doc.lineAt(head).number - 1;
    } else {
      line = editor.state.doc.lineAt(editor.lineBlockAtHeight(editor.scrollDOM.scrollTop).from).number - 1;
    }
    return inlineDoc ? newLineAt(inlineDoc, line) : line;
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
    const editor = newEditor();
    const line = target.sameLines && editor ? lineOnScreen(editor) : null;
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
    const layout = settings.diffLayout;
    const scrollKey = `${mode}:${collapse}:${layout}:${path}`;
    void build(target, diff, path, mode, collapse, layout, token, scrollKey);
    return () => {
      buildToken++;
      teardown(scrollKey);
    };
  });

  function teardown(scrollKey: string): void {
    const scroller = view?.dom ?? inlineView?.scrollDOM;
    if (!scroller) {
      return;
    }
    lastScroll = { key: scrollKey, top: scroller.scrollTop };
    cancelAnimationFrame(stripFrame);
    cancelAnimationFrame(selectionFrame);
    viewHunks = null;
    selectedLines = 0;
    stripObserver?.disconnect();
    stripObserver = null;
    strip?.remove();
    strip = null;
    view?.destroy();
    view = null;
    inlineView?.destroy();
    inlineView = null;
    inlineDoc = null;
  }

  async function build(
    target: HTMLDivElement,
    fileDiff: FileDiff,
    filePath: string,
    diffMode: DiffMode,
    collapse: boolean,
    layout: DiffLayout,
    token: number,
    scrollKey: string,
  ): Promise<void> {
    const language = await editorLanguage(filePath);
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
      // The hunks no longer fit this text; the reloaded diff brings new ones.
      viewHunks = null;
      scheduleSelectionCount();
      onChange?.(changedSide, update.state.doc.toString());
    });
    const selectionWatch = (side: DiffSide) =>
      EditorView.updateListener.of((update) => {
        const picked = update.transactions.some((transaction) => transaction.isUserEvent("select"));
        if (picked || (update.focusChanged && update.view.hasFocus)) {
          activeSide = side;
        }
        if (update.selectionSet || update.focusChanged) {
          scheduleSelectionCount();
        }
      });
    const geometry = EditorView.updateListener.of((update) => {
      if (update.docChanged || update.geometryChanged || update.heightChanged) {
        scheduleStrip();
      }
    });
    const sideExtensions = (changes: boolean, findHost: HTMLElement | null, side: DiffSide, numbered = true): Extension[] =>
      baseExtensions({
        readOnly: true,
        lineNumbers: numbered,
        extensions: [
          language,
          diffTheme,
          chunkKinds,
          navigation,
          geometry,
          selectionWatch(side),
          changes ? listener : [],
          findHost ? panels({ topContainer: findHost }) : [],
        ],
      });

    // The backend's line hunks, refined to characters inside each one; without them (an older
    // payload) CodeMirror diffs the whole texts itself.
    const diffConfig = fileDiff.hunks
      ? { scanLimit: SCAN_LIMIT, override: hunkDiff(fileDiff.original, fileDiff.modified, fileDiff.hunks) }
      : { scanLimit: SCAN_LIMIT };
    const blameExtensions = blame ? blameExtension({ inline: settings.currentLineBlame, gutter: settings.blameGutter }) : [];
    const collapseUnchanged = collapse ? { margin: 3, minSize: 4 } : undefined;

    let editor: EditorView;
    let shown: InlineDoc | null = null;
    if (layout === "inline") {
      // Hunks that do not fit the texts (or an older payload without them) are found again here.
      const fits = fileDiff.hunks && hunkRanges(fileDiff.original, fileDiff.modified, fileDiff.hunks) !== null;
      const hunks = fits && fileDiff.hunks ? fileDiff.hunks : fallbackHunks(fileDiff.original, fileDiff.modified);
      const inlineShown = buildInlineDoc(fileDiff.original, fileDiff.modified, hunks);
      const control = diffMode === "unstaged" ? "stage" : diffMode === "staged" ? "unstage" : null;
      shown = inlineShown;
      editor = new EditorView({
        doc: inlineShown.text,
        parent: target,
        extensions: [
          sideExtensions(false, findHostB, "new", false),
          blameExtensions,
          inlineDiffExtensions({
            doc: inlineShown,
            collapse,
            control,
            onControl: (block) => {
              if (control) {
                const next = applyBlock(fileDiff.original, fileDiff.modified, block, control);
                onChange?.(next.target, next.text);
              }
            },
          }),
        ],
      });
      inlineView = editor;
      inlineDoc = inlineShown;
    } else {
      const merge = new MergeView({
        a: { doc: fileDiff.original, extensions: sideExtensions(diffMode === "unstaged", findHostA, "old") },
        b: { doc: fileDiff.modified, extensions: [sideExtensions(diffMode === "staged", findHostB, "new"), blameExtensions] },
        parent: target,
        diffConfig,
        gutter: true,
        highlightChanges: true,
        collapseUnchanged,
        revertControls: diffMode === "unstaged" ? "b-to-a" : diffMode === "staged" ? "a-to-b" : undefined,
        renderRevertControl:
          diffMode === "unstaged"
            ? () => revertButton("Stage this change", "chevrons-left")
            : () => revertButton("Unstage this change", "chevrons-right"),
      });
      view = merge;
      editor = merge.b;
    }
    viewHunks = fileDiff.hunks ?? null;
    activeSide = "new";
    if (blame) {
      const inlineBlame = shown ? { text: fileDiff.modified, newLineOf: shown.lines.map((line) => line.new) } : null;
      void loadBlame(editor, blame, fileDiff.modifiedEol, inlineBlame);
    }
    chunkCount = changeCount();
    current = -1;
    scheduleSelectionCount();
    strip = createStrip((line) => jumpToLine(editor, line));
    target.appendChild(strip);
    stripObserver = new ResizeObserver(() => {
      scheduleStrip();
      placeSplitHandle();
    });
    stripObserver.observe(target);
    scheduleStrip();

    const restore = lastScroll?.key === scrollKey ? lastScroll.top : null;
    const scroller = view?.dom ?? editor.scrollDOM;
    requestAnimationFrame(() => {
      if (newEditor() !== editor) {
        return;
      }
      placeSplitHandle();
      if (applyReveal(editor)) {
        return;
      }
      if (restore !== null) {
        scroller.scrollTop = restore;
      } else if (changeCount() > 0) {
        current = 0;
        revealChange(0);
      }
    });
  }

  /** Change marks in the new text's line numbers. */
  function diffMarks(editor: EditorView, chunks: readonly Chunk[]): ChangeMark[] {
    const doc = editor.state.doc;
    return chunks.map((chunk) => {
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
      const editor = newEditor();
      if (editor && strip) {
        const marks = view ? diffMarks(editor, view.chunks) : inlineDoc ? inlineChangeMarks(inlineDoc) : [];
        renderTicks(strip, layoutTicks(editor, marks, strip.clientHeight));
      }
    });
  }

  /** The changed lines the selection of the active side picks; none without fitting hunks. */
  function currentSelection(): LineSelection {
    const side = activeSide;
    const editor = side === "old" ? (view?.a ?? null) : newEditor();
    const hunks = viewHunks;
    if (!editor || !hunks) {
      return { oldLines: [], newLines: [] };
    }
    const { doc, selection } = editor.state;
    const spans = selection.ranges.map((range) => rangeLines(doc, range.from, range.to));
    // Inline, removed and added lines are both in the text: a selection picks exactly its lines.
    return inlineDoc ? inlineSelection(inlineDoc, spans) : selectedChangeLines(hunks, side, spans);
  }

  function scheduleSelectionCount(): void {
    cancelAnimationFrame(selectionFrame);
    selectionFrame = requestAnimationFrame(() => {
      selectedLines = selectionSize(currentSelection());
    });
  }

  function runLines(action: LineAction): void {
    const selection = currentSelection();
    if (selectionSize(selection) === 0) {
      toast.info("Select changed lines first", "Select lines in the diff, or put the cursor on a change.");
      return;
    }
    onLines?.(action, selection);
  }

  const LINE_COMMANDS: Record<LineAction, "git.lines.stage" | "git.lines.unstage" | "git.lines.discard"> = {
    stage: "git.lines.stage",
    unstage: "git.lines.unstage",
    discard: "git.lines.discard",
  };

  /** The action's key as the platform writes it ("⌥⇧⌘S"), or null without one. */
  function lineShortcut(action: LineAction): string | null {
    const spec = commandSpecs().find((candidate) => candidate.id === LINE_COMMANDS[action]);
    const shortcut = spec ? effectiveShortcut(spec, shortcutOverrides()) : null;
    return shortcut ? formatAccelerator(shortcut, currentPlatform()) : null;
  }

  function lineTitle(text: string, action: LineAction): string {
    const shortcut = lineShortcut(action);
    return shortcut ? `${text} (${shortcut})` : text;
  }

  /** Right-click in either side: the line actions for its selection, and Copy. */
  function openLineMenu(event: MouseEvent): void {
    const target = lineMode;
    const node = event.target instanceof Node ? event.target : null;
    const oldEditor = view?.a ?? null;
    const shownNew = newEditor();
    const editor = node && oldEditor?.dom.contains(node) ? oldEditor : node && shownNew?.dom.contains(node) ? shownNew : null;
    if (!target || !editor) {
      return;
    }
    activeSide = editor === oldEditor ? "old" : "new";
    // A click outside the selection moves the cursor there first, like other editors.
    const position = editor.posAtCoords({ x: event.clientX, y: event.clientY });
    if (position !== null && !editor.state.selection.ranges.some((range) => position >= range.from && position <= range.to)) {
      editor.dispatch({ selection: { anchor: position } });
    }
    const count = selectionSize(currentSelection());
    const item = (label: string, action: LineAction, danger = false): MenuItem => ({
      label,
      action: () => runLines(action),
      disabled: count === 0,
      danger,
      hint: lineShortcut(action) ?? undefined,
    });
    const items: MenuItem[] =
      target === "unstaged"
        ? [item("Stage Selected Lines", "stage"), item("Discard Selected Lines...", "discard", true)]
        : [item("Unstage Selected Lines", "unstage")];
    const { state } = editor;
    const copied = state.selection.ranges.filter((range) => !range.empty).map((range) => state.sliceDoc(range.from, range.to));
    items.push(
      { separator: true },
      {
        label: "Copy",
        disabled: copied.length === 0,
        action: () => {
          navigator.clipboard.writeText(copied.join("\n")).catch(() => toast.error("Could not copy the selection"));
        },
      },
    );
    contextMenu.open(event, items);
  }

  function revealChange(index: number): void {
    const editor = newEditor();
    let position: number | null = null;
    if (view) {
      const chunk = view.chunks[index];
      if (chunk) {
        view.a.dispatch({ selection: { anchor: Math.min(chunk.fromA, view.a.state.doc.length) } });
        position = Math.min(chunk.fromB, view.b.state.doc.length);
      }
    } else if (editor && inlineDoc?.blocks[index]) {
      const doc = editor.state.doc;
      position = doc.line(Math.min(inlineDoc.blocks[index].from + 1, doc.lines)).from;
    }
    if (!editor || position === null) {
      return;
    }
    editor.dispatch({
      selection: { anchor: position },
      effects: EditorView.scrollIntoView(position, { y: "center" }),
    });
  }

  function goToChunk(direction: 1 | -1): boolean {
    const count = changeCount();
    if (count === 0) {
      return false;
    }
    if (current < 0 || current >= count) {
      current = direction > 0 ? 0 : count - 1;
    } else {
      current = (current + direction + count) % count;
    }
    revealChange(current);
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
    <span class="layout" role="group" aria-label="Diff layout">
      <button
        class="toggle layout-button"
        class:active={!inline}
        onclick={() => settings.setDiffLayout("sideBySide")}
        aria-pressed={!inline}
        disabled={!textual || identical}
        title="Side by side: old text on the left, new on the right"
        aria-label="Side by side"
      >
        <Icon name="split-view" size={13} />
      </button>
      <button
        class="toggle layout-button"
        class:active={inline}
        onclick={() => settings.setDiffLayout("inline")}
        aria-pressed={inline}
        disabled={!textual || identical}
        title="Inline: removed lines above the lines that replace them"
        aria-label="Inline"
      >
        <Icon name="split-rows" size={13} />
      </button>
    </span>
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
    {#if lineMode}
      <div class="divider"></div>
      {#if lineMode === "unstaged"}
        <button
          class="toggle"
          onclick={() => runLines("stage")}
          disabled={selectedLines === 0}
          title={lineTitle("Stage the selected lines, or the change at the cursor", "stage")}
        >
          <Icon name="plus" size={13} />
          Stage Lines
        </button>
        <button
          class="toggle"
          onclick={() => runLines("discard")}
          disabled={selectedLines === 0}
          title={lineTitle("Discard the selected lines in the work tree", "discard")}
        >
          <Icon name="discard" size={13} />
          Discard Lines
        </button>
      {:else}
        <button
          class="toggle"
          onclick={() => runLines("unstage")}
          disabled={selectedLines === 0}
          title={lineTitle("Unstage the selected lines, or the change at the cursor", "unstage")}
        >
          <Icon name="minus" size={13} />
          Unstage Lines
        </button>
      {/if}
    {/if}
    <span class="path truncate" title={path}>
      <span class="name">{fileName}</span>
      {#if directory}
        <span class="dim">{directory}</span>
      {/if}
    </span>
  </div>

  {#if !textual}
    {#if binaryPreview && previewSides}
      <div class="preview-host" bind:clientWidth={previewWidth}>
        {#if previewWidth > 0}
          {#await import("./BinaryPreview.svelte") then preview}
            <preview.default sides={previewSides} {leftLabel} {rightLabel} {path} />
          {/await}
        {/if}
      </div>
    {:else if lfs}
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
    {#if inline}
      <div class="labels">
        <span class="label inline-label" title={`${leftLabel} to ${rightLabel}`}>
          <span class="truncate">{leftLabel}</span>
          <Icon name="arrow-right" size={11} />
          <span class="truncate">{rightLabel}</span>
        </span>
      </div>
      <div class="find-bars">
        <div class="find-host" bind:this={findHostB}></div>
      </div>
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
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="body"
      bind:this={host}
      oncontextmenu={(event) => {
        if (lineMode) {
          openLineMenu(event);
        }
      }}
    >
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

  .layout {
    display: inline-flex;
    gap: 1px;
    margin-right: 4px;
  }

  .layout-button {
    padding: 0 6px;
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

  .inline-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .inline-label .truncate {
    flex: 0 1 auto;
    min-width: 0;
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

  /* The inline layout scrolls itself; it stops short of the change overview ruler. */
  .body :global(.cm-editor.cm-inlineDiff) {
    position: absolute;
    inset: 0 12px 0 0;
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

  .preview-host {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .lfs-message {
    flex-direction: column;
    gap: 4px;
  }

  .lfs-title {
    font-weight: 600;
  }
</style>
