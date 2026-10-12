<script lang="ts">
  import EditorTab from "$ui/components/EditorTab.svelte";
  import Stack from "$ui/components/Stack.svelte";
</script>

<Stack direction="row" gap="none">
  <EditorTab tab={{ id: "cart", label: "cart.ts", icon: "file", dirty: true }} active />
  <EditorTab tab={{ id: "readme", label: "README.md", icon: "file", preview: true }} />
</Stack>
