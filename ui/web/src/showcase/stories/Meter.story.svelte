<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import Meter from "$ui/components/Meter.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Card label="Memory" padded>
  <Stack gap="sm">
    <Meter label="Web content" value="181 MB" fraction={0.45} />
    <Meter label="App" value="64 MB" fraction={0.16} />
  </Stack>
</Card>
<Card label="AI usage" padded>
  <Stack gap="sm">
    <Meter variant="usage" label="5 hour window" value="34% used" fraction={0.34} detail="Resets in 2h 10m" />
    <Meter variant="usage" tone="warning" label="Weekly" value="82% used" fraction={0.82} />
    <Meter variant="usage" tone="danger" label="Opus weekly" value="100% used" fraction={1} />
  </Stack>
</Card>
<Stack direction="row" gap="sm" align="center">
  <Meter variant="mini" fraction={0.34} label="34% used" />
  <Text size="small">34%</Text>
</Stack>
