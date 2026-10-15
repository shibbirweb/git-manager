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
  import DiffFrame from "./DiffFrame.svelte";

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
  style:height={height === "fill" ? null : presetVar("viewHeight", height)}
  style:flex={height === "fill" ? null : "none"}
>
  <DiffFrame
    {layout}
    {label}
    {sideLabels}
    bind:ratio
    oncommitratio={(value) => oncommitratio?.(value)}
    onready={(parts) => {
      host = parts.body;
      return () => (host = null);
    }}
  />
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
</style>
