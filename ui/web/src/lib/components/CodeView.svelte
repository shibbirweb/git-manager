<!-- Read-only, highlighted code with line numbers and a Copy button, in CodeMirror like the app's editors and
     colored by the theme's syntax tokens. Use it to show code or output, never for editing. -->
<script lang="ts">
  import { html } from "@codemirror/lang-html";
  import { javascript } from "@codemirror/lang-javascript";
  import { markdown } from "@codemirror/lang-markdown";
  import { syntaxHighlighting } from "@codemirror/language";
  import { EditorState } from "@codemirror/state";
  import { EditorView, lineNumbers } from "@codemirror/view";
  import { classHighlighter } from "@lezer/highlight";
  import { onDestroy } from "svelte";

  interface Props {
    source: string;
    language?: "svelte" | "html" | "ts" | "js" | "md" | "plain";
    lineNumbers?: boolean;
    copy?: boolean;
    maxHeight?: number | null;
  }

  let { source, language = "plain", lineNumbers: numbered = true, copy: canCopy = true, maxHeight = 520 }: Props =
    $props();
  let host = $state<HTMLDivElement | null>(null);
  let copied = $state(false);
  let view: EditorView | null = null;

  function languageSupport() {
    if (language === "md") {
      return [markdown()];
    }
    if (language === "ts" || language === "js") {
      return [javascript({ typescript: language === "ts" })];
    }
    return language === "plain" ? [] : [html()];
  }

  $effect(() => {
    view?.destroy();
    if (!host) {
      return;
    }
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: source,
        extensions: [
          numbered ? lineNumbers() : [],
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          languageSupport(),
          syntaxHighlighting(classHighlighter),
        ],
      }),
    });
  });

  onDestroy(() => view?.destroy());

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(source);
    copied = true;
    setTimeout(() => (copied = false), 1200);
  }
</script>

<div class="code" style:--code-view-max-height={maxHeight === null ? "none" : `${maxHeight}px`}>
  {#if canCopy}
    <button class="copy" type="button" onclick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
  {/if}
  <div class="host" bind:this={host}></div>
</div>

<style>
  .code {
    position: relative;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-menu);
    overflow: hidden;
    background: var(--editor-bg);
  }

  .host :global(.cm-editor) {
    max-height: var(--code-view-max-height);
  }

  /* On the scroller, where CodeMirror's base theme sets its own font, so text and line numbers measure alike. */
  .host :global(.cm-scroller) {
    overflow: auto;
    font-family: var(--font-mono);
    font-size: var(--code-size);
    line-height: 1.5;
  }

  .host :global(.cm-gutters) {
    background: var(--editor-gutter);
    color: var(--editor-line-number);
    border: none;
  }

  .copy {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 2;
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-small);
    background: var(--panel);
    color: var(--text-dim);
    font-size: var(--font-size-xsmall);
    cursor: pointer;
  }

  .copy:hover {
    color: var(--text);
  }
</style>
