<!-- The library side of the last parity cases (cases/finish.ts). -->
<script lang="ts">
  import Breadcrumbs from "$ui/components/Breadcrumbs.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
  import Field from "$ui/components/Field.svelte";
  import FindBar from "$ui/components/FindBar.svelte";
  import Input from "$ui/components/Input.svelte";
  import Notice from "$ui/components/Notice.svelte";
  import Pill from "$ui/components/Pill.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import StatusLetter from "$ui/components/StatusLetter.svelte";
  import Text from "$ui/components/Text.svelte";
  import TextArea from "$ui/components/TextArea.svelte";

  let { id }: { id: string } = $props();
</script>

{#if id === "find-problem"}
  <div style="width: 600px"><FindBar query="(" problem="Bad regex" showReplace /></div>
{:else if id === "file-kinds"}
  <StatusLetter kind="added" />
  <StatusLetter kind="typechange" />
  <StatusLetter kind="deleted" />
  <StatusLetter kind="renamed" />
  <StatusLetter kind="conflicted" />
{:else if id === "settings-error"}
  <div style="width: 500px"><Notice tone="danger">Could not save.</Notice></div>
  <Stack label="Hint"><Text size="compact" tone="faint">Turning a feature off frees its memory.</Text></Stack>
  <Input mono width="number" value="13" aria-label="Size" />
{:else if id === "memory-minor"}
  <Pill variant="outline">+2 MB</Pill>
{:else if id === "changes-diff-error"}
  <EmptyState title="Could not load the diff" titleSize="large" titleTone="danger" />
{:else if id === "nav-bar-floating"}
  <Breadcrumbs variant="floating" crumbs={[{ label: "src", kind: "folder" }]} />
{:else if id === "dialog-secondary"}
  <div style="width: 400px"><Field label="Message"><TextArea aria-label="Message" /></Field></div>
{/if}
