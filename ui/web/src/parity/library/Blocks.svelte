<!-- The library side of the building-block parity cases (cases/blocks.ts). -->
<script lang="ts">
  import CodeBlock from "$ui/components/CodeBlock.svelte";
  import DescriptionList from "$ui/components/DescriptionList.svelte";
  import FileRow from "$ui/components/FileRow.svelte";
  import HighlightText from "$ui/components/HighlightText.svelte";
  import IconButton from "$ui/components/IconButton.svelte";
  import LoadingOverlay from "$ui/components/LoadingOverlay.svelte";
  import PanelHeader from "$ui/components/PanelHeader.svelte";
  import RefLabel from "$ui/components/RefLabel.svelte";
  import SideNav from "$ui/components/SideNav.svelte";
  import SplitButton from "$ui/components/SplitButton.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import StatusIcon from "$ui/components/StatusIcon.svelte";
  import ThemeSwatch from "$ui/components/ThemeSwatch.svelte";

  let { id }: { id: string } = $props();
  const run = () => undefined;
</script>

{#if id === "description-list"}
  <DescriptionList
    items={[
      { label: "Author", value: "Ada" },
      { label: "Date", value: "11 Oct 2026" },
    ]}
  />
{:else if id === "code-block"}
  <CodeBlock text="$ git fetch origin" />
{/if}
