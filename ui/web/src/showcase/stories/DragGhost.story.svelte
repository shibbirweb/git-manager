<script lang="ts">
  import DragGhost from "$ui/components/DragGhost.svelte";
  import Switch from "$ui/components/Switch.svelte";

  let dragging = $state(false);
  let pointer = $state({ x: 0, y: 0 });
</script>

<svelte:window onpointermove={(event) => (pointer = { x: event.clientX, y: event.clientY })} />

<Switch label="Drag 3 files (move the pointer)" bind:checked={dragging} />
{#if dragging}
  <DragGhost text="3 files" x={pointer.x} y={pointer.y} />
{/if}
