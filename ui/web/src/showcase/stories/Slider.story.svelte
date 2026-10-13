<script lang="ts">
  import Slider from "$ui/components/Slider.svelte";

  let fontSize = $state(13);
  let lineHeight = $state(1.5);
  let weight = $state(500);
</script>

<Slider label="Font size" bind:value={fontSize} min={10} max={24} format={(value) => `${value} px`} />
<Slider label="Line height" bind:value={lineHeight} min={1} max={2.4} step={0.1} format={(value) => value.toFixed(1)} />
<Slider
  label="Font weight (double-click resets to 400)"
  bind:value={weight}
  min={100}
  max={900}
  step={100}
  resetValue={400}
/>
