<script lang="ts">
  import DiffView from "$ui/components/DiffView.svelte";
  import Text from "$ui/components/Text.svelte";

  let ratio = $state(0.5);
  let saved = $state(0.5);
</script>

<Text tone="dim">DiffView draws a SplitHandle in its split layout. Saved: {Math.round(saved * 100)}%</Text>
<DiffView
  label="cart.ts"
  original={"const total = 1;\nexport default total;\n"}
  modified={"const total = 2;\nexport default total;\n"}
  layout="split"
  height="small"
  bind:ratio
  oncommitratio={(value) => (saved = value)}
/>
