<script lang="ts">
  import Field from "$ui/components/Field.svelte";
  import Input from "$ui/components/Input.svelte";

  let name = $state("feature/login");
  const error = $derived(/\s/.test(name) ? "Branch names cannot contain spaces" : null);
</script>

<Field label="New branch name" hint="Created from the current branch" {error}>
  <Input bind:value={name} invalid={error !== null} />
</Field>
