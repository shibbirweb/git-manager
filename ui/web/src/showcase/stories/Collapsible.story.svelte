<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import Collapsible from "$ui/components/Collapsible.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
</script>

<Stack gap="none">
  <Collapsible title="Staged Changes" count={2}>
    {#snippet actions()}<Button size="small">Unstage All</Button>{/snippet}
    <Stack gap="xs" padding="sm"><Text>src/cart.ts</Text><Text>src/tax.ts</Text></Stack>
  </Collapsible>
  <Collapsible title="Changes" count={1} open={false}>
    <Stack padding="sm"><Text>README.md</Text></Stack>
  </Collapsible>
</Stack>
