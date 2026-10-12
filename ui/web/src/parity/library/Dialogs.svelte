<!-- The library side of the dialog parity cases (cases/dialogs.ts). -->
<script lang="ts">
  import CodeBlock from "$ui/components/CodeBlock.svelte";
  import Link from "$ui/components/Link.svelte";
  import ListBox from "$ui/components/ListBox.svelte";
  import Segmented from "$ui/components/Segmented.svelte";
  import Toolbar from "$ui/components/Toolbar.svelte";

  let { id }: { id: string } = $props();
  const none = () => undefined;
</script>

{#if id === "patch-head"}
  <div style="width: 500px"><Toolbar variant="head" label="Patch">Lines 10 to 20</Toolbar></div>
{:else if id === "push-commit-list"}
  <div style="width: 400px"><ListBox label="Commits" minHeight="list">{""}</ListBox></div>
{:else if id === "gist-parts"}
  <Segmented
    label="Visibility"
    variant="joined"
    value="secret"
    options={[
      { value: "secret", label: "Secret" },
      { value: "public", label: "Public" },
    ]}
  />
  <div style="width: 400px"><CodeBlock variant="preview" text="const a = 1;" /></div>
{:else if id === "older-toggle"}
  <Link tone="dim" icon="chevron-right" onclick={none}>Earlier versions</Link>
{/if}
