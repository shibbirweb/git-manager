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

{#if id === "panel-header"}
  <PanelHeader title="Changes">
    {#snippet actions()}<IconButton icon="refresh" label="Refresh" size="compact" iconSize="medium" />{/snippet}
  </PanelHeader>
{:else if id === "file-row"}
  <Stack gap="none">
    <FileRow kind="modified" name="cart.ts" directory="src/lib" badge="LFS" selected />
    <FileRow kind="untracked" name="old.ts" />
    <FileRow kind="deleted" name="old.ts" />
  </Stack>
{:else if id === "description-list"}
  <DescriptionList
    items={[
      { label: "Author", value: "Ada" },
      { label: "Date", value: "11 Oct 2026" },
    ]}
  />
{:else if id === "code-block"}
  <CodeBlock text="$ git fetch origin" />
{:else if id === "highlight"}
  <HighlightText text="src/repo.ts" ranges={[[4, 8]]} />
  <HighlightText text="const total" ranges={[[6, 11]]} variant="mark" />
{:else if id === "side-nav"}
  <SideNav
    label="Sections"
    active="editor"
    items={[
      { id: "appearance", label: "Appearance" },
      { id: "editor", label: "Editor" },
      { id: "reset", label: "Reset All Settings...", danger: true },
    ]}
  />
{:else if id === "split-button"}
  <SplitButton text="Commit" menuLabel="More commit actions" items={[]} onclick={run} />
{:else if id === "status-icon"}
  <Stack direction="row">
    <StatusIcon state="working" label="Working" />
    <StatusIcon state="waiting" label="Needs you" />
    <StatusIcon state="idle" label="Ready" />
  </Stack>
{:else if id === "ref-label"}
  <Stack direction="row" gap="xs">
    <RefLabel kind="head" label="main" />
    <RefLabel kind="local" label="feature" />
    <RefLabel kind="remote" label="origin/main" />
    <RefLabel kind="tag" label="v1.0" />
  </Stack>
{:else if id === "loading-overlay"}
  <LoadingOverlay title="Opening storefront" step="Reading" hint="A moment." />
{:else if id === "theme-swatch"}
  <ThemeSwatch
    label="Monokai"
    colors={{
      background: "#272822",
      foreground: "#f8f8f2",
      border: "#3e3d32",
      keyword: "#f92672",
      string: "#e6db74",
      accent: "#a6e22e",
      selection: "#49483e",
    }}
  />
{/if}
