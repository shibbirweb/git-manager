<script lang="ts">
  import MarkdownView from "$ui/components/MarkdownView.svelte";
  import Text from "$ui/components/Text.svelte";

  let source = $state(
    [
      "# Storefront",
      "",
      "A small shop that runs on **Svelte** and `Rust`. See the [guide](https://example.com).",
      "",
      "## Tasks",
      "",
      "- [x] Cart",
      "- [ ] Checkout",
      "",
      "> Ship the beta before Friday.",
      "",
      "| Branch | State |",
      "| --- | --- |",
      "| main | clean |",
      "| feat/cart | 2 ahead |",
      "",
      "```ts",
      'export const total = (items: number[]) => items.reduce((sum, item) => sum + item, 0);',
      "```",
    ].join("\n"),
  );
  let clicked = $state("Click a task box or the link");

  function toggle(line: number): void {
    const lines = source.split("\n");
    lines[line] = lines[line].replace(/\[( |x)\]/, (_, mark) => (mark === " " ? "[x]" : "[ ]"));
    source = lines.join("\n");
    clicked = `Toggled line ${line + 1}`;
  }
</script>

<Text tone="dim">{clicked}</Text>
<MarkdownView label="README.md" {source} ontoggle={toggle} onlink={(href) => (clicked = `Open ${href}`)} />
