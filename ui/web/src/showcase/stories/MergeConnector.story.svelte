<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import CodeView from "$ui/components/CodeView.svelte";
  import MergeConnector, { type ConnectorRibbon } from "$ui/components/MergeConnector.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  const ribbons: ConnectorRibbon[] = [
    { index: 0, kind: "modified", aTop: 4, aBottom: 22, bTop: 4, bBottom: 22 },
    { index: 1, kind: "conflict", aTop: 40, aBottom: 76, bTop: 30, bBottom: 48 },
    { index: 2, kind: "added", aTop: 100, aBottom: 136, bTop: 70, bBottom: 70 },
  ];
  const lines = Array.from({ length: 8 }, (_, line) => `line ${line + 1}`).join("\n");
  let last = $state("Press a chunk's button");
</script>

<Text tone="dim">{last}</Text>
<Card label="Connector">
  <Stack direction="row" align="stretch">
    <CodeView source={lines} copy={false} />
    <MergeConnector
      side="left"
      {ribbons}
      onapply={(index) => (last = `Apply chunk ${index + 1}`)}
      onignore={(index) => (last = `Ignore chunk ${index + 1}`)}
    />
    <CodeView source={lines} copy={false} />
  </Stack>
</Card>
<Card label="Stage and revert">
  <Stack direction="row" align="stretch">
    <CodeView source={lines} copy={false} />
    <MergeConnector
      side="right"
      {ribbons}
      applyTitle="Stage this change"
      revertTitle="Revert this change"
      onapply={(index) => (last = `Stage chunk ${index + 1}`)}
      onrevert={(index) => (last = `Revert chunk ${index + 1}`)}
    />
    <CodeView source={lines} copy={false} />
  </Stack>
</Card>
