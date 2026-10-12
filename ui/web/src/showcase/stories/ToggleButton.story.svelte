<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import ToggleButton from "$ui/components/ToggleButton.svelte";

  let collapse = $state(true);
  let blame = $state(false);
  let words = $state(true);
  let edited = $state(true);
</script>

<Stack direction="row" gap="sm" align="center">
  <ToggleButton icon="list-tree" label="Collapse unchanged" text="Collapse" bind:pressed={collapse} />
  <ToggleButton icon="history" label="Blame" bind:pressed={blame} />
  <ToggleButton icon="split-view" label="Side by side" disabled />
  <ToggleButton variant="outline" label="Highlight words" text="Highlight words" bind:pressed={words} />
  <ToggleButton variant="tool" icon="history" label="Blame" bind:pressed={blame} />
  <ToggleButton variant="chip" label="Show only edited files" text="Edited only" bind:pressed={edited} />
</Stack>
<Text tone="dim">Collapse {collapse ? "on" : "off"}, blame {blame ? "on" : "off"}, words {words ? "on" : "off"}</Text>
