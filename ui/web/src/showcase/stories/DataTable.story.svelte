<script lang="ts">
  import CommitGraph from "$ui/components/CommitGraph.svelte";
  import DataTable from "$ui/components/DataTable.svelte";
  import RefLabel from "$ui/components/RefLabel.svelte";
  import Text from "$ui/components/Text.svelte";
  import { graphWidth, SEGMENT_IN, SEGMENT_OUT } from "$ui/logic/graphModel";
  import type { DataColumn } from "$ui/logic/table";

  const commits = Array.from({ length: 5000 }, (_, index) => ({
    id: (index * 2654435761).toString(16).slice(-7).padStart(7, "0"),
    subject: index === 0 ? "Round tax to cents" : `Commit number ${5000 - index}`,
    author: index % 3 ? "Ada Lovelace" : "Alan Turing",
    date: `${(index % 28) + 1} Oct 2026`,
  }));
  const columns: DataColumn[] = [
    { id: "subject", label: "Subject", width: "fill" },
    { id: "author", label: "Author", width: "medium", tone: "dim" },
    { id: "date", label: "Date", width: "small", tone: "dim" },
    { id: "id", label: "Hash", width: "xsmall", tone: "faint", mono: true, small: true },
  ];
  const line = { lane: 0, color: 0, edges: [SEGMENT_IN, 0, 0, 0, SEGMENT_OUT, 0, 0, 0] };
  let selected = $state<string | null>(commits[0].id);
  let opened = $state("nothing yet");
</script>

<DataTable
  label="Commits"
  {columns}
  rows={commits}
  rowKey={(commit) => commit.id}
  height="large"
  leadWidth={graphWidth(1)}
  strong={(commit) => commit === commits[0]}
  bind:selected
  onopen={(commit) => (opened = commit.subject)}
>
  {#snippet lead(commit)}<CommitGraph row={line} laneCount={1} head={commit === commits[0]} />{/snippet}
  {#snippet cell(commit, column)}
    {#if column.id === "subject" && commit === commits[0]}
      <RefLabel kind="head" label="main" />
    {/if}
    {commit[column.id as keyof typeof commit]}
  {/snippet}
</DataTable>
<Text tone="dim">Opened: {opened}. Arrows move, Enter or double-click opens.</Text>
