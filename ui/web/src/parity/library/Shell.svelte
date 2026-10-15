<!-- The library side of the layout and editor parity cases (cases/shell.ts). -->
<script lang="ts">
  import ActivityBar from "$ui/components/ActivityBar.svelte";
  import FindBar from "$ui/components/FindBar.svelte";
  import ResizeHandle from "$ui/components/ResizeHandle.svelte";
  import SearchToggles from "$ui/components/SearchToggles.svelte";
  import StatusBar from "$ui/components/StatusBar.svelte";
  import StatusItem from "$ui/components/StatusItem.svelte";

  let { id }: { id: string } = $props();
  const run = () => undefined;
  const options = { matchCase: false, wholeWords: true, regex: false };
</script>

{#if id === "status-bar"}
  <StatusBar>
    {#snippet start()}
      <StatusItem icon="branch" text="main" onclick={run} />
      <StatusItem text="3 changes" />
    {/snippet}
    {#snippet end()}<StatusItem icon="memory" text="181 MB" open onclick={run} />{/snippet}
  </StatusBar>
{:else if id === "find-bar"}
  <FindBar query="total" current={1} total={4} />
{/if}
