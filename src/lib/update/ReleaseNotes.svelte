<!-- Release notes rendered from Markdown; links open in the browser. -->
<script lang="ts">
  import { renderMarkdown } from "./markdown";
  import { updates } from "./updates.svelte";

  let { markdown }: { markdown: string } = $props();

  const html = $derived(renderMarkdown(markdown || "No notes for this release."));

  function onClick(event: MouseEvent): void {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-external]");
    if (link) {
      event.preventDefault();
      void updates.open(link.href);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="notes selectable" onclick={onClick}>
  <!-- Safe: renderMarkdown escapes all input and only emits a fixed set of tags. -->
  {@html html}
</div>

<style>
  .notes {
    line-height: 1.55;
    font-size: 13px;
  }

  .notes :global(h3),
  .notes :global(h4),
  .notes :global(h5),
  .notes :global(h6) {
    margin: 14px 0 6px;
    font-size: 13px;
    font-weight: 700;
  }

  .notes :global(h3:first-child),
  .notes :global(h4:first-child) {
    margin-top: 0;
  }

  .notes :global(ul) {
    margin: 0 0 8px;
    padding-left: 20px;
  }

  .notes :global(li) {
    margin: 3px 0;
  }

  .notes :global(p) {
    margin: 0 0 8px;
  }

  .notes :global(code) {
    padding: 0 4px;
    border-radius: 4px;
    background: var(--panel-alt);
    font-family: var(--font-mono);
    font-size: 0.92em;
  }

  .notes :global(a) {
    color: var(--accent);
    cursor: pointer;
  }
</style>
