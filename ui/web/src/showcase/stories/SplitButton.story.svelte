<script lang="ts">
  import SplitButton from "$ui/components/SplitButton.svelte";
  import Text from "$ui/components/Text.svelte";

  let ran = $state("nothing yet");
</script>

<SplitButton
  text="Commit"
  menuLabel="More commit actions"
  onclick={() => (ran = "Commit")}
  items={[
    { label: "Commit and Push", action: () => (ran = "Commit and Push") },
    { label: "Commit and Sync", action: () => (ran = "Commit and Sync") },
  ]}
/>
<Text tone="dim">Ran: {ran}</Text>
