<!-- The library side of the bar parity cases (cases/bars.ts). -->
<script lang="ts">
  import Divider from "$ui/components/Divider.svelte";
  import Icon from "$ui/components/Icon.svelte";
  import SectionTitle from "$ui/components/SectionTitle.svelte";
  import Text from "$ui/components/Text.svelte";
  import ToggleButton from "$ui/components/ToggleButton.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";

  let { id }: { id: string } = $props();
</script>

{#if id === "toolbar-tab"}
  <Toolbar label="History"><Icon name="history" size="normal" /><Text>History</Text></Toolbar>
{:else if id === "toolbar-editor"}
  <Toolbar variant="editor" label="Diff">
    <Text tone="dim" size="small">2 of 5</Text>
    <Divider direction="vertical" />
    <ToggleButton icon="list-tree" label="Collapse unchanged" text="Collapse" pressed />
    <ToggleButton icon="split-rows" label="Inline" />
  </Toolbar>
{:else if id === "toolbar-merge"}
  <Toolbar variant="merge" label="Merge">
    <Divider direction="vertical" />
    <ToggleButton variant="outline" label="Highlight words" text="Highlight words" pressed />
  </Toolbar>
  <Toolbar variant="footer" label="Merge actions"><Text tone="dim" size="small">2 left</Text></Toolbar>
{:else if id === "section-title-list"}
  <SectionTitle title="Commits only in main" count={4} />
{/if}
