<script lang="ts">
  import CommitGraph from "$ui/components/CommitGraph.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import { SEGMENT_IN, SEGMENT_OUT, SEGMENT_PASS } from "$ui/logic/graphModel";

  const rows = [
    { lane: 0, color: 0, edges: [SEGMENT_OUT, 0, 0, 0, SEGMENT_OUT, 0, 1, 1] },
    { lane: 1, color: 1, edges: [SEGMENT_PASS, 0, 0, 0, SEGMENT_IN, 1, 1, 1, SEGMENT_OUT, 1, 1, 1] },
    { lane: 0, color: 0, edges: [SEGMENT_IN, 0, 0, 0, SEGMENT_IN, 1, 0, 1, SEGMENT_OUT, 0, 0, 0] },
  ];
</script>

<Stack gap="none">
  <CommitGraph row={rows[0]} laneCount={2} head />
  <CommitGraph row={rows[1]} laneCount={2} />
  <CommitGraph row={rows[2]} laneCount={2} merge />
</Stack>
