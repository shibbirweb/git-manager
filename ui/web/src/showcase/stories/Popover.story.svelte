<script lang="ts">
  import IconButton from "$ui/components/IconButton.svelte";
  import Popover from "$ui/components/Popover.svelte";
  import ProgressBar from "$ui/components/ProgressBar.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Popover label="AI usage details" width={260}>
  {#snippet trigger({ toggle, open })}
    <IconButton icon="bot" label="AI usage" active={open} onclick={toggle}>42%</IconButton>
  {/snippet}
  <Stack gap="sm" padding="sm">
    <Text weight="semibold">Claude Code</Text>
    <Stack gap="xs">
      <Stack direction="row" justify="between"><Text size="small">5-hour</Text><Text size="small">42%</Text></Stack>
      <ProgressBar value={0.42} label="5-hour limit" />
    </Stack>
  </Stack>
</Popover>
