<!-- The library side of the overlay and navigation parity cases (cases/overlays.ts, cases/navigation.ts). -->
<script lang="ts">
  import Breadcrumbs from "$ui/components/Breadcrumbs.svelte";
  import Collapsible from "$ui/components/Collapsible.svelte";
  import Dialog from "$ui/components/Dialog.svelte";
  import Button from "$ui/components/Button.svelte";
  import ListRow from "$ui/components/ListRow.svelte";
  import Menu from "$ui/components/Menu.svelte";
  import Popover from "$ui/components/Popover.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import TabStrip from "$ui/components/TabStrip.svelte";
  import Tabs from "$ui/components/Tabs.svelte";
  import Text from "$ui/components/Text.svelte";
  import Tree from "$ui/components/Tree.svelte";

  let { id }: { id: string } = $props();
  const run = () => undefined;
</script>

{#if id === "dialog"}
  <Dialog open title="Discard all changes?" onclose={run}>
    <Text tone="dim">This cannot be undone.</Text>
    {#snippet actions()}
      <Button onclick={run}>Cancel</Button>
      <Button variant="primary" onclick={run}>OK</Button>
    {/snippet}
  </Dialog>
{:else if id === "menu"}
  <Menu
    x={760}
    y={56}
    keyboard
    onclose={run}
    items={[
      { label: "Open", action: run, hint: "⌘↓" },
      { label: "Rename...", action: run },
      { separator: true },
      { label: "Copy", submenu: [{ label: "Path", action: run }] },
      { label: "Delete", action: run, danger: true },
    ]}
  />
{:else if id === "popover"}
  <Stack direction="row">
    <Popover open label="Keep computer awake" width="small" textSize="small">
      {#snippet trigger()}<span></span>{/snippet}
      Keep computer awake
    </Popover>
  </Stack>
{:else if id === "tab-strip"}
  <TabStrip
    label="Editor tabs"
    active="cart"
    onclose={run}
    tabs={[
      { id: "cart", label: "cart.ts", icon: "file", dirty: true },
      { id: "readme", label: "README.md", icon: "file", preview: true },
      { id: "diff", label: "app.css", icon: "git-compare", hint: "Working Tree" },
    ]}
  />
{:else if id === "tree-row"}
  <Tree
    label="Files"
    height="small"
    expanded={["src"]}
    selected="src"
    focused={false}
    nodes={[{ id: "src", label: "src", children: [{ id: "src/a.ts", label: "a.ts" }] }]}
  />
{:else if id === "list-row"}
  <Stack gap="none">
    <ListRow label="main" description="current" highlighted />
    <ListRow label="develop" />
  </Stack>
{:else if id === "breadcrumbs"}
  <Breadcrumbs
    crumbs={[
      { label: "storefront", icon: "folder-git", kind: "repo" },
      { label: "src" },
      { label: "cart.ts", icon: "file", kind: "file" },
    ]}
  />
{/if}
