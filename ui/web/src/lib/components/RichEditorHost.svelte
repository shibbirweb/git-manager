<!-- The page a rich Markdown editor (TipTap / ProseMirror) is mounted into, in the preview's typography: a
     scrolling document, a status line while it loads, and a notice when the file is read-only. The app creates
     the editor on the element handed to `onready`; `page` is the scrolling page (its scroll position, the focus
     while read-only), and its clicks and keys go to `onclick` and `onkeydown` (links, Cmd+S). The `preview` variant
     is the read-only preview's page instead: no editor rules, a tab stop for scrolling with keys, and raw HTML in
     the document can never draw outside it. -->
<script lang="ts">
  import { onMount } from "svelte";
  import "../styles/markdown.css";
  import "../styles/markdown-rich.css";

  interface Props {
    label: string;
    status?: string;
    notice?: string;
    onready: (element: HTMLDivElement) => void;
    variant?: "editor" | "preview";
    page?: HTMLDivElement | null;
    onclick?: (event: MouseEvent) => void;
    onauxclick?: (event: MouseEvent) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    onscroll?: (event: Event) => void;
  }

  let {
    label,
    status = "",
    notice = "",
    onready,
    variant = "editor",
    page = $bindable(null),
    onclick,
    onauxclick,
    onkeydown,
    onscroll,
  }: Props = $props();

  let body = $state<HTMLDivElement | null>(null);

  onMount(() => {
    if (body) {
      onready(body);
    }
  });
</script>

<!-- The page delegates clicks to links and task boxes inside it; the preview takes Tab so keys scroll it. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="rich-markdown"
  class:preview={variant === "preview"}
  role="document"
  aria-label={label}
  tabindex={variant === "preview" ? 0 : -1}
  bind:this={page}
  {onclick}
  {onauxclick}
  {onkeydown}
  {onscroll}
>
  {#if status}<p class="status">{status}</p>{/if}
  {#if notice}<p class="notice">{notice}</p>{/if}
  <div class="md-body selectable" class:md-rich={variant === "editor"} bind:this={body}></div>
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

  .preview {
    contain: layout paint;
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
