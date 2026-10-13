<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import Time from "$ui/components/Time.svelte";

  const now = Date.now();
  const minute = 60_000;
  const past = [0.3, 5, 150, 60 * 30, 60 * 24 * 3, 60 * 24 * 12].map((count) => now - count * minute);
</script>

<Stack gap="sm">
  <Text variant="sectionLabel">ago: the log and notifications (hover for the full date)</Text>
  <Stack direction="row" gap="lg" wrap>
    {#each past as time (time)}
      <Text tone="dim"><Time {time} /></Text>
    {/each}
  </Stack>
  <Text variant="sectionLabel">age: how long an agent has waited</Text>
  <Stack direction="row" gap="lg">
    {#each past.slice(0, 4) as time (time)}
      <Text tone="dim" size="small"><Time {time} format="age" /></Text>
    {/each}
  </Stack>
  <Text variant="sectionLabel">until: when usage resets</Text>
  <Stack direction="row" gap="lg">
    <Text tone="dim">Resets <Time time={now + 45 * minute} format="until" /></Text>
    <Text tone="dim">Resets <Time time={now + 200 * minute} format="until" /></Text>
    <Text tone="dim">Resets <Time time={now + 52 * 60 * minute} format="until" /></Text>
  </Stack>
</Stack>
