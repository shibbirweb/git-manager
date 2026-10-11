<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import Dialog from "$ui/components/Dialog.svelte";
  import Field from "$ui/components/Field.svelte";
  import Input from "$ui/components/Input.svelte";

  let open = $state(false);
  let name = $state("");
</script>

<Button onclick={() => (open = true)}>New Branch...</Button>
<Dialog bind:open title="New Branch">
  <Field label="Name" hint="Created from main">
    <Input bind:value={name} placeholder="feature/login" />
  </Field>
  {#snippet actions()}
    <Button onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" disabled={!name.trim()} onclick={() => (open = false)}>Create</Button>
  {/snippet}
</Dialog>
