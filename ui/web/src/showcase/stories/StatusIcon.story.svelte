<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import StatusIcon, { type RunState } from "$ui/components/StatusIcon.svelte";
  import Text from "$ui/components/Text.svelte";

  const states: RunState[] = ["starting", "working", "waiting", "done", "exited", "idle"];
</script>

<Stack direction="row" gap="lg">
  {#each states as state (state)}
    <Stack direction="row" gap="xs" align="center"><StatusIcon {state} label={state} /><Text>{state}</Text></Stack>
  {/each}
</Stack>
