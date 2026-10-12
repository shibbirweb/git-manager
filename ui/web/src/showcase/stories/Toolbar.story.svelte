<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import Card from "$ui/components/Card.svelte";
  import Divider from "$ui/components/Divider.svelte";
  import Icon from "$ui/components/Icon.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import SearchField from "$ui/components/SearchField.svelte";
  import Spinner from "$ui/components/Spinner.svelte";
  import Text from "$ui/components/Text.svelte";
  import ToggleButton from "$ui/components/ToggleButton.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";

  let filter = $state("");
  let collapse = $state(true);
</script>

<Card label="Tab">
  <Toolbar label="File history">
    <Icon name="history" size="normal" />
    <Text>History of cart.ts</Text>
    {#snippet end()}
      <Spinner size="small" />
      <Text tone="dim" size="small">12 commits</Text>
      <IconButton icon="refresh" label="Refresh" iconSize="normal" />
    {/snippet}
  </Toolbar>
</Card>
<Card label="Editor">
  <Toolbar variant="editor" label="Diff">
    <IconButton icon="arrow-up" label="Previous change" iconSize="normal" />
    <IconButton icon="arrow-down" label="Next change" iconSize="normal" />
    <Text tone="dim" size="small">2 of 5</Text>
    <Divider direction="vertical" />
    <ToggleButton icon="split-view" label="Side by side" pressed />
    <ToggleButton icon="split-rows" label="Inline" />
    <ToggleButton icon="list-tree" label="Collapse unchanged" text="Collapse" bind:pressed={collapse} />
  </Toolbar>
</Card>
<Card label="Panel">
  <Toolbar variant="panel" label="Git Console">
    <SearchField label="Filter commands" placeholder="Filter commands" bind:value={filter} />
    {#snippet end()}<Button size="small">Clear</Button>{/snippet}
  </Toolbar>
</Card>
<Card label="Merge footer">
  <Toolbar variant="footer" label="Merge">
    <Text tone="dim" size="small">2 conflicts left</Text>
    {#snippet end()}
      <Button>Cancel</Button>
      <Button variant="primary">Apply</Button>
    {/snippet}
  </Toolbar>
</Card>
<Card label="File">
  <Toolbar variant="file" label="File actions">
    <Text size="small" tone="dim">src / lib / cart.ts</Text>
    {#snippet end()}
      <IconButton icon="arrow-up" label="Previous change" size="tool" iconSize="medium" />
      <IconButton icon="arrow-down" label="Next change" size="tool" iconSize="medium" />
      <Text size="small" tone="dim">2 of 5</Text>
      <Divider direction="vertical" />
      <ToggleButton variant="tool" icon="history" label="Blame" />
      <IconButton icon="copy" label="Copy path" size="tool" iconSize="compact" />
    {/snippet}
  </Toolbar>
  <Toolbar variant="conflict" label="Conflict actions">
    <Icon name="alert" size="medium" tone="danger" />
    <Button size="tiny">Accept All Current</Button>
    <Button size="tiny">Accept All Incoming</Button>
    <Button size="tiny" variant="primary" icon="merge">Open Merge Tool</Button>
  </Toolbar>
</Card>
<Card label="Pane head and rail">
  <Toolbar variant="head" label="Patch">
    <Text truncate>Round tax to cents</Text>
    {#snippet end()}<Button size="small">Open Commit</Button>{/snippet}
  </Toolbar>
  <Toolbar variant="rail" label="Run actions">
    <IconButton icon="play" label="Rerun" size="small" iconSize="compact" />
    <IconButton icon="stop" label="Stop" size="small" iconSize="compact" />
  </Toolbar>
</Card>
<Card label="Strip">
  <Toolbar variant="strip" label="Status strip">
    <Text size="small" tone="dim">No file open</Text>
  </Toolbar>
</Card>
