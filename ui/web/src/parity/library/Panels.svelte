<!-- The library side of the round 2 parity cases (cases/panels.ts, cases/more.ts). -->
<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import CodeBlock from "$ui/components/CodeBlock.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
  import FileRow from "$ui/components/FileRow.svelte";
  import FloatingFindBar from "$ui/components/FloatingFindBar.svelte";
  import Logo from "$ui/components/Logo.svelte";
  import Pill from "$ui/components/Pill.svelte";
  import RadioGroup from "$ui/components/RadioGroup.svelte";
  import RichEditorHost from "$ui/components/RichEditorHost.svelte";
  import Segmented from "$ui/components/Segmented.svelte";
  import Tabs from "$ui/components/Tabs.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";

  let { id }: { id: string } = $props();
  const run = () => undefined;
</script>

{#if id === "empty-main"}
  <Logo size="soft" />
  <Toolbar variant="strip" label="Strip"><span>x</span></Toolbar>
{:else if id === "rich-editor"}
  <div style="height: 120px; display: flex">
    <RichEditorHost label="Doc" notice="Read-only." onready={run} />
  </div>
{:else if id === "floating-find"}
  <div style="position: relative; height: 60px">
    <FloatingFindBar query="" counter="1 of 2" />
  </div>
{/if}
