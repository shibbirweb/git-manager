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

{#if id === "askpass-prompt"}
  <div style="width: 400px"><CodeBlock variant="prompt" text="Password for https://github.com:" /></div>
{/if}
