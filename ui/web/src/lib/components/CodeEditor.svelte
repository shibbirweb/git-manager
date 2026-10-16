<!-- A code editor in the app's editor look: line numbers, the active line, selection and syntax colors from the
     theme. `value` binds the text. The app adds its editor features (blame, find, folding...) through
     `extensions`; the library's own languages load by name. -->
<script lang="ts">
  import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
  import { syntaxHighlighting } from "@codemirror/language";
  import { Compartment, EditorState, type Extension } from "@codemirror/state";
  import {
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    keymap,
    lineNumbers as lineNumberGutter,
  } from "@codemirror/view";
  import { classHighlighter } from "@lezer/highlight";
  import { onDestroy, onMount } from "svelte";
  import { languageSupport, type CodeLanguage } from "../editor/languages";
  import { drawRoundedSelection } from "../editor/selection";
  import { editorTheme } from "../editor/theme";
  import { presetVar, type ViewHeight } from "../logic/presets";

  interface Props {
    value?: string;
    language?: CodeLanguage;
    readOnly?: boolean;
    lineNumbers?: boolean;
    wrap?: boolean;
    height?: ViewHeight;
    label: string;
    extensions?: Extension[];
    onchange?: (value: string) => void;
  }

  let {
    value = $bindable(""),
    language = "plain",
    readOnly = false,
    lineNumbers = true,
    wrap = false,
    height = "fill",
    label,
    extensions = [],
    onchange,
  }: Props = $props();

  let host = $state<HTMLDivElement | null>(null);
  let view: EditorView | null = null;
  const languagePart = new Compartment();
  const readOnlyPart = new Compartment();
  const wrapPart = new Compartment();

  onMount(() => {
    if (!host) {
      return;
    }
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers ? [lineNumberGutter(), highlightActiveLineGutter()] : [],
          drawRoundedSelection(),
          highlightActiveLine(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          syntaxHighlighting(classHighlighter),
          editorTheme,
          languagePart.of([]),
          readOnlyPart.of(EditorState.readOnly.of(readOnly)),
          wrapPart.of(wrap ? EditorView.lineWrapping : []),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              value = update.state.doc.toString();
              onchange?.(value);
            }
          }),
          ...extensions,
        ],
      }),
    });
  });

  $effect(() => {
    const wanted = language;
    void languageSupport(wanted).then((support) => view?.dispatch({ effects: languagePart.reconfigure(support) }));
  });

  $effect(() => {
    view?.dispatch({
      effects: [
        readOnlyPart.reconfigure(EditorState.readOnly.of(readOnly)),
        wrapPart.reconfigure(wrap ? EditorView.lineWrapping : []),
      ],
    });
  });

  // Text set from outside (a reload) replaces the document; typing in the editor already updated `value`.
  $effect(() => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  });

  onDestroy(() => view?.destroy());
</script>

<div
  class="editor"
  bind:this={host}
  style:height={height === "fill" ? null : presetVar("viewHeight", height)}
  style:flex={height === "fill" ? null : "none"}
></div>

<style>
  .editor {
    flex: 1;
    align-self: stretch;
    min-width: 0;
    min-height: 0;
    width: 100%;
    overflow: hidden;
    background: var(--editor-bg);
  }

  .editor :global(.cm-editor) {
    height: 100%;
  }
</style>
