<!-- Rendered Markdown in the app's preview typography: headings, lists, task lists, tables, code and quotes. The
     library renders with markdown-it and sanitizes the HTML; the app passes its own engine (highlighting, mermaid,
     local images) as `render`. -->
<script lang="ts">
  import DOMPurify from "dompurify";
  import MarkdownIt from "markdown-it";
  import { useTaskLists } from "../logic/markdownTasks";
  import "../styles/markdown.css";
  import "../styles/markdown-notes.css";

  interface Props {
    source: string;
    label: string;
    render?: (source: string) => string;
    variant?: "document" | "notes";
    ontoggle?: (line: number) => void;
    onlink?: (href: string) => void;
  }

  let { source, label, render, variant = "document", ontoggle, onlink }: Props = $props();

  const markdown = new MarkdownIt({ html: true, linkify: true });
  useTaskLists(markdown);
  const html = $derived(DOMPurify.sanitize(render ? render(source) : markdown.render(source)));

  // The source decides: a task box asks to edit its line and stays as written until the source changes.
  function click(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const checkbox = target?.closest("input[type='checkbox']");
    if (checkbox) {
      event.preventDefault();
      const line = checkbox.getAttribute("data-task-line");
      if (line !== null) {
        ontoggle?.(Number(line));
      }
      return;
    }
    const link = target?.closest("a");
    if (link && onlink) {
      event.preventDefault();
      onlink(link.getAttribute("href") ?? "");
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article
  class="selectable"
  class:md-body={variant === "document"}
  class:md-notes={variant === "notes"}
  aria-label={label}
  onclick={click}
>
  {@html html}
</article>

<style>
  .selectable {
    user-select: text;
    -webkit-user-select: text;
  }
</style>
