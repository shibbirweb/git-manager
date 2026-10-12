<!-- The library side of the row and view state parity cases (cases/states.ts). -->
<script lang="ts">
  import IconButton from "$ui/components/IconButton.svelte";
  import SidebarRow from "$ui/components/SidebarRow.svelte";
  import TerminalView from "$ui/components/TerminalView.svelte";
  import Tree from "$ui/components/Tree.svelte";
  import TreeRow from "$ui/components/TreeRow.svelte";
  import type { TreeDecoration } from "$ui/logic/treeModel";

  let { id }: { id: string } = $props();
  const none = () => undefined;
  const files = [
    { id: "cut", label: "cart.ts" },
    { id: "ignored", label: "dist" },
    { id: "root", label: "storefront" },
    { id: "lfs", label: "tax.ts" },
  ];
  const decorations: Record<string, TreeDecoration> = {
    cut: { cut: true },
    ignored: { ignored: true },
    root: { root: true },
    lfs: { tag: "LFS" },
  };
</script>

{#if id === "tree-states"}
  <div style="width: 300px; height: 120px; display: flex">
    <Tree
      label="Files"
      nodes={files}
      iconFor={() => "file"}
      decorate={(node) => decorations[node.id] ?? null}
    />
  </div>
  <div role="tree" aria-label="Drop" style="width: 300px">
    <TreeRow
      row={{ node: { id: "drop", label: "tax.ts" }, depth: 1, parent: null, isFolder: false, expanded: false }}
      icon="file"
      selected={false}
      focused={false}
      decoration={null}
      renaming={false}
      draggable={false}
      dropTarget
      onclick={none}
      ondblclick={none}
      oncontextmenu={none}
      onrename={none}
      ondragstart={none}
      ondragover={none}
      ondrop={none}
    />
  </div>
{:else if id === "tree-drop-root"}
  <div style="width: 300px; height: 80px; display: flex">
    <Tree label="Files" nodes={[]} dropRoot />
  </div>
{:else if id === "sidebar-stash"}
  <div role="tree" aria-label="Stashes" style="width: 300px">
    <SidebarRow label="WIP on main" icon="stash" detail="stash@{0}" selected>
      {#snippet actions()}
        <IconButton icon="check" label="Apply" size="mini" tone="dim" iconSize="medium" />
        <IconButton icon="x" label="Drop" size="mini" tone="dim-danger" iconSize="medium" />
      {/snippet}
    </SidebarRow>
  </div>
{:else if id === "sidebar-worktree"}
  <div role="tree" aria-label="Worktrees" style="width: 300px">
    <SidebarRow label="feature" icon="folder-git" path="~/wt/feature" detail="prunable" gone />
  </div>
{:else if id === "shelf-actions"}
  <span class="actions" style="display: flex">
    <IconButton icon="arrow-up" label="Unshelve" size="mini" tone="dim" iconSize="medium" />
    <IconButton icon="trash" label="Delete" size="mini" tone="dim-danger" iconSize="medium" />
  </span>
{:else if id === "terminal-drop"}
  <TerminalView label="Terminal" height="small" dropTarget />
{/if}
