<!-- Two versions of a text compared: side by side (`split`) or in one column with the removed lines above the ones
     that replace them (`inline`), in the app's diff colors. Read-only; the app adds staging and its other diff
     features through `extensions`. -->
<script lang="ts">
  import { MergeView, unifiedMergeView } from "@codemirror/merge";
  import { syntaxHighlighting } from "@codemirror/language";
  import { EditorState, type Extension } from "@codemirror/state";
  import { EditorView, lineNumbers } from "@codemirror/view";
  import { classHighlighter } from "@lezer/highlight";
  import { onDestroy } from "svelte";
  import { languageSupport, type CodeLanguage } from "../editor/languages";
  import { diffTheme, editorTheme } from "../editor/theme";
  import { presetVar, type ViewHeight } from "../logic/presets";
  import Icon from "./Icon.svelte";
  import SplitHandle from "./SplitHandle.svelte";

  interface Props {
    original: string;
    modified: string;
    layout?: "split" | "inline";
    language?: CodeLanguage;
    height?: ViewHeight;
    label: string;
    sideLabels?: { original: string; modified: string } | null;
    ratio?: number;
    oncommitratio?: (ratio: number) => void;
    extensions?: Extension[];
  }

  let {
    original,
    modified,
    layout = "split",
    language = "plain",
    height = "fill",
    label,
    sideLabels = null,
    ratio = $bindable(0.5),
    oncommitratio,
    extensions = [],
  }: Props = $props();

  let host = $state<HTMLDivElement | null>(null);
  let teardown: (() => void) | null = null;

  async function build(): Promise<void> {
    teardown?.();
    teardown = null;
    if (!host) {
      return;
    }
    const target = host;
    const support = await languageSupport(language);
    const common = [
      lineNumbers(),
      syntaxHighlighting(classHighlighter),
      editorTheme,
      diffTheme,
      support,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      ...extensions,
    ];
    if (layout === "split") {
      const merge = new MergeView({
        a: { doc: original, extensions: common },
        b: { doc: modified, extensions: common },
        parent: target,
        gutter: true,
        highlightChanges: true,
      });
      teardown = () => merge.destroy();
    } else {
      const view = new EditorView({
        parent: target,
        doc: modified,
        extensions: [...common, unifiedMergeView({ original, mergeControls: false, gutter: true })],
      });
      teardown = () => view.destroy();
    }
  }

  $effect(() => {
    void [original, modified, layout, language, host];
    void build();
  });

  onDestroy(() => teardown?.());
</script>

<div
  class="frame"
  role="region"
  aria-label={label}
  style:height={height === "fill" ? null : presetVar("viewHeight", height)}
  style:flex={height === "fill" ? null : "none"}
>
  <!-- The two sides' names over the panes; inline shows "old -> new" in one label. -->
  {#if sideLabels}
    <div class="labels">
      {#if layout === "inline"}
        <span class="label inline" title="{sideLabels.original} to {sideLabels.modified}">
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
  <div class="body" style:--diff-left={ratio} style:--diff-right={1 - ratio}>
    <div class="diff" bind:this={host}></div>
    {#if layout === "split"}
      <SplitHandle bind:ratio label="Resize the sides" oncommit={(value) => oncommitratio?.(value)} />
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

  .inline {
    display: flex;
    align-items: center;
    gap: var(--diff-labels-gap);
  }

  .name {
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

  .body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .body :global(.cm-mergeViewEditor:first-child) {
    flex-grow: var(--diff-left, 1);
  }

  .body :global(.cm-mergeViewEditor:last-child) {
    flex-grow: var(--diff-right, 1);
  }

  .diff {
    flex: 1;
    align-self: stretch;
    min-width: 0;
    min-height: 0;
    width: 100%;
    overflow: auto;
    background: var(--editor-bg);
  }

  .diff :global(.cm-mergeView),
  .diff :global(.cm-editor) {
    height: 100%;
  }

  .diff :global(.cm-mergeViewEditor + .cm-mergeViewEditor) {
    border-left: 1px solid var(--border-strong);
  }
</style>
