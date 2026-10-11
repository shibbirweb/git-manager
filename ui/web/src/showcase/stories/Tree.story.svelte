<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import Tree from "$ui/components/Tree.svelte";
  import type { TreeNode } from "$ui/logic/treeModel";

  const many = Array.from({ length: 2000 }, (_, index) => ({
    id: `gen/file-${index}.ts`,
    label: `file-${index}.ts`,
  }));
  const nodes: TreeNode[] = [
    {
      id: "src",
      label: "src",
      children: [
        { id: "src/lib", label: "lib", children: [{ id: "src/lib/cart.ts", label: "cart.ts" }] },
        { id: "src/main.ts", label: "main.ts" },
      ],
    },
    { id: "gen", label: "generated (2,000 files)", children: many },
    { id: "README.md", label: "README.md" },
  ];

  let expanded = $state(["src", "src/lib"]);
  let selected = $state<string | null>("src/lib/cart.ts");
  let opened = $state("nothing yet");
</script>

<Stack gap="sm">
  <Tree label="Files" {nodes} height={260} bind:expanded bind:selected onopen={(node) => (opened = node.label)} />
  <Text tone="dim">Opened: {opened}. Arrows move, Right and Left open and close, Enter opens.</Text>
</Stack>
