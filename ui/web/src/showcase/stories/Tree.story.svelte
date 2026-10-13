<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import Tree from "$ui/components/Tree.svelte";
  import type { TreeDecoration, TreeNode } from "$ui/logic/treeModel";

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
        { id: "src/old.ts", label: "old.ts" },
      ],
    },
    { id: "gen", label: "generated (2,000 files)", children: many },
    { id: "README.md", label: "README.md" },
  ];
  const STATUS: Record<string, TreeDecoration> = {
    "src/lib/cart.ts": { tone: "accent", badge: "M" },
    "src/main.ts": { tone: "success", badge: "A" },
    "src/old.ts": { tone: "danger", strike: true, badge: "D" },
  };

  let expanded = $state(["src", "src/lib"]);
  let selected = $state<string | null>("src/lib/cart.ts");
  let selection = $state<string[]>(["src/lib/cart.ts"]);
  let renaming = $state<string | null>(null);
  let note = $state(
    "Cmd-click and Shift-click select more. F2 renames. Drag rows onto a folder (Option copies, Escape cancels).",
  );
</script>

<Stack gap="sm">
  <div
    role="presentation"
    onkeydown={(event) => event.key === "F2" && selected && (renaming = selected)}
  >
    <Tree
      label="Files"
      {nodes}
      height="medium"
      multiple
      draggable
      bind:expanded
      bind:selected
      bind:selection
      bind:renaming
      decorate={(node) => STATUS[node.id] ?? null}
      onopen={(node) => (note = `Opened ${node.label}`)}
      onrename={(node, name) => (note = `Renamed ${node.label} to ${name}`)}
      ondrop={(ids, target, mode) =>
        (note = `${mode === "copy" ? "Copied" : "Moved"} ${ids.length} into ${target?.label ?? "the top"}`)}
    />
  </div>
  <Text tone="dim">{note} Selected: {selection.length}</Text>
</Stack>
