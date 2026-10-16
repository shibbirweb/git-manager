<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import ImageCanvas from "$ui/components/ImageCanvas.svelte";
  import Text from "$ui/components/Text.svelte";
  import appIcon from "../../../../../src-tauri/icons/128x128.png?url";

  let size = $state("measuring");
</script>

<Text tone="dim">Image: {size}</Text>
<Card label="Canvas">
  <ImageCanvas
    src={appIcon}
    alt="App icon"
    scale={0.75}
    onmeasure={(natural) => (size = natural ? `${natural.width} x ${natural.height} px at 75%` : "measuring")}
  />
</Card>
