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
{:else if id === "underline-tabs"}
  <Tabs
    label="Scope"
    variant="underline"
    value="all"
    tabs={[
      { value: "all", label: "All" },
      { value: "files", label: "Files" },
    ]}
  />
{:else if id === "changes-empty"}
  <EmptyState icon="check" iconStyle="circle" iconTone="success" strong title="All committed" />
{:else if id === "no-repository"}
  <EmptyState icon="folder-git" iconTone="faint" strong title="No repo" />
{:else if id === "commit-options"}
  <Button size="small" icon="settings" aria-label="Options" badge={2} />
  <Segmented
    label="Signing"
    variant="split"
    value="sign"
    options={[
      { value: "sign", label: "Sign" },
      { value: "off", label: "Off" },
    ]}
  />
{:else if id === "memory-flag"}
  <Pill tone="warning" variant="outline">+60 MB</Pill>
{:else if id === "branch-file-list"}
  <div role="listbox" aria-label="Files">
    <FileRow variant="list" kind="added" name="cart.ts" directory="src" selected />
  </div>
{/if}
