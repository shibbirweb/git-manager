<!-- Release notes rendered from Markdown; links open in the browser. -->
<script lang="ts">
  import MarkdownView from "@git-manager/ui/components/MarkdownView.svelte";
  import { renderMarkdown } from "./markdown";
  import { updates } from "./updates.svelte";

  let { markdown }: { markdown: string } = $props();
</script>

<!-- renderMarkdown escapes all input and only emits a fixed set of tags. -->
<MarkdownView
  label="Release notes"
  variant="notes"
  source={markdown || "No notes for this release."}
  render={renderMarkdown}
  onlink={(href) => void updates.open(href)}
/>
