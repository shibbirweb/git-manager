<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import ConfirmDialog from "$ui/components/ConfirmDialog.svelte";
  import Text from "$ui/components/Text.svelte";

  let open = $state(false);
  let result = $state("not asked yet");
</script>

<Button variant="danger" onclick={() => (open = true)}>Discard All Changes...</Button>
<Text tone="dim">Answer: {result}</Text>
<ConfirmDialog
  bind:open
  danger
  title="Discard all changes?"
  message="This removes every change in the working tree. It cannot be undone."
  confirmLabel="Discard"
  onconfirm={() => (result = "discarded")}
  oncancel={() => (result = "cancelled")}
/>
