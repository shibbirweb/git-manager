<script lang="ts">
  import IconButton from "$ui/components/IconButton.svelte";
  import Stack from "$ui/components/Stack.svelte";

  let pinned = $state(false);
</script>

<Stack direction="row" align="center" gap="sm">
  <IconButton icon="refresh" label="Refresh" />
  <IconButton icon="pin" label="Pin" active={pinned} onclick={() => (pinned = !pinned)} />
  <IconButton icon="more" label="More actions" />
  <IconButton icon="plus" label="New terminal">New</IconButton>
  <IconButton icon="x" label="Close" size="small" iconSize="compact" />
  <IconButton icon="trash" label="Delete" disabled />
  <IconButton icon="copy" label="Copy path" size="tool" iconSize="compact" />
</Stack>
