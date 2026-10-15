<!-- The library side of the editor surface parity cases (cases/surfaces.ts). -->
<script lang="ts">
  import FormatToolbar from "$ui/components/FormatToolbar.svelte";
  import MergeConnector from "$ui/components/MergeConnector.svelte";
  import MergeView from "$ui/components/MergeView.svelte";

  let { id }: { id: string } = $props();
  const run = () => undefined;
</script>

{#if id === "merge-connector"}
  <!-- In MergeView the connector stretches to the panes; here a box as tall as the reference stands in. -->
  <div style="display: flex; height: 60px">
    <MergeConnector
      side="left"
      ribbons={[{ index: 0, kind: "conflict", aTop: 4, aBottom: 20, bTop: 4, bBottom: 20 }]}
      onapply={run}
      onignore={run}
    />
  </div>
{:else if id === "merge-labels"}
  <MergeView
    label="Merge"
    left=""
    right=""
    chunks={[]}
    height="small"
    labels={{ left: "main", result: "Result", right: "feature/cart" }}
    fileName="cart.ts"
  />
{/if}
