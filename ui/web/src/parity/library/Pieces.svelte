<!-- The library side of the piece parity cases (cases/pieces.ts). -->
<script lang="ts">
  import AppHeader from "$ui/components/AppHeader.svelte";
  import Avatar from "$ui/components/Avatar.svelte";
  import Divider from "$ui/components/Divider.svelte";
  import Logo from "$ui/components/Logo.svelte";
  import PatchView from "$ui/components/PatchView.svelte";
  import ResourceLink from "$ui/components/ResourceLink.svelte";
  import SymbolBadge from "$ui/components/SymbolBadge.svelte";
  import Tile from "$ui/components/Tile.svelte";
  import TreeLine from "$ui/components/TreeLine.svelte";

  let { id }: { id: string } = $props();
  const run = () => undefined;
</script>

{#if id === "patch-view"}
  <PatchView label="Patch" patch={"--- a/cart.ts\n@@ -1 +1 @@\n-a\n+b"} />
{:else if id === "app-header"}
  <AppHeader busy="Fetching">
    {#snippet start()}
      <Divider direction="vertical" />
    {/snippet}
  </AppHeader>
{:else if id === "welcome-pieces"}
  <Logo />
  <Tile icon="folder" label="Open" onclick={run} />
  <ResourceLink icon="book" title="Docs" description="A guide." onclick={run} />
  <Avatar text="SF" shape="tile" color="cyan" />
{:else if id === "symbol-badge"}
  <SymbolBadge letter="C" tone="type" />
{:else if id === "tree-line"}
  <div style="display: flex; height: 24px"><TreeLine position="first" /></div>
{/if}
