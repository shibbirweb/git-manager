<script lang="ts">
  import RadioGroup from "$ui/components/RadioGroup.svelte";

  let scope = $state<"global" | "repo">("repo");
</script>

<RadioGroup
  label="Identity scope"
  name="identity-scope"
  bind:value={scope}
  options={[
    { value: "repo", label: "This repository", description: "Saved in .git/config" },
    { value: "global", label: "All repositories", description: "Saved in ~/.gitconfig" },
  ]}
/>
