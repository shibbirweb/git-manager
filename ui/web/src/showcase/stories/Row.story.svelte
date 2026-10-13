<script lang="ts">
  import Icon from "$ui/components/Icon.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import Row from "$ui/components/Row.svelte";
  import Spacer from "$ui/components/Spacer.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import StatusDot from "$ui/components/StatusDot.svelte";
  import Tag from "$ui/components/Tag.svelte";
  import Text from "$ui/components/Text.svelte";

  const commits = [
    { hash: "a1b2c3d", subject: "Round tax to cents", author: "Ada Lovelace", when: "2 hours ago" },
    {
      hash: "9f8e7d6",
      subject: "Add the cart page with a very long subject line",
      author: "Alan Turing",
      when: "1 day ago",
    },
  ];
  let selectedHash = $state("a1b2c3d");
  let open = $state(true);
  let pressed = $state(0);
</script>

<Stack gap="xs">
  <Text variant="sectionLabel">history</Text>
  {#each commits as commit (commit.hash)}
    <Row size="history" selected={commit.hash === selectedHash} onclick={() => (selectedHash = commit.hash)}>
      <Stack width="xsmall"><Text mono tone="dim" size="compact">{commit.hash}</Text></Stack>
      <Stack grow><Text truncate title={commit.subject}>{commit.subject}</Text></Stack>
      <Stack width="xlarge"><Text tone="dim" truncate>{commit.author}</Text></Stack>
      <Stack width="medium"><Text tone="dim" tabular truncate>{commit.when}</Text></Stack>
    </Row>
  {/each}
  <Text variant="sectionLabel">tree, folding, with hover actions</Text>
  <Row size="tree" expanded={open} onclick={() => (open = !open)}>
    <Icon name="stash" size="normal" />
    <Text truncate>WIP on main: cart totals</Text>
    <Text tone="dim">2 files</Text>
    {#snippet actions()}
      <IconButton icon="arrow-up" label="Unshelve" size="mini" onclick={() => (pressed += 1)} />
      <IconButton icon="trash" label="Delete" size="mini" tone="dim-danger" onclick={() => (pressed += 1)} />
    {/snippet}
  </Row>
  {#if open}
    <Row size="tree" expanded="leaf" depth={1} onclick={() => (pressed += 1)}>
      <Text tone="warning" mono>M</Text>
      <Text truncate>cart.ts</Text>
      <Text tone="dim" size="small">src/lib</Text>
    </Row>
  {/if}
  <Text variant="sectionLabel">entry and large</Text>
  <Row size="entry" align="baseline" onclick={() => (pressed += 1)}>
    <Text mono size="compact" tabular>10:42</Text>
    <Text tone="warning" truncate>Before discard</Text>
  </Row>
  <Row size="large" onclick={() => (pressed += 1)}>
    <Icon name="book" size="xlarge" />
    <Stack grow gap="xxs">
      <Text weight="semibold">Documentation</Text>
      <Text tone="dim">A guide to every feature, on the GitHub wiki.</Text>
    </Stack>
  </Row>
  <Text variant="sectionLabel">static and disabled</Text>
  <Row>
    <StatusDot tone="success" label="ok" />
    <Text mono size="small">get_app_state</Text>
    <Tag>MCP</Tag>
    <Spacer />
    <Text tone="dim" tabular>12 ms</Text>
  </Row>
  <Row disabled onclick={() => (pressed += 1)}><Text tone="faint">Push (no remote)</Text></Row>
  <Text tone="dim" size="small">Pressed {pressed} times</Text>
</Stack>
