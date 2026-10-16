<script lang="ts">
  import ChoiceList from "$ui/components/ChoiceList.svelte";
  import Text from "$ui/components/Text.svelte";

  let picked = $state("nothing yet");
</script>

<Text tone="dim">Picked: {picked}</Text>
<ChoiceList
  label="Apply the stash"
  onpick={(value) => (picked = value)}
  choices={[
    { value: "apply", label: "Apply", description: "Keep the stash in the list." },
    { value: "pop", label: "Pop", description: "Apply it and drop it from the list." },
    { value: "drop", label: "Drop", description: "Delete it without applying.", danger: true },
  ]}
/>
