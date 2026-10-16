<script lang="ts">
  import Input from "$ui/components/Input.svelte";

  let branch = $state("feature/login");
</script>

<Input bind:value={branch} placeholder="Branch name" aria-label="Branch name" />
<Input value="has spaces" invalid aria-label="Invalid branch name" />
<Input value="a1b2c3d" mono readonly aria-label="Commit" />
<Input placeholder="Disabled" disabled aria-label="Disabled" />
