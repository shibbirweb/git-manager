<!-- The library side of the builder parity cases (cases/builders.ts): Rows composed like the app's rows. -->
<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import Icon from "$ui/components/Icon.svelte";
  import Link from "$ui/components/Link.svelte";
  import List from "$ui/components/List.svelte";
  import ListBox from "$ui/components/ListBox.svelte";
  import Row from "$ui/components/Row.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let { id }: { id: string } = $props();
  const run = () => undefined;
  const items = [
    { key: "a", text: "Round tax" },
    { key: "b", text: "Add the cart" },
  ];
</script>

{#if id === "row-history" || id === "row-list"}
  <List label="Rows" {items} itemKey={(item) => item.key} selected="b">
    {#snippet row(item, state)}
      <Row size={id === "row-history" ? "history" : "list"} selected={state.selected}>
        {#if id === "row-history"}
          <Stack width="xsmall"><Text mono tone="dim" size="compact">a1b2c3d</Text></Stack>
        {/if}
        <Text truncate>{item.text}</Text>
      </Row>
    {/snippet}
  </List>
{:else if id === "link-expanded"}
  <Link tone="dim" expanded={false} onclick={run}>Earlier versions</Link>
{/if}
