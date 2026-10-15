<!-- The library side of the tab and terminal parity cases (cases/tabs.ts). -->
<script lang="ts">
  import Divider from "$ui/components/Divider.svelte";
  import EditorTab from "$ui/components/EditorTab.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import TabStrip from "$ui/components/TabStrip.svelte";
  import Text from "$ui/components/Text.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";

  let { id }: { id: string } = $props();
  const none = () => undefined;
  const cart = { id: "cart", label: "cart.ts", icon: "file" as const };
  const tax = { id: "tax", label: "tax.ts", icon: "file" as const };
</script>

{#if id === "tabs-wrap"}
  <div style="width: 300px">
    <TabStrip label="Tabs" layout="wrap" tabs={[cart, tax]} active="cart" onclose={none} />
  </div>
{:else if id === "tabs-single"}
  <div style="width: 400px"><TabStrip label="Tabs" layout="single" tabs={[cart]} active="cart" onclose={none} /></div>
{:else if id === "tabs-unfocused"}
  <TabStrip label="Tabs" focused={false} tabs={[cart, { ...tax, pinned: true }]} active="cart" onclose={none} />
{:else if id === "tab-lifted"}
  <div class="tab-strip" role="tablist" aria-label="Tabs"><EditorTab tab={cart} lifted closable /></div>
{:else if id === "new-tab"}
  <TabStrip label="Tabs" tabs={[cart]} active="cart" onclose={none} onnew={none} newLabel="New agent" />
{:else if id === "run-tools"}
  <IconButton icon="refresh" label="Rerun" iconSize="normal" tone="success" />
  <IconButton icon="stop" label="Stop" iconSize="normal" tone="danger" />
{/if}
