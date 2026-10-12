<!-- The page a rich Markdown editor (TipTap / ProseMirror) is mounted into, in the preview's typography: a
     scrolling document, a status line while it loads, and a notice when the file is read-only. The app creates
     the editor on the element handed to `onready`. -->
<script lang="ts">
  import { onMount } from "svelte";
  import "../styles/markdown.css";
  import "../styles/markdown-rich.css";

  interface Props {
    label: string;
    status?: string;
    notice?: string;
    onready: (element: HTMLDivElement) => void;
  }

  let { label, status = "", notice = "", onready }: Props = $props();

  let body = $state<HTMLDivElement | null>(null);

  onMount(() => {
    if (body) {
      onready(body);
    }
  });
</script>

<div class="rich-markdown" role="document" aria-label={label}>
  {#if status}<p class="status">{status}</p>{/if}
  {#if notice}<p class="notice">{notice}</p>{/if}
  <div class="md-body md-rich selectable" bind:this={body}></div>
</div>

<style>
  .rich-markdown {
    flex: 1;
    align-self: stretch;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    background: var(--editor-bg);
    color: var(--text);
    outline: none;
  }

  .status {
    margin: var(--rich-editor-status-margin-y) var(--rich-editor-status-margin-x);
    color: var(--text-dim);
  }

  .notice {
    max-width: var(--rich-editor-notice-max-width);
    margin: var(--rich-editor-notice-top) auto 0;
    padding: var(--space-4) var(--space-6);
    border: 1px solid color-mix(in srgb, var(--warning) 45%, transparent);
    border-radius: var(--radius-control);
    background: color-mix(in srgb, var(--warning) 10%, transparent);
    color: var(--text);
    font-size: var(--font-size-small);
  }

  .selectable {
    user-select: text;
    -webkit-user-select: text;
  }
</style>
