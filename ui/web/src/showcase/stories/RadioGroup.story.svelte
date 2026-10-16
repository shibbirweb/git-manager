<script lang="ts">
  import RadioGroup from "$ui/components/RadioGroup.svelte";

  let scope = $state<"global" | "repo">("repo");
  let mode = $state<"soft" | "mixed" | "hard">("mixed");
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
<RadioGroup
  label="Reset type"
  name="reset-mode"
  bind:value={mode}
  options={[
    { value: "soft", label: "Soft", description: "Keep every change, staged." },
    { value: "mixed", label: "Mixed", description: "Keep every change, unstaged." },
    { value: "hard", label: "Hard", description: "Throw every change away.", danger: true },
  ]}
/>
<RadioGroup
  label="Pull mode"
  name="pull-mode"
  layout="columns"
  labelWidth="large"
  bind:value={mode}
  options={[
    { value: "soft", label: "Merge", description: "Create a merge commit." },
    { value: "mixed", label: "Rebase", description: "Put your commits on top." },
  ]}
/>
