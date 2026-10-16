<script lang="ts">
  import Checkbox from "$ui/components/Checkbox.svelte";

  let signOff = $state(false);
</script>

<Checkbox label="Sign off (add Signed-off-by)" bind:checked={signOff} />
<Checkbox label="Some files selected" indeterminate />
<Checkbox label="Disabled" disabled />
