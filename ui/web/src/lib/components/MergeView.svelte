<!-- The 3-way merge view: your version, the result and their version side by side, chunks tinted by kind
     (modified, added, deleted, conflict), ribbons joining them across the gaps with Apply and Ignore buttons. The
     result is editable; scrolling one pane scrolls the others. The app computes the chunks and applies them. -->
<script lang="ts">
  import { syntaxHighlighting } from "@codemirror/language";
  import { EditorState, type Extension } from "@codemirror/state";
  import { EditorView, lineNumbers } from "@codemirror/view";
  import { classHighlighter } from "@lezer/highlight";
  import { onDestroy, onMount } from "svelte";
  import { chunkDecorations, setChunks, type ChunkSide } from "../editor/chunks";
  import { languageSupport, type CodeLanguage } from "../editor/languages";
  import { editorTheme, mergeTheme } from "../editor/theme";
  import type { MergeChunk } from "../logic/mergeGeometry";
  import { presetVar, type ViewHeight } from "../logic/presets";
  import MergeConnector, { type ConnectorRibbon } from "./MergeConnector.svelte";

  interface Props {
    left: string;
    result?: string;
    right: string;
    chunks: MergeChunk[];
    labels?: { left: string; result: string; right: string };
    fileName?: string;
    language?: CodeLanguage;
    height?: ViewHeight;
    label: string;
    extensions?: Extension[];
    onapply?: (index: number, side: "left" | "right") => void;
    onignore?: (index: number, side: "left" | "right") => void;
  }

  let {
    left,
    result = $bindable(""),
    right,
    chunks,
    labels = { left: "Yours", result: "Result", right: "Theirs" },
    fileName = "",
    language = "plain",
    height = "fill",
    label,
    extensions = [],
    onapply,
    onignore,
  }: Props = $props();

  const shownHeight = $derived(height === "fill" ? null : presetVar("viewHeight", height));

  const hosts: Record<ChunkSide, HTMLDivElement | null> = $state({ left: null, result: null, right: null });
  const views: Partial<Record<ChunkSide, EditorView>> = {};
  let panesEl = $state<HTMLDivElement | null>(null);
  let leftRibbons = $state<ConnectorRibbon[]>([]);
  let rightRibbons = $state<ConnectorRibbon[]>([]);
  let syncing = false;

  /** The top and bottom of lines [start, end) of a pane, relative to the panes. */
  function span(side: ChunkSide, [start, end]: [number, number]): [number, number] {
    const view = views[side];
    if (!view || !panesEl) {
      return [0, 0];
    }
    const base = panesEl.getBoundingClientRect().top;
    const doc = view.state.doc;
    const top = (line: number) => {
      const clamped = Math.min(Math.max(line, 0), doc.lines - 1);
      const block = view.lineBlockAt(doc.line(clamped + 1).from);
      const edge = line >= doc.lines ? block.bottom : block.top;
      return edge + view.documentTop - base;
    };
    return [top(start), end > start ? top(end - 1) + view.defaultLineHeight : top(start)];
  }

  function measure(): void {
    leftRibbons = chunks.map((chunk, index) => {
      const [aTop, aBottom] = span("left", chunk.left);
      const [bTop, bBottom] = span("result", chunk.result);
      return { index, kind: chunk.kind, aTop, aBottom, bTop, bBottom };
    });
    rightRibbons = chunks.map((chunk, index) => {
      const [aTop, aBottom] = span("result", chunk.result);
      const [bTop, bBottom] = span("right", chunk.right);
      return { index, kind: chunk.kind, aTop, aBottom, bTop, bBottom };
    });
  }

  function syncScroll(from: ChunkSide): void {
    if (syncing) {
      return;
    }
    syncing = true;
    const top = views[from]?.scrollDOM.scrollTop ?? 0;
    for (const side of ["left", "result", "right"] as const) {
      if (side !== from && views[side]) {
        views[side].scrollDOM.scrollTop = top;
      }
    }
    syncing = false;
    requestAnimationFrame(measure);
  }

  onMount(async () => {
    const support = await languageSupport(language);
    for (const side of ["left", "result", "right"] as const) {
      const host = hosts[side];
      if (!host) {
        continue;
      }
      views[side] = new EditorView({
        parent: host,
        doc: side === "left" ? left : side === "right" ? right : result,
        extensions: [
          lineNumbers(),
          syntaxHighlighting(classHighlighter),
          editorTheme,
          mergeTheme,
          support,
          chunkDecorations(side, chunks),
          side === "result" ? [] : [EditorState.readOnly.of(true), EditorView.editable.of(false)],
          EditorView.contentAttributes.of({ "aria-label": `${label}: ${labels[side]}` }),
          EditorView.updateListener.of((update) => {
            if (side === "result" && update.docChanged) {
              result = update.state.doc.toString();
            }
            if (update.geometryChanged || update.docChanged) {
              requestAnimationFrame(measure);
            }
          }),
          ...extensions,
        ],
      });
      views[side].scrollDOM.addEventListener("scroll", () => syncScroll(side));
    }
    requestAnimationFrame(measure);
  });

  $effect(() => {
    const next = chunks;
    for (const view of Object.values(views)) {
      view?.dispatch({ effects: setChunks.of(next) });
    }
    requestAnimationFrame(measure);
  });

  onDestroy(() => Object.values(views).forEach((view) => view?.destroy()));
</script>

<div class="merge" role="region" aria-label={label} style:height={shownHeight} style:flex={shownHeight && "none"}>
  <div class="labels">
    <div class="label" title={labels.left}>{labels.left}</div>
    <div class="label-gap"></div>
    <div class="label result">{labels.result} {#if fileName}<span class="file">{fileName}</span>{/if}</div>
    <div class="label-gap"></div>
    <div class="label theirs" title={labels.right}>{labels.right}</div>
  </div>
  <div class="panes" bind:this={panesEl}>
    <div class="pane" bind:this={hosts.left}></div>
    <MergeConnector
      ribbons={leftRibbons}
      side="left"
      onapply={(index) => onapply?.(index, "left")}
      onignore={(index) => onignore?.(index, "left")}
    />
    <div class="pane result-pane" bind:this={hosts.result}></div>
    <MergeConnector
      ribbons={rightRibbons}
      side="right"
      onapply={(index) => onapply?.(index, "right")}
      onignore={(index) => onignore?.(index, "right")}
    />
    <div class="pane" bind:this={hosts.right}></div>
  </div>
</div>

<style>
  .merge {
    flex: 1;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    min-height: 0;
  }

  .labels {
    flex: none;
    display: flex;
    background: var(--panel-alt);
    border-bottom: 1px solid var(--border-strong);
    font-size: var(--font-size-small);
  }

  .label {
    flex: 1;
    min-width: 0;
    padding: var(--merge-view-label-padding-y) var(--merge-view-label-padding-x);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-weight-semibold);
  }

  .label.result {
    text-align: center;
  }

  .file {
    color: var(--text-dim);
  }

  .label.theirs {
    text-align: right;
  }

  .label-gap {
    flex: none;
    width: var(--merge-view-gap);
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
</style>
