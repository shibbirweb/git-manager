<script lang="ts">
  import RenameField from "$ui/components/RenameField.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  const taken = ["zsh", "build"];
  let name = $state("zsh");
  let draft = $state("zsh");
  let editing = $state(true);
</script>

<Stack direction="row" gap="md" align="center">
  {#if editing}
    <RenameField
      value={name}
      label="Terminal name"
      invalid={draft !== name && taken.includes(draft)}
      oninput={(next) => (draft = next)}
      onrename={(next) => {
        if (next && !(next !== name && taken.includes(next))) {
          name = next;
        }
        editing = false;
      }}
    />
  {:else}
    <Text>{name}</Text>
  {/if}
  <Text size="small" tone="dim">Enter keeps, Escape cancels; "build" is taken.</Text>
</Stack>
