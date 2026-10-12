<script lang="ts">
  import MergeView from "$ui/components/MergeView.svelte";
  import Text from "$ui/components/Text.svelte";
  import type { MergeChunk } from "$ui/logic/mergeGeometry";

  const left = "title: Store\ncolor: blue\nitems: 12\nfooter: on\n";
  const right = "title: Storefront\ncolor: green\nitems: 12\n";
  let result = $state("title: Store\ncolor: ?\nitems: 12\nfooter: on\n");
  const chunks: MergeChunk[] = [
    { kind: "modified", left: [0, 1], result: [0, 1], right: [0, 1] },
    { kind: "conflict", left: [1, 2], result: [1, 2], right: [1, 2] },
    { kind: "deleted", left: [3, 4], result: [3, 4], right: [3, 3] },
  ];
  let last = $state("Nothing applied yet");
</script>

<Text tone="dim">{last}</Text>
<MergeView
  label="settings.yml"
  {left}
  {right}
  {chunks}
  height="large"
  bind:result
  onapply={(index, side) => (last = `Apply chunk ${index + 1} from the ${side}`)}
  onignore={(index, side) => (last = `Ignore chunk ${index + 1} on the ${side}`)}
/>
