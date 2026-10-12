<!-- The library side of the AI parity cases in cases/agents.ts. -->
<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import CodeBlock from "$ui/components/CodeBlock.svelte";
  import Icon from "$ui/components/Icon.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import SectionTitle from "$ui/components/SectionTitle.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Tag from "$ui/components/Tag.svelte";
  import Text from "$ui/components/Text.svelte";

  let { id }: { id: string } = $props();
</script>

{#if id === "ai-panel-bits"}
  <div style="width: 300px"><SectionTitle variant="caps" title="storefront" /></div>
  <IconButton icon="plus" label="New agent" size="inline" tone="dim" iconSize="medium" />
  <Tag tone="warning">missing</Tag>
{:else if id === "askpass-prompt"}
  <div style="width: 400px"><CodeBlock variant="prompt" text="Password for https://github.com:" /></div>
{:else if id === "new-task-bits"}
  <Button size="small" icon="plus">Add Agent to Race</Button>
  <Stack direction="row" gap="xs" align="center" label="Target">
    <Icon name="branch" size="small" />
    <Text size="small" mono tone="dim" truncate>cart</Text>
  </Stack>
{/if}
