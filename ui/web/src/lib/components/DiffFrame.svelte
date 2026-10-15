<!-- The frame of a diff whose editors the caller builds: the sides' names, a find bar slot over each side (shown
     only while a bar is open, so it never scrolls away with the text), the body the editors go into and the handle
     between the sides. Labels, find bars and editors share `ratio`, so they stay lined up. `controls` keeps a
     column for the change arrows between the sides; `ruler` leaves room for a change overview at the right. -->
<script module lang="ts">
  export interface DiffFrameParts {
    /** Where the editors go: a MergeView or one EditorView. */
    body: HTMLDivElement;
    /** Containers for each side's search panel (CodeMirror `panels({ topContainer })`). */
    findOriginal: HTMLDivElement;
    findModified: HTMLDivElement;
  }
</script>

<script lang="ts">
  import { componentTokens } from "../styles/tokens";
  import Icon from "./Icon.svelte";
  import SplitHandle from "./SplitHandle.svelte";

  interface Props {
    layout?: "split" | "inline";
    label: string;
    sideLabels?: { original: string; modified: string } | null;
    controls?: boolean;
    ruler?: boolean;
    ratio?: number;
    oncommitratio?: (ratio: number) => void;
    onready?: (parts: DiffFrameParts) => void | (() => void);
    oncontextmenu?: (event: MouseEvent) => void;
  }

  let {
    layout = "split",
    label,
    sideLabels = null,
    controls = false,
    ruler = false,
    ratio = $bindable(0.5),
    oncommitratio,
    onready,
    oncontextmenu,
  }: Props = $props();

  let body = $state<HTMLDivElement | null>(null);
  let findOriginal = $state<HTMLDivElement | null>(null);
  let findModified = $state<HTMLDivElement | null>(null);
  const gutter = $derived(controls ? componentTokens.diffFrame.controls : 0);

  // The parts stay the same across layouts, so switching layout never hands out new elements.
  $effect(() => {
    if (body && findOriginal && findModified && onready) {
      return onready({ body, findOriginal, findModified }) ?? undefined;
    }
  });
</script>

<div class="frame" role="region" aria-label={label} style:--diff-left={ratio} style:--diff-right={1 - ratio}>
  {#if sideLabels}
    <div class="labels" class:controls>
      {#if layout === "inline"}
        <span class="label joined" title="{sideLabels.original} to {sideLabels.modified}">
          <span class="name">{sideLabels.original}</span>
          <Icon name="arrow-right" size="small" />
          <span class="name">{sideLabels.modified}</span>
        </span>
      {:else}
        <span class="label name" title={sideLabels.original}>{sideLabels.original}</span>
        <span class="gap"></span>
        <span class="label name" title={sideLabels.modified}>{sideLabels.modified}</span>
      {/if}
    </div>
  {/if}
  <div class="find-bars" class:controls class:inline={layout === "inline"}>
    <div class="find-host" bind:this={findOriginal}></div>
    <span class="gap"></span>
    <div class="find-host" bind:this={findModified}></div>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="body" class:ruler bind:this={body} {oncontextmenu}>
    {#if layout === "split"}
      <SplitHandle bind:ratio {gutter} label="Resize the two sides of the diff" oncommit={oncommitratio} />
    {/if}
  </div>
</div>

<style>
  .frame {
    flex: 1;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    width: 100%;
    background: var(--editor-bg);
  }

  .labels {
    flex: none;
    display: flex;
    align-items: center;
    height: var(--diff-labels-height);
    border-bottom: 1px solid var(--border);
    background: var(--panel-alt);
    color: var(--text-dim);
    font-size: var(--font-size-compact);
  }

  .label {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 var(--diff-labels-padding-x);
  }

  .joined {
    display: flex;
    align-items: center;
    gap: var(--diff-labels-gap);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gap {
    flex: none;
    width: 1px;
    align-self: stretch;
    background: var(--border-strong);
  }

  .controls .gap {
    width: var(--diff-frame-controls);
    background: transparent;
  }

  .labels.controls .gap {
    border-left: 1px solid var(--border-strong);
    border-right: 1px solid var(--border-strong);
  }

  /* The labels, find bars and editors share the split. */
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

  /* Shown only while a side's find bar is open; inline has one bar, over the whole width. */
  .find-bars {
    flex: none;
    display: flex;
    background: var(--panel);
  }

  .find-bars:not(:has(:global(.cm-panels))) {
    display: none;
  }

  .find-bars.inline .find-host:first-child,
  .find-bars.inline .gap {
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

  .body {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .body :global(.cm-mergeView) {
    position: absolute;
    inset: 0;
    overflow-y: auto;
  }

  /* One editor (inline) scrolls itself; with a ruler it stops short of it. */
  .body > :global(.cm-editor) {
    position: absolute;
    inset: 0;
  }

  .ruler > :global(.cm-editor) {
    right: var(--diff-frame-ruler);
  }

  .body :global(.cm-mergeViewEditor + .cm-mergeViewEditor) {
    border-left: 1px solid var(--border-strong);
  }

  .body :global(.cm-merge-revert) {
    width: var(--diff-frame-controls);
    background: var(--panel-alt);
    border-left: 1px solid var(--border-strong);
    border-right: 1px solid var(--border-strong);
  }

  .body :global(.cm-merge-revert .diff-revert) {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--diff-frame-revert-height);
    padding: 0;
    border-radius: var(--diff-frame-revert-radius);
    color: var(--accent);
  }

  .body :global(.cm-merge-revert .diff-revert:hover) {
    background: var(--hover);
    color: var(--accent-hover);
  }

  .body :global(.cm-merge-revert .diff-revert svg) {
    pointer-events: none;
  }
</style>
