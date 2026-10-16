<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import ZoomBadge from "$ui/components/ZoomBadge.svelte";

  let zoom = $state(100);
  let open = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function zoomIn(): void {
    zoom += 10;
    open = true;
    clearTimeout(timer);
    timer = setTimeout(() => (open = false), 1200);
  }
</script>

<Button onclick={zoomIn}>Zoom in</Button>
<ZoomBadge {open} text="{zoom}%" />
