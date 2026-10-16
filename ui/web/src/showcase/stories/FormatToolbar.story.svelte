<script lang="ts">
  import FormatToolbar, { type FormatTool } from "$ui/components/FormatToolbar.svelte";
  import Text from "$ui/components/Text.svelte";

  const items: (FormatTool | null)[] = [
    { id: "heading", icon: "heading", label: "Heading", menu: true },
    null,
    { id: "bold", icon: "bold", label: "Bold" },
    { id: "italic", icon: "italic", label: "Italic" },
    { id: "strike", icon: "strikethrough", label: "Strikethrough" },
    { id: "code", icon: "code", label: "Inline code" },
    { id: "link", icon: "link", label: "Link" },
    null,
    { id: "list", icon: "list", label: "Bulleted list" },
    { id: "ordered", icon: "list-ordered", label: "Numbered list" },
    { id: "tasks", icon: "list-checks", label: "Task list" },
    null,
    { id: "quote", icon: "quote", label: "Quote" },
    { id: "block", icon: "code-block", label: "Code block" },
    { id: "table", icon: "table", label: "Table", disabled: true },
  ];
  let last = $state("Press a tool");
</script>

<FormatToolbar label="Format" {items} onaction={(id) => (last = `Pressed ${id}`)} />
<Text tone="dim">{last}</Text>
