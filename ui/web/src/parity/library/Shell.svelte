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
{:else if id === "activity-bar"}
  <ActivityBar
    label="Side panels"
    active="changes"
    items={[
      { id: "files", icon: "file", label: "Files" },
      { id: "changes", icon: "git-compare", label: "Changes" },
    ]}
  />
{:else if id === "resize-handle"}
  <!-- The harness gives the handle a panel's height, like the reference. -->
  <div style="display: flex; height: 120px">
    <ResizeHandle size={200} side="left" min={100} max={400} defaultSize={200} label="Resize" onresize={run} />
  </div>
{:else if id === "search-toggles"}
  <SearchToggles {options} />
  <SearchToggles {options} compact />
{:else if id === "find-bar"}
  <FindBar query="total" current={1} total={4} />
{/if}
