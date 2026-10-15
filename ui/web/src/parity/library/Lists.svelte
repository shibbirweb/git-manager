<!-- The library side of the list, workspace and settings parity cases (cases/lists.ts, workspace.ts, settings.ts). -->
<script lang="ts">
  import BulletList from "$ui/components/BulletList.svelte";
  import Chip from "$ui/components/Chip.svelte";
  import DialogHead from "$ui/components/DialogHead.svelte";
  import FontSample from "$ui/components/FontSample.svelte";
  import ListBox from "$ui/components/ListBox.svelte";
  import Logo from "$ui/components/Logo.svelte";
  import MarkdownView from "$ui/components/MarkdownView.svelte";
  import Pane from "$ui/components/Pane.svelte";
  import ResourceLink from "$ui/components/ResourceLink.svelte";
  import SearchField from "$ui/components/SearchField.svelte";
  import SectionTitle from "$ui/components/SectionTitle.svelte";
  import Slider from "$ui/components/Slider.svelte";
  import StatusBar from "$ui/components/StatusBar.svelte";
  import StatusItem from "$ui/components/StatusItem.svelte";
  import Text from "$ui/components/Text.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";

  let { id }: { id: string } = $props();
  const run = () => undefined;
</script>

{#if id === "local-history"}
  <Pane label="Versions"><Text>10:42</Text></Pane>
{:else if id === "scripts-shelf"}
  <Chip variant="badge" tone="warning" text="Node 22" onclick={run} />
{:else if id === "panel-filter"}
  <Toolbar variant="search" label="Filter"><SearchField label="Filter" size="compact" /></Toolbar>
{:else if id === "console-filter"}
  <SearchField label="Filter" size="small" />
{:else if id === "status-items"}
  <StatusBar>
    {#snippet start()}
      <StatusItem icon="branch" text="feature/a-long-branch-name" limit="branch" onclick={run} />
      <StatusItem text="0.2.0" tone="accent" onclick={run} />
    {/snippet}
  </StatusBar>
{/if}
