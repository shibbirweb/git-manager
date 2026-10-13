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
{:else if id === "row-entry"}
  <ListBox label="Commits">
    <Row size="entry" line>
      <Stack grow><Text truncate>Round tax</Text></Stack>
      <Stack width="large"><Text tone="dim" truncate>Ada</Text></Stack>
      <Stack width="small"><Text tone="dim" size="small">2 hours ago</Text></Stack>
      <Stack width="xsmall"><Text mono tone="faint" size="compact">a1b2c3d</Text></Stack>
    </Row>
    <Row size="entry" line><Text>Add</Text></Row>
  </ListBox>
{:else if id === "row-large"}
  <Row size="large" onclick={run}>
    <Icon name="book" size="xlarge" />
    <Stack gap="xxs"><Text>Documentation</Text><Text tone="dim">A guide to every feature.</Text></Stack>
  </Row>
{:else if id === "link-expanded"}
  <Link tone="dim" expanded={false} onclick={run}>Earlier versions</Link>
{:else if id === "card-states"}
  <Card selected><Stack padding="none"><span></span></Stack></Card>
  <Card dim><Stack padding="none"><span></span></Stack></Card>
{/if}
