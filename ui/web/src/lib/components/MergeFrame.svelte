<!-- The frame of a 3-way merge: the three panes' titles, the three panes that MergeView (or the app's merge tool)
     fills with editors, and the connector columns between them. It draws no editor: `onready` hands over the pane
     elements and the box the ribbons are measured from, and the ribbons come back as props. Without `onapply` and
     `onignore` the connectors draw ribbons alone, for a read-only 3-pane diff such as a merge commit's; `colors` picks
     each connector's ribbon colors (by kind, or red to green from the older pane to the newer). -->
<script module lang="ts">
  export interface MergeFrameParts {
    left: HTMLDivElement;
    result: HTMLDivElement;
    right: HTMLDivElement;
    /** The ribbons' tops are measured from this box's top. */
    panes: HTMLDivElement;
  }
</script>

<script lang="ts">
  import { presetVar, type ViewHeight } from "../logic/presets";
  import MergeConnector, { type ConnectorColors, type ConnectorRibbon } from "./MergeConnector.svelte";

  interface Props {
    label: string;
    labels?: { left: string; result: string; right: string };
    fileName?: string;
    height?: ViewHeight;
    leftRibbons?: ConnectorRibbon[];
    rightRibbons?: ConnectorRibbon[];
    onapply?: (index: number, side: "left" | "right") => void;
    onignore?: (index: number, side: "left" | "right") => void;
    applyTitles?: { left: string; right: string } | null;
    colors?: { left: ConnectorColors; right: ConnectorColors };
    onready?: (parts: MergeFrameParts) => void | (() => void);
  }

  let {
    label,
    labels = { left: "Yours", result: "Result", right: "Theirs" },
    fileName = "",
    height = "fill",
    leftRibbons = [],
    rightRibbons = [],
    onapply,
    onignore,
    applyTitles = null,
    colors = { left: "kinds", right: "kinds" },
    onready,
  }: Props = $props();

  const shownHeight = $derived(height === "fill" ? null : presetVar("viewHeight", height));
  let left = $state<HTMLDivElement | null>(null);
  let result = $state<HTMLDivElement | null>(null);
  let right = $state<HTMLDivElement | null>(null);
  let panes = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (left && result && right && panes && onready) {
      return onready({ left, result, right, panes }) ?? undefined;
    }
  });
</script>

<div class="merge" role="region" aria-label={label} style:height={shownHeight} style:flex={shownHeight && "none"}>
  <div class="labels">
    <div class="label" title={labels.left}>{labels.left}</div>
    <div class="label-gap"></div>
    <div class="label result">
      {labels.result}
      {#if fileName}<span class="file">{fileName}</span>{/if}
    </div>
    <div class="label-gap"></div>
    <div class="label theirs" title={labels.right}>{labels.right}</div>
  </div>
  <div class="panes" bind:this={panes}>
    <div class="pane" bind:this={left}></div>
    <MergeConnector
      ribbons={leftRibbons}
      side="left"
      onapply={onapply ? (index) => onapply(index, "left") : undefined}
      applyTitle={applyTitles?.left ?? null}
      onignore={onignore ? (index) => onignore(index, "left") : undefined}
      colors={colors.left}
    />
    <div class="pane result-pane" bind:this={result}></div>
    <MergeConnector
      ribbons={rightRibbons}
      side="right"
      onapply={onapply ? (index) => onapply(index, "right") : undefined}
      applyTitle={applyTitles?.right ?? null}
      onignore={onignore ? (index) => onignore(index, "right") : undefined}
      colors={colors.right}
    />
    <div class="pane" bind:this={right}></div>
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
