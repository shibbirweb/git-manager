<script lang="ts">
  import Slider from "$ui/components/Slider.svelte";

  let fontSize = $state(13);
  let lineHeight = $state(1.5);
</script>

<Slider label="Font size" bind:value={fontSize} min={10} max={24} format={(value) => `${value} px`} />
<Slider label="Line height" bind:value={lineHeight} min={1} max={2.4} step={0.1} format={(value) => value.toFixed(1)} />
