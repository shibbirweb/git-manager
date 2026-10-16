<script lang="ts">
  import { LanguageSupport } from "@codemirror/language";
  import Card from "$ui/components/Card.svelte";
  import MarkdownPreview from "$ui/components/MarkdownPreview.svelte";
  import Text from "$ui/components/Text.svelte";
  import { languageSupport, type CodeLanguage } from "$ui/editor/languages";
  import type { LinkTarget } from "$ui/markdown/links";

  let source = $state(
    [
      "# Storefront",
      "",
      "A small shop on **Svelte** and `Rust`. See the [guide](https://example.com) or [Tasks](#tasks).",
      "",
      "## Tasks",
      "",
      "- [x] Cart",
      "- [ ] Checkout",
      "",
      "| Branch | State |",
      "| --- | --- |",
      "| main | clean |",
      "| feat/cart | 2 ahead |",
      "",
      "```ts",
      "export const total = (items: number[]) => items.reduce((sum, item) => sum + item, 0);",
      "```",
    ].join("\n"),
  );
  let docVersion = $state(0);
  let said = $state("Click a task box or a link");

  const languages: Record<string, CodeLanguage> = { ts: "ts", js: "js", json: "json", rs: "rust", py: "python" };

  async function loadParser(extension: string) {
    const support = await languageSupport(languages[extension] ?? "plain");
    return support instanceof LanguageSupport ? support.language.parser : null;
  }

  function toggle(lineIndex: number): void {
    const lines = source.split("\n");
    lines[lineIndex] = lines[lineIndex].replace(/\[( |x)\]/, (_, mark) => (mark === " " ? "[x]" : "[ ]"));
    source = lines.join("\n");
    docVersion += 1;
    said = `Toggled line ${lineIndex + 1}`;
  }

  function open(target: LinkTarget): void {
    said = target.kind === "external" ? `Open ${target.url}` : `Open ${target.kind} link`;
  }
</script>

<Text tone="dim">{said}</Text>
<Card label="Preview">
  <MarkdownPreview
    label="README.md"
    {docVersion}
    getSource={() => source}
    view={null}
    visible
    syncScroll={false}
    initialLine={0}
    highlighting
    {loadParser}
    linkContext={() => ({ documentPath: "/demo/README.md", rootPath: "/demo", isInWorkspace: () => false })}
    loadImage={() => Promise.reject(new Error("No files in the showcase"))}
    isDark={() => document.documentElement.getAttribute("data-theme") === "dark"}
    onlink={open}
    ontoggletask={toggle}
  />
</Card>
