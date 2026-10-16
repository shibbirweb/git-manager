<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import LoadingOverlay from "$ui/components/LoadingOverlay.svelte";

  let open = $state(false);

  function show(): void {
    open = true;
    setTimeout(() => (open = false), 2000);
  }
</script>

<Button onclick={show}>Open a big folder</Button>
<LoadingOverlay
  {open}
  title="Opening storefront"
  step="Reading 12 repositories"
  hint="Large folders take a moment the first time."
/>
