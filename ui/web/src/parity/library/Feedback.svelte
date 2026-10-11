<!-- The library side of the feedback parity cases (cases/feedback.ts). -->
<script lang="ts">
  import Badge from "$ui/components/Badge.svelte";
  import Card from "$ui/components/Card.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
  import Field from "$ui/components/Field.svelte";
  import Input from "$ui/components/Input.svelte";
  import Kbd from "$ui/components/Kbd.svelte";
  import Notice from "$ui/components/Notice.svelte";
  import ProgressBar from "$ui/components/ProgressBar.svelte";
  import Spinner from "$ui/components/Spinner.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Tag from "$ui/components/Tag.svelte";
  import ToastHost from "$ui/components/ToastHost.svelte";

  let { id }: { id: string } = $props();
</script>

{#if id === "spinner"}
  <Spinner />
{:else if id === "badge"}
  <Badge count={4} />
{:else if id === "tag"}
  <Tag>primary</Tag>
{:else if id === "kbd"}
  <Kbd keys="⌘P" />
{:else if id === "progress"}
  <Stack direction="row"><Stack grow><ProgressBar value={0.57} label="Memory" /></Stack></Stack>
{:else if id === "notice"}
  <Notice tone="danger">The folder could not be opened.</Notice>
{:else if id === "empty-state"}
  <Stack direction="row">
    <EmptyState icon="alert" title="Could not compare the files" hint="The file is missing." />
  </Stack>
{:else if id === "card"}
  <Card><Stack padding="none"><span></span></Stack></Card>
{:else if id === "field"}
  <Field label="Name" error="Branch names cannot contain spaces"><Input value="has space" invalid /></Field>
{:else if id === "toast"}
  <ToastHost items={[{ id: 1, kind: "success", title: "Pushed to origin/main" }]} ondismiss={() => undefined} />
{/if}
