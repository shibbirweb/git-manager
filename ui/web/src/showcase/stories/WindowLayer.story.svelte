<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
  import Icon from "$ui/components/Icon.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";
  import WindowLayer from "$ui/components/WindowLayer.svelte";

  let open = $state(false);
</script>

<Button onclick={() => (open = true)}>Open the merge tool</Button>
{#if open}
  <WindowLayer label="Merge src/app.ts">
    <Toolbar variant="tab" label="Merge">
      <Icon name="merge" size="regular" tone="dim" />
      <Text weight="semibold">Merge Revisions for</Text>
      <Text mono truncate>src/app.ts</Text>
      {#snippet end()}<IconButton
          icon="x"
          iconSize="regular"
          label="Close merge"
          onclick={() => (open = false)}
        />{/snippet}
    </Toolbar>
    <Stack gap="none" grow>
      <EmptyState title="The merge view goes here." titleTone="dim" />
    </Stack>
  </WindowLayer>
{/if}
