<!-- The library side of the window chrome parity cases (cases/chrome.ts). -->
<script lang="ts">
  import AppHeader from "$ui/components/AppHeader.svelte";
  import Button from "$ui/components/Button.svelte";
  import Checkbox from "$ui/components/Checkbox.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import Notice from "$ui/components/Notice.svelte";
  import PickList from "$ui/components/PickList.svelte";
  import ResizeHandle from "$ui/components/ResizeHandle.svelte";
  import Text from "$ui/components/Text.svelte";
  import ToastHost from "$ui/components/ToastHost.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";

  let { id }: { id: string } = $props();
  const none = () => undefined;
  const toasts = [
    {
      id: 1,
      kind: "warning" as const,
      title: "Push rejected",
      detail: "Pull first.",
      action: { label: "Pull", run: none },
    },
  ];
</script>

{#if id === "op-banner"}
  <Notice variant="banner" icon="merge"><strong>Merging</strong> <Text tone="dim">· all resolved</Text></Notice>
  <Notice variant="banner" tone="danger"><strong>Merging</strong></Notice>
{:else if id === "bisect-banner"}
  <Notice variant="banner" tone="warning" icon="bug"><strong>Bisecting</strong></Notice>
  <Notice variant="banner" tone="success" icon="bug"><strong>Found it</strong></Notice>
{:else if id === "toast-action"}
  <ToastHost items={toasts} ondismiss={none} onaction={none} />
{:else if id === "pick-groups"}
  <PickList label="Branches" items={[{ value: "main", label: "main", group: "Local" }]} onpick={none} />
  <PickList label="Branches" items={[]} onpick={none} />
{:else if id === "header-history"}
  <AppHeader>
    {#snippet start()}
      <IconButton icon="arrow-left" label="Go back" size="header" iconSize="regular" />
      <Button variant="ghost" icon="folder-git" trailingIcon="chevron-down" count={3}>storefront</Button>
    {/snippet}
  </AppHeader>
{:else if id === "bell-head"}
  <Toolbar variant="popup" label="Notifications">
    <strong>Notifications</strong>
    {#snippet end()}
      <Checkbox size="small" label="Do Not Disturb" />
      <Button size="small">Clear All</Button>
    {/snippet}
  </Toolbar>
{:else if id === "resize-handle-rows"}
  <div style="display: flex; flex-direction: column; width: 300px">
    <ResizeHandle side="bottom" preset="bottom" size={200} max={400} label="Resize" onresize={none} />
  </div>
{/if}
