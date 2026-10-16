<script lang="ts">
  import PickList from "$ui/components/PickList.svelte";
  import Text from "$ui/components/Text.svelte";

  let picked = $state("nothing yet");
</script>

<PickList
  label="Checkout branch"
  placeholder="Branch name"
  items={[
    { value: "new", label: "Create new branch...", pinned: true },
    { value: "main", label: "main", description: "current", group: "Local" },
    { value: "develop", label: "develop", group: "Local" },
    { value: "origin/main", label: "origin/main", group: "Remote" },
    { value: "origin/develop", label: "origin/develop", group: "Remote" },
  ]}
  onpick={(value) => (picked = value)}
/>
<Text tone="dim">Picked: {picked}</Text>
