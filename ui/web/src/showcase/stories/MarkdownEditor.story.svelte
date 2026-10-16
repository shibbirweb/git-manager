<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import MarkdownEditor from "$ui/components/MarkdownEditor.svelte";
  import Text from "$ui/components/Text.svelte";
  import type { LinkTarget } from "$ui/markdown/links";
  import { applyEdit, type SourceEdit } from "$ui/markdown/richSync";

  let source = $state(
    [
      "# Release notes",
      "",
      "Type here. **Bold**, *italic* and `code` work, and so do [links](https://example.com).",
      "",
      "- [x] Cart",
      "- [ ] Checkout",
    ].join("\n"),
  );
  let said = $state("Edit the text, or Cmd+click the link");

  function edit(change: SourceEdit): void {
    source = applyEdit(source, change);
    said = `${source.length} characters in the source`;
  }

  function open(target: LinkTarget): void {
    said = target.kind === "external" ? `Open ${target.url}` : `Open ${target.kind} link`;
  }
</script>

<Text tone="dim">{said}</Text>
<Card label="Rich editor">
  <MarkdownEditor
    label="Release notes"
    docVersion={0}
    getSource={() => source}
    initialScroll={0}
    linkContext={() => ({ documentPath: "/demo/NOTES.md", rootPath: "/demo", isInWorkspace: () => false })}
    loadImage={() => Promise.reject(new Error("No files in the showcase"))}
    isDark={() => document.documentElement.getAttribute("data-theme") === "dark"}
    onedit={edit}
    onlink={open}
  />
</Card>
