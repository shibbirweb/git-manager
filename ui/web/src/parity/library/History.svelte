<!-- The library side of the log, commit details and merge editor parity cases (cases/history.ts). -->
<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import Link from "$ui/components/Link.svelte";
  import RefLabel from "$ui/components/RefLabel.svelte";
  import SectionTitle from "$ui/components/SectionTitle.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import StatusLetter from "$ui/components/StatusLetter.svelte";
  import Text from "$ui/components/Text.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";

  let { id }: { id: string } = $props();
</script>

{#if id === "details-parts"}
  <Button size="small" icon="commit">Open in Tab</Button>
  <Link size="small" mono>a1b2c3d</Link>
  <div style="width: 300px"><SectionTitle variant="caption" title="3 files changed" /></div>
  <StatusLetter kind="deleted" />
  <StatusLetter kind="renamed" />
  <StatusLetter kind="typechange" />
  <IconButton icon="copy" label="Copy" size="mini" tone="dim" iconSize="medium" />
{:else if id === "merge-groups"}
  <Toolbar variant="merge" label="Merge">
    <Stack direction="row" gap="xxs" label="Apply">
      <IconButton icon="chevrons-right" label="From the left" iconSize="regular" />
      <IconButton icon="wand" label="Apply non-conflicting" iconSize="regular">
        <Text size="codeSmall">Apply non-conflicting</Text>
      </IconButton>
    </Stack>
  </Toolbar>
  <Stack direction="row" gap="md" label="Status">
    <Text weight="medium" tone="danger">2 conflicts</Text>
    <Text weight="medium" tone="success">All resolved</Text>
  </Stack>
{/if}
