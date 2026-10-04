<script lang="ts">
  import { isolateHistory, redo, undo, undoDepth, redoDepth } from "@codemirror/commands";
  import { EditorSelection, EditorState, type Extension } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { onMount } from "svelte";
  import { baseExtensions, editorLanguage } from "$lib/editor/setup";
  import type { MergeDocument } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import type { ChangeMark } from "$lib/editor/lineDiff";
  import { changeMarkField, type MarkSource, scrollMarkers, setChangeMarks } from "$lib/editor/scrollMarkers";
  import {
    applyKeymap,
    chunkField,
    type LineMark,
    resultExtensions,
    resultMarks,
    setChunks,
    setSideMarks,
    sideExtensions,
    sideMarks,
  } from "./extensions";
  import { changedSpans, type TextSpan } from "./inline";
  import {
    acceptWholeSide,
    applyNonConflicting,
    applySide,
    type ChangeType,
    changeType,
    type ChunkAction,
    type ChunkState,
    findUnresolved,
    hasConflictMarkers,
    ignoreSide,
    initialChunks,
    invertAnchors,
    isResolved,
    lineStarts,
    mapLine,
    sideChanged,
    type SideName,
    rangeOfString,
    rangeText,
    type SideTexts,
    sideRange,
    sideToResultAnchors,
    unresolvedCounts,
  } from "./model";

  interface Props {
    doc: MergeDocument;
    /** Saves the result; resolves when done. */
    onApply: (content: string) => Promise<void> | void;
    onCancel: () => void;
    /** Reloads the document with a different whitespace mode. */
    onReload: (ignoreWhitespace: boolean) => void;
  }

  let { doc, onApply, onCancel, onReload }: Props = $props();

  type Pane = "ours" | "result" | "theirs";

  interface Connector {
    id: number;
    path: string;
    type: ChangeType;
    buttonY: number;
    /** Label for the apply button: replace or append. */
    append: boolean;
  }

  const CONNECTOR_WIDTH = 52;

  let oursHost = $state<HTMLDivElement | null>(null);
  let resultHost = $state<HTMLDivElement | null>(null);
  let theirsHost = $state<HTMLDivElement | null>(null);
  let panesEl = $state<HTMLDivElement | null>(null);

  let chunks = $state.raw<ChunkState[]>([]);
  let leftConnectors = $state.raw<Connector[]>([]);
  let rightConnectors = $state.raw<Connector[]>([]);
  let canUndo = $state(false);
  let canRedo = $state(false);
  let saving = $state(false);

  let views: Record<Pane, EditorView> | null = null;
  // The read-only sides are read from their editors' documents, so each text is held once more
  // at most, not again as arrays of lines. The base is read from the string through its line starts.
  let sides: SideTexts | null = null;
  const baseStarts = $derived(lineStarts(doc.base));
  // Sides are read-only, so word-level highlights are computed once per chunk.
  const inlineCache = new Map<string, TextSpan[] | null>();
  let lastMarkSignature = "";

  function inlineSpans(chunk: ChunkState, side: SideName): TextSpan[] | null {
    const key = `${side}:${chunk.id}`;
    if (inlineCache.has(key)) {
      return inlineCache.get(key) ?? null;
    }
    if (!sides) {
      return null;
    }
    const range = sideRange(chunk, side);
    const other: SideName = side === "ours" ? "theirs" : "ours";
    const otherRange = sideRange(chunk, other);
    // With no base text (both added), compare against the other side instead.
    let reference: string | null = null;
    if (chunk.base.start < chunk.base.end) {
      reference = rangeOfString(doc.base, baseStarts, chunk.base);
    } else if (chunk.kind === "conflict" && otherRange.start < otherRange.end) {
      reference = rangeText(sides[other], otherRange);
    }
    const spans = range.start < range.end && reference !== null ? changedSpans(reference, rangeText(sides[side], range)) : null;
    inlineCache.set(key, spans);
    return spans;
  }

  const counts = $derived(unresolvedCounts(chunks));
  const nonConflicting = $derived(
    chunks.filter((chunk) => !isResolved(chunk) && chunk.kind !== "conflict" && !chunk.edited).length,
  );
  const fileName = $derived(doc.path.split("/").pop() ?? doc.path);

  onMount(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    void (async () => {
      const language = await editorLanguage(doc.path);
      if (cancelled || !oursHost || !resultHost || !theirsHost) {
        return;
      }
      views = createViews(language);
      syncState();
      observer = new ResizeObserver(() => scheduleDraw());
      if (panesEl) {
        observer.observe(panesEl);
      }
      const first = findUnresolved(chunks, -1, 1);
      if (first) {
        reveal(first);
      } else {
        scheduleDraw();
      }
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      if (views) {
        views.ours.destroy();
        views.result.destroy();
        views.theirs.destroy();
        views = null;
        sides = null;
      }
    };
  });

  function toChangeMarks(marks: LineMark[]): ChangeMark[] {
    return marks.map((mark) => ({ from: mark.range.start, to: mark.range.end, kind: mark.type }));
  }

  // The result ruler follows the chunk field; memoized so scrolling does no work.
  let resultMarkMemo: { chunks: ChunkState[]; marks: ChangeMark[] } | null = null;
  const resultMarkSource: MarkSource = (state) => {
    const current = state.field(chunkField);
    if (!resultMarkMemo || resultMarkMemo.chunks !== current) {
      resultMarkMemo = { chunks: current, marks: toChangeMarks(resultMarks(current)) };
    }
    return resultMarkMemo.marks;
  };

  function createViews(language: Extension): Record<Pane, EditorView> {
    const onUpdate = EditorView.updateListener.of((update) => {
      if (update.docChanged || update.transactions.some((tr) => tr.effects.some((effect) => effect.is(setChunks)))) {
        syncState();
      } else if (update.geometryChanged || update.viewportChanged) {
        scheduleDraw();
      }
    });
    const applyKeys = applyKeymap(applyShortcut);
    // A side's find bar opening or closing moves its text: redraw the connectors.
    const onSideGeometry = EditorView.updateListener.of((update) => {
      if (update.geometryChanged) {
        scheduleDraw();
      }
    });
    const sideView = (text: string, parent: HTMLElement) =>
      new EditorView({
        parent,
        state: EditorState.create({
          doc: text,
          extensions: [
            applyKeys,
            onSideGeometry,
            baseExtensions({ readOnly: true, kind: "merge" }),
            language,
            sideExtensions(),
            changeMarkField,
            scrollMarkers(),
            EditorView.editable.of(false),
          ],
        }),
      });
    const ours = sideView(doc.ours, oursHost!);
    const theirs = sideView(doc.theirs, theirsHost!);
    sides = { ours: ours.state.doc, theirs: theirs.state.doc };
    const result = new EditorView({
      parent: resultHost!,
      state: EditorState.create({
        doc: doc.base,
        extensions: [
          applyKeys,
          baseExtensions({ readOnly: false, kind: "merge" }),
          language,
          resultExtensions(initialChunks(doc.chunks)),
          scrollMarkers(resultMarkSource),
          onUpdate,
        ],
      }),
    });
    for (const [pane, view] of [
      ["ours", ours],
      ["result", result],
      ["theirs", theirs],
    ] as const) {
      view.scrollDOM.addEventListener("scroll", () => onScroll(pane), { passive: true });
    }
    return { ours, result, theirs };
  }

  /** Pulls chunk state out of the result editor and refreshes everything derived from it. */
  function syncState(): void {
    if (!views) {
      return;
    }
    const state = views.result.state;
    chunks = state.field(chunkField);
    canUndo = undoDepth(state) > 0;
    canRedo = redoDepth(state) > 0;
    // Side decorations only depend on which sides are still open.
    const signature = chunks.map((chunk) => `${chunk.id}${chunk.oursDone ? 1 : 0}${chunk.theirsDone ? 1 : 0}`).join(",");
    if (signature !== lastMarkSignature) {
      lastMarkSignature = signature;
      const oursMarks = sideMarks(chunks, "ours", (chunk) => inlineSpans(chunk, "ours"));
      const theirsMarks = sideMarks(chunks, "theirs", (chunk) => inlineSpans(chunk, "theirs"));
      views.ours.dispatch({ effects: [setSideMarks.of(oursMarks), setChangeMarks.of(toChangeMarks(oursMarks))] });
      views.theirs.dispatch({ effects: [setSideMarks.of(theirsMarks), setChangeMarks.of(toChangeMarks(theirsMarks))] });
    }
    scheduleDraw();
  }

  function dispatchAction(action: ChunkAction | null): void {
    if (!views || !action) {
      return;
    }
    views.result.dispatch({
      changes: action.changes,
      effects: setChunks.of(action.chunks),
      annotations: isolateHistory.of("full"),
      userEvent: "input.merge",
    });
  }

  function apply(chunkId: number, side: SideName): void {
    if (views && sides) {
      dispatchAction(applySide(views.result.state.doc, views.result.state.field(chunkField), chunkId, side, sides));
    }
  }

  function ignore(chunkId: number, side: SideName): void {
    if (views) {
      dispatchAction(ignoreSide(views.result.state.field(chunkField), chunkId, side));
    }
  }

  function applyAllNonConflicting(only?: SideName): void {
    if (views && sides) {
      dispatchAction(applyNonConflicting(views.result.state.doc, views.result.state.field(chunkField), sides, only));
    }
  }

  // Connector drawing ----------------------------------------------------

  let drawPending = false;

  function scheduleDraw(): void {
    if (drawPending) {
      return;
    }
    drawPending = true;
    requestAnimationFrame(() => {
      drawPending = false;
      draw();
    });
  }

  interface Span {
    top: number;
    bottom: number;
  }

  function span(view: EditorView, start: number, end: number, originTop: number): Span {
    const text = view.state.doc;
    const lineCount = text.lines;
    let top: number;
    let bottom: number;
    if (start < end) {
      top = view.lineBlockAt(text.line(Math.min(start + 1, lineCount)).from).top;
      bottom = view.lineBlockAt(text.line(Math.min(end, lineCount)).from).bottom;
    } else if (start < lineCount) {
      top = view.lineBlockAt(text.line(start + 1).from).top;
      bottom = top;
    } else {
      top = view.lineBlockAt(text.line(lineCount).from).bottom;
      bottom = top;
    }
    const offset = view.documentTop - originTop;
    return { top: top + offset, bottom: bottom + offset };
  }

  function visibleLines(view: EditorView): [number, number] {
    const text = view.state.doc;
    return [text.lineAt(view.viewport.from).number - 1, text.lineAt(view.viewport.to).number];
  }

  function overlaps(start: number, end: number, visible: [number, number]): boolean {
    return end >= visible[0] && start <= visible[1];
  }

  function ribbon(left: Span, right: Span): string {
    const w = CONNECTOR_WIDTH;
    const mid = w / 2;
    return (
      `M0 ${left.top} C${mid} ${left.top} ${mid} ${right.top} ${w} ${right.top} ` +
      `L${w} ${right.bottom} C${mid} ${right.bottom} ${mid} ${left.bottom} 0 ${left.bottom} Z`
    );
  }

  function connectorsFor(side: SideName, originTop: number, height: number): Connector[] {
    if (!views) {
      return [];
    }
    const sideView = side === "ours" ? views.ours : views.theirs;
    const result = views.result;
    const sideVisible = visibleLines(sideView);
    const resultVisible = visibleLines(result);
    const connectors: Connector[] = [];
    for (const chunk of chunks) {
      const done = side === "ours" ? chunk.oursDone : chunk.theirsDone;
      if (done || !sideChanged(chunk, side)) {
        continue;
      }
      const range = sideRange(chunk, side);
      if (!overlaps(range.start, range.end, sideVisible) && !overlaps(chunk.result.start, chunk.result.end, resultVisible)) {
        continue;
      }
      const sideSpan = span(sideView, range.start, range.end, originTop);
      const resultSpan = span(result, chunk.result.start, chunk.result.end, originTop);
      if (Math.max(sideSpan.bottom, resultSpan.bottom) < -40 || Math.min(sideSpan.top, resultSpan.top) > height + 40) {
        continue;
      }
      // Ribbons run left to right: ours -> result on the left, result -> theirs on the right.
      const path = side === "ours" ? ribbon(sideSpan, resultSpan) : ribbon(resultSpan, sideSpan);
      const anchorTop = sideSpan.top;
      connectors.push({
        id: chunk.id,
        path,
        type: changeType(chunk, side),
        buttonY: Math.max(2, Math.min(height - 20, anchorTop + 1)),
        append: chunk.kind === "conflict" && chunk.applied,
      });
    }
    return connectors;
  }

  function draw(): void {
    if (!views || !panesEl) {
      return;
    }
    const rect = panesEl.getBoundingClientRect();
    leftConnectors = connectorsFor("ours", rect.top, rect.height);
    rightConnectors = connectorsFor("theirs", rect.top, rect.height);
  }

  // Synchronized scrolling ------------------------------------------------

  let scrollLock: Pane | null = null;
  let unlockFrame = 0;

  function lineAtCenter(view: EditorView): number {
    const scroller = view.scrollDOM;
    const scrollRect = scroller.getBoundingClientRect();
    const docOffset = view.documentTop - scrollRect.top + scroller.scrollTop;
    const height = scroller.scrollTop + scroller.clientHeight / 2 - docOffset;
    const block = view.lineBlockAtHeight(Math.max(0, height));
    const index = view.state.doc.lineAt(block.from).number - 1;
    const fraction = block.height > 0 ? Math.min(1, Math.max(0, (height - block.top) / block.height)) : 0;
    return index + fraction;
  }

  function scrollToLine(view: EditorView, position: number): void {
    const text = view.state.doc;
    const index = Math.max(0, Math.min(text.lines - 1, Math.floor(position)));
    const fraction = Math.max(0, Math.min(1, position - index));
    const block = view.lineBlockAt(text.line(index + 1).from);
    const scroller = view.scrollDOM;
    const scrollRect = scroller.getBoundingClientRect();
    const docOffset = view.documentTop - scrollRect.top + scroller.scrollTop;
    scroller.scrollTop = docOffset + block.top + fraction * block.height - scroller.clientHeight / 2;
  }

  function onScroll(source: Pane): void {
    scheduleDraw();
    if (!views || (scrollLock && scrollLock !== source)) {
      return;
    }
    scrollLock = source;
    cancelAnimationFrame(unlockFrame);
    const current = views;
    const position = lineAtCenter(current[source]);
    const resultLines = current.result.state.doc.lines;
    const oursAnchors = sideToResultAnchors(chunks, "ours", current.ours.state.doc.lines, resultLines);
    const theirsAnchors = sideToResultAnchors(chunks, "theirs", current.theirs.state.doc.lines, resultLines);
    const resultPosition =
      source === "result" ? position : mapLine(position, source === "ours" ? oursAnchors : theirsAnchors);
    if (source !== "result") {
      scrollToLine(current.result, resultPosition);
    }
    if (source !== "ours") {
      scrollToLine(current.ours, mapLine(resultPosition, invertAnchors(oursAnchors)));
    }
    if (source !== "theirs") {
      scrollToLine(current.theirs, mapLine(resultPosition, invertAnchors(theirsAnchors)));
    }
    unlockFrame = requestAnimationFrame(() => {
      unlockFrame = requestAnimationFrame(() => {
        scrollLock = null;
      });
    });
  }

  // Navigation --------------------------------------------------------------

  function reveal(chunk: ChunkState): void {
    if (!views) {
      return;
    }
    const text = views.result.state.doc;
    const line = text.line(Math.min(chunk.result.start + 1, text.lines));
    views.result.dispatch({
      selection: EditorSelection.cursor(line.from),
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    requestAnimationFrame(() => onScroll("result"));
  }

  function navigate(direction: 1 | -1): void {
    if (!views) {
      return;
    }
    const state = views.result.state;
    const cursorLine = state.doc.lineAt(state.selection.main.head).number - 1;
    const target = findUnresolved(chunks, cursorLine, direction);
    if (target) {
      reveal(target);
    }
  }

  // Commands ---------------------------------------------------------------

  function runUndo(): void {
    if (views) {
      undo(views.result);
    }
  }

  function runRedo(): void {
    if (views) {
      redo(views.result);
    }
  }

  async function acceptWhole(side: SideName): Promise<void> {
    if (!views) {
      return;
    }
    const text = side === "ours" ? doc.ours : doc.theirs;
    dispatchAction(acceptWholeSide(views.result.state.doc, views.result.state.field(chunkField), text, side));
    await save(true);
  }

  async function save(skipChecks = false): Promise<void> {
    if (!views || saving) {
      return;
    }
    const content = views.result.state.doc.toString();
    if (!skipChecks) {
      const open = unresolvedCounts(views.result.state.field(chunkField));
      if (open.changes > 0) {
        const ok = await dialogs.confirm({
          title: "Unresolved Changes",
          message: `${open.changes} ${open.changes === 1 ? "change is" : "changes are"} still unresolved${
            open.conflicts > 0 ? `, including ${open.conflicts} ${open.conflicts === 1 ? "conflict" : "conflicts"}` : ""
          }. Save the result as it is and mark the file resolved?`,
          confirmLabel: "Save Anyway",
        });
        if (!ok) {
          return;
        }
      }
      if (hasConflictMarkers(content)) {
        const ok = await dialogs.confirm({
          title: "Conflict Markers Found",
          message: "The result still contains conflict markers (<<<<<<<, =======, >>>>>>>). Save anyway?",
          confirmLabel: "Save Anyway",
          danger: true,
        });
        if (!ok) {
          return;
        }
      }
    }
    saving = true;
    try {
      await onApply(content);
    } finally {
      saving = false;
    }
  }

  function applyShortcut(): void {
    if (!dialogs.active) {
      void save();
    }
  }

  /** Cancel, Esc and the close button all end here, so an edited result is never dropped without asking. */
  export async function cancel(): Promise<void> {
    if (saving) {
      return;
    }
    if (views && undoDepth(views.result.state) > 0) {
      const ok = await dialogs.confirm({
        title: "Discard Changes",
        message: "Close the merge window and discard your changes to the result?",
        confirmLabel: "Discard",
        danger: true,
      });
      if (!ok) {
        return;
      }
    }
    onCancel();
  }

  async function toggleWhitespace(): Promise<void> {
    if (views && undoDepth(views.result.state) > 0) {
      const ok = await dialogs.confirm({
        title: "Reload Merge",
        message: "Changing the whitespace mode recomputes the differences and discards your changes.",
        confirmLabel: "Reload",
      });
      if (!ok) {
        return;
      }
    }
    onReload(!doc.ignoreWhitespace);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (dialogs.active || event.defaultPrevented) {
      return;
    }
    if (event.key === "F7") {
      event.preventDefault();
      navigate(event.shiftKey ? -1 : 1);
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      // The editors handle Cmd+Enter themselves; this covers the toolbar and buttons.
      event.preventDefault();
      void save();
    } else if (event.key === "Escape" && !(event.target as HTMLElement | null)?.closest(".cm-panels")) {
      event.preventDefault();
      void cancel();
    }
  }

  const statusText = $derived.by(() => {
    if (counts.changes === 0) {
      return "All changes processed";
    }
    const changes = `${counts.changes} ${counts.changes === 1 ? "change" : "changes"}`;
    if (counts.conflicts === 0) {
      return `${changes} left`;
    }
    return `${changes} left, ${counts.conflicts} ${counts.conflicts === 1 ? "conflict" : "conflicts"}`;
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="merge-editor">
  <div class="toolbar">
    <div class="group">
      <button
        class="icon-btn"
        onclick={() => applyAllNonConflicting("ours")}
        disabled={nonConflicting === 0}
        title="Apply non-conflicting changes from the left"
      >
        <Icon name="chevrons-right" size={15} />
      </button>
      <button class="icon-btn wand" onclick={() => applyAllNonConflicting()} disabled={nonConflicting === 0} title="Apply all non-conflicting changes">
        <Icon name="wand" size={15} />
        <span>Apply non-conflicting</span>
      </button>
      <button
        class="icon-btn"
        onclick={() => applyAllNonConflicting("theirs")}
        disabled={nonConflicting === 0}
        title="Apply non-conflicting changes from the right"
      >
        <Icon name="chevrons-left" size={15} />
      </button>
    </div>
    <div class="divider"></div>
    <div class="group">
      <button class="icon-btn" onclick={() => navigate(-1)} disabled={counts.changes === 0} title="Previous change (Shift+F7)">
        <Icon name="arrow-up" size={15} />
      </button>
      <button class="icon-btn" onclick={() => navigate(1)} disabled={counts.changes === 0} title="Next change (F7)">
        <Icon name="arrow-down" size={15} />
      </button>
    </div>
    <div class="divider"></div>
    <div class="group">
      <button class="icon-btn" onclick={runUndo} disabled={!canUndo} title="Undo (Cmd+Z in the result)">
        <Icon name="undo" size={15} />
      </button>
      <button class="icon-btn" onclick={runRedo} disabled={!canRedo} title="Redo (Shift+Cmd+Z in the result)">
        <Icon name="redo" size={15} />
      </button>
    </div>
    <div class="divider"></div>
    <button
      class="toggle"
      class:active={doc.ignoreWhitespace}
      aria-pressed={doc.ignoreWhitespace}
      onclick={toggleWhitespace}
      title="Ignore whitespace differences when comparing"
    >
      <Icon name="pilcrow" size={13} />
      Ignore whitespace
    </button>
    <div class="spacer"></div>
    <span class="status" class:done={counts.changes === 0} class:conflicts={counts.conflicts > 0}>{statusText}</span>
  </div>

  <div class="labels">
    <div class="label ours" title={doc.oursLabel}>{doc.oursLabel}</div>
    <div class="label-gap"></div>
    <div class="label result">Result <span class="dim">{fileName}</span></div>
    <div class="label-gap"></div>
    <div class="label theirs" title={doc.theirsLabel}>{doc.theirsLabel}</div>
  </div>

  <div class="panes" bind:this={panesEl}>
    <div class="pane" bind:this={oursHost}></div>
    <div class="connector" style="width: {CONNECTOR_WIDTH}px">
      <svg width={CONNECTOR_WIDTH} height="100%" aria-hidden="true">
        {#each leftConnectors as connector (connector.id)}
          <path class="ribbon {connector.type}" d={connector.path} />
        {/each}
      </svg>
      {#each leftConnectors as connector (connector.id)}
        <div class="buttons left" style="top: {connector.buttonY}px">
          <button
            class="chunk-btn apply {connector.type}"
            title={connector.append ? "Append left change" : "Apply left change"}
            onclick={() => apply(connector.id, "ours")}
          >
            <Icon name="chevrons-right" size={12} strokeWidth={2.5} />
          </button>
          <button class="chunk-btn ignore" title="Ignore left change" onclick={() => ignore(connector.id, "ours")}>
            <Icon name="x" size={11} strokeWidth={2.5} />
          </button>
        </div>
      {/each}
    </div>
    <div class="pane result-pane" bind:this={resultHost}></div>
    <div class="connector" style="width: {CONNECTOR_WIDTH}px">
      <svg width={CONNECTOR_WIDTH} height="100%" aria-hidden="true">
        {#each rightConnectors as connector (connector.id)}
          <path class="ribbon {connector.type}" d={connector.path} />
        {/each}
      </svg>
      {#each rightConnectors as connector (connector.id)}
        <div class="buttons right" style="top: {connector.buttonY}px">
          <button class="chunk-btn ignore" title="Ignore right change" onclick={() => ignore(connector.id, "theirs")}>
            <Icon name="x" size={11} strokeWidth={2.5} />
          </button>
          <button
            class="chunk-btn apply {connector.type}"
            title={connector.append ? "Append right change" : "Apply right change"}
            onclick={() => apply(connector.id, "theirs")}
          >
            <Icon name="chevrons-left" size={12} strokeWidth={2.5} />
          </button>
        </div>
      {/each}
    </div>
    <div class="pane" bind:this={theirsHost}></div>
  </div>

  <div class="footer">
    <div class="group">
      <button class="btn" onclick={() => acceptWhole("ours")} disabled={saving} title="Resolve the whole file with the left version">
        Accept Left
      </button>
      <button class="btn" onclick={() => acceptWhole("theirs")} disabled={saving} title="Resolve the whole file with the right version">
        Accept Right
      </button>
    </div>
    <div class="spacer"></div>
    <span class="hint dim">F7 next change &middot; Cmd+Enter apply</span>
    <button class="btn" onclick={cancel} disabled={saving}>Cancel</button>
    <button class="btn primary" onclick={() => save()} disabled={saving}>
      {saving ? "Saving..." : "Apply"}
    </button>
  </div>
</div>

<style>
  .merge-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--panel);
  }

  .toolbar,
  .footer {
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: var(--panel);
  }

  .toolbar {
    border-bottom: 1px solid var(--border-strong);
  }

  .footer {
    gap: 8px;
    border-top: 1px solid var(--border-strong);
  }

  .group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .footer .group {
    gap: 8px;
  }

  .divider {
    width: 1px;
    height: 18px;
    margin: 0 6px;
    background: var(--border-strong);
  }

  .spacer {
    flex: 1;
  }

  .wand span {
    font-size: 12.5px;
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: transparent;
    font-size: 12px;
    cursor: pointer;
  }

  .toggle.active {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    border-color: var(--accent);
    color: var(--accent);
  }

  .status {
    font-weight: 500;
    color: var(--text-dim);
  }

  .status.conflicts {
    color: var(--danger);
  }

  .status.done {
    color: var(--success);
  }

  .labels {
    flex: none;
    display: flex;
    background: var(--panel-alt);
    border-bottom: 1px solid var(--border-strong);
    font-size: 12px;
  }

  .label {
    flex: 1;
    min-width: 0;
    padding: 5px 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .label.result {
    text-align: center;
  }

  .label.theirs {
    text-align: right;
  }

  .label-gap {
    flex: none;
    width: 52px;
  }

  .panes {
    flex: 1;
    display: flex;
    min-height: 0;
    position: relative;
  }

  .pane {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    background: var(--editor-bg);
  }

  .pane :global(.cm-editor) {
    height: 100%;
  }

  .result-pane {
    box-shadow:
      inset 1px 0 0 var(--border-strong),
      inset -1px 0 0 var(--border-strong);
  }

  .connector {
    flex: none;
    position: relative;
    overflow: hidden;
    background: var(--editor-bg);
  }

  .connector svg {
    position: absolute;
    inset: 0;
    height: 100%;
  }

  .ribbon {
    stroke-width: 1;
  }

  .ribbon.modified {
    fill: var(--diff-modified);
    stroke: var(--diff-modified-edge);
  }

  .ribbon.added {
    fill: var(--diff-added);
    stroke: var(--diff-added-edge);
  }

  .ribbon.deleted {
    fill: var(--diff-deleted);
    stroke: var(--diff-deleted-edge);
  }

  .ribbon.conflict {
    fill: var(--diff-conflict);
    stroke: var(--diff-conflict-edge);
  }

  .buttons {
    position: absolute;
    display: flex;
    gap: 2px;
  }

  .buttons.left {
    left: 2px;
  }

  .buttons.right {
    right: 2px;
  }

  .chunk-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 17px;
    padding: 0;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--panel);
    color: var(--text-dim);
    cursor: pointer;
  }

  .chunk-btn:hover {
    color: var(--text);
    border-color: var(--text-dim);
  }

  .chunk-btn.apply.modified {
    color: var(--diff-modified-edge);
  }

  .chunk-btn.apply.added {
    color: var(--diff-added-edge);
  }

  .chunk-btn.apply.deleted {
    color: var(--diff-deleted-edge);
  }

  .chunk-btn.apply.conflict {
    color: var(--diff-conflict-edge);
  }

  .chunk-btn.ignore:hover {
    color: var(--danger);
  }

  .hint {
    font-size: 12px;
    margin-right: 6px;
  }
</style>
