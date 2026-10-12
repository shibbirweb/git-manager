<script lang="ts">
  import Fieldset from "$ui/components/Fieldset.svelte";
  import RadioGroup from "$ui/components/RadioGroup.svelte";

  let mode = $state<"merge" | "rebase" | "ff">("merge");
</script>

<Fieldset legend="Integrate the incoming changes with">
  <RadioGroup
    label="Pull mode"
    name="pull-mode"
    layout="columns"
    bind:value={mode}
    options={[
      { value: "merge", label: "Merge", description: "Keep both histories with a merge commit" },
      { value: "rebase", label: "Rebase", description: "Replay your commits on top" },
      { value: "ff", label: "Fast-forward only", description: "Refuse when the histories split" },
    ]}
  />
</Fieldset>
