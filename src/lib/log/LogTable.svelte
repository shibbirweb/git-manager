<!-- The log's commit table: the graph, ref and bisect chips, subject, author, date and hash of each loaded commit. -->
<script lang="ts">
  import CommitGraph from "@git-manager/ui/components/CommitGraph.svelte";
  import DataTable from "@git-manager/ui/components/DataTable.svelte";
  import RefLabel from "@git-manager/ui/components/RefLabel.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import Time from "@git-manager/ui/components/Time.svelte";
  import { graphWidth } from "@git-manager/ui/logic/graphModel";
  import type { RevealPlace } from "@git-manager/ui/logic/listWiring.svelte";
  import type { DataColumn } from "@git-manager/ui/logic/table";
  import type { Snippet } from "svelte";
  import { sortRefs } from "$lib/log/format";
  import { refChips } from "$lib/log/logFilter";
  import type { LogEntry } from "$lib/log/logHistory.svelte";
  import type { BisectBadge, BisectBadgeKind } from "$lib/views/git/bisectBanner";

  interface Props {
    entries: LogEntry[];
    selected: string | null;
    laneCount: number;
    /** While filtered, the graph shows only each commit's node. */
    filtered: boolean;
    bisectMarks: Map<string, BisectBadge[]>;
    field: HTMLInputElement | null;
    empty: Snippet;
    onopen: (commitId: string) => void;
    oncontextmenu: (event: MouseEvent, entry: LogEntry) => void;
    onnearend: () => void;
  }

  let {
    entries,
    selected = $bindable(),
    laneCount,
    filtered,
    bisectMarks,
    field,
    empty,
    onopen,
    oncontextmenu,
    onnearend,
  }: Props = $props();

  const MAX_CHIPS = 3;
  const columns: DataColumn[] = [
    { id: "subject", label: "Subject", width: "fill" },
    { id: "author", label: "Author", width: "medium", tone: "dim" },
    { id: "date", label: "Date", width: "small", tone: "dim" },
    { id: "hash", label: "Hash", width: "xsmall", tone: "faint", mono: true, small: true },
  ];

  let table = $state<{ focus: () => void; reveal: (key: string, place?: RevealPlace) => Promise<void> } | null>(null);

  export function focus(): void {
    table?.focus();
  }

  export function reveal(commitId: string, place: RevealPlace = "nearest"): Promise<void> {
    return table?.reveal(commitId, place) ?? Promise.resolve();
  }

  const bisectKind = (kind: BisectBadgeKind) => `bisect-${kind}` as const;
  const isHead = (entry: LogEntry) => (entry.commit.refs ?? []).some((ref) => ref.kind === "head");
</script>

<DataTable
  bind:this={table}
  label="Commits"
  {columns}
  rows={entries}
  rowKey={(entry) => entry.commit.id}
  bind:selected
  leadWidth={filtered ? graphWidth(1) : graphWidth(laneCount)}
  {field}
  {empty}
  onopen={(entry) => onopen(entry.commit.id)}
  oncontextmenu={(entry, event) => oncontextmenu(event, entry)}
  {onnearend}
>
  {#snippet lead(entry)}
    <CommitGraph
      row={entry.row}
      {laneCount}
      head={isHead(entry)}
      merge={entry.commit.parents.length > 1}
      nodeOnly={filtered}
    />
  {/snippet}
  {#snippet cell(entry, column)}
    {@const commit = entry.commit}
    {#if column.id === "subject"}
      {@const chips = refChips(sortRefs(commit.refs ?? []), MAX_CHIPS)}
      {#each bisectMarks.get(commit.id) ?? [] as mark (mark.kind)}
        <RefLabel kind={bisectKind(mark.kind)} label={mark.label} title="Bisect: {mark.label}" />
      {/each}
      {#each chips.shown as ref (`${ref.kind}:${ref.name}`)}
        <RefLabel kind={ref.kind} label={ref.name} icon={ref.kind === "tag" ? "tag" : null} />
      {/each}
      {#if chips.more}
        <RefLabel kind="more" label="+{chips.more.count}" title={chips.more.names} />
      {/if}
      <Text
        truncate
        weight={isHead(entry) ? "semibold" : undefined}
        title={`${commit.summary}\nDouble-click to open in a tab`}>{commit.summary}</Text
      >
    {:else if column.id === "author"}
      <Text truncate tone="dim" title={commit.authorEmail}>{commit.authorName}</Text>
    {:else if column.id === "date"}
      <Time time={commit.time * 1000} />
    {:else}
      {commit.shortId}
    {/if}
  {/snippet}
</DataTable>
