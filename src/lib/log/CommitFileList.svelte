<!-- The changed files of a commit. A merge lists the files changed on both sides, or every parent's changes. -->
<script lang="ts">
  import FileTypeIcon from "$lib/fileIcons/FileTypeIcon.svelte";
  import type { CommitDetails } from "$lib/types";
  import EmptyState from "@nibtree/ui/components/EmptyState.svelte";
  import Link from "@nibtree/ui/components/Link.svelte";
  import List from "@nibtree/ui/components/List.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import SectionTitle from "@nibtree/ui/components/SectionTitle.svelte";
  import StatusLetter from "@nibtree/ui/components/StatusLetter.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { type CommitFileRow, filesCaption, isMerge, type MergeView } from "./commitFiles";
  import { fileDir, fileName } from "./format";

  interface Props {
    details: CommitDetails;
    rows: CommitFileRow[];
    view: MergeView;
    /** The selected row's key. */
    selected: string | null;
    onview: (view: MergeView) => void;
    /** Enter or a double-click on a file; null where there is no tab to open. */
    onopen: ((filePath: string) => void) | null;
  }

  let { details, rows, view, selected = $bindable(), onview, onopen }: Props = $props();

  const merge = $derived(isMerge(details));
  const BOTH_SIDES_TITLE = "Show only the files the merge combined or resolved: changed on both sides";
  const PARENTS_TITLE = "Show what the merge changed against each parent";

  function fileTitle(row: Extract<CommitFileRow, { kind: "file" }>): string {
    const filePath = row.file.origPath ? `${row.file.origPath} -> ${row.file.path}` : row.file.path;
    return `${filePath}${onopen ? "\nDouble-click to open in a tab" : ""}`;
  }
</script>

<SectionTitle
  variant="caption"
  title={filesCaption(details, view)}
  count={merge && view === "merged" ? (details.mergedFiles ?? []).length : null}
>
  {#snippet actions()}
    {#if merge}
      {#if view === "merged"}
        <Link size="small" title={PARENTS_TITLE} onclick={() => onview("parents")}>Show parents</Link>
      {:else}
        <Link size="small" title={BOTH_SIDES_TITLE} onclick={() => onview("merged")}>Show both sides</Link>
      {/if}
    {/if}
  {/snippet}
</SectionTitle>
<List
  items={rows}
  itemKey={(row) => row.key}
  label="Changed files"
  height="fill"
  skip={(row) => row.kind === "heading"}
  bind:selected
  onactivate={(row) => row.kind === "file" && onopen?.(row.file.path)}
>
  {#snippet row(row, state)}
    {#if row.kind === "heading"}
      <SectionTitle variant="day" title={row.title} count={row.count} />
    {:else}
      {@const file = row.file}
      <Row selected={state.selected} title={fileTitle(row)} ondblclick={() => onopen?.(file.path)}>
        <StatusLetter kind={file.status} />
        <FileTypeIcon fileName={file.path} plain={false} />
        <Text truncate strike={file.status === "deleted"} tone={file.status === "deleted" ? "dim" : undefined}>
          {fileName(file.path)}
        </Text>
        <Text size="small" tone="dim" truncate>
          {file.origPath ? `from ${fileName(file.origPath)} ` : ""}{fileDir(file.path)}
        </Text>
      </Row>
    {/if}
  {/snippet}
  {#snippet empty()}
    {#if merge && view === "merged"}
      <EmptyState variant="panel" title="No files changed on both sides" hint="Each file came whole from one parent.">
        {#snippet action()}
          <Link size="small" title={PARENTS_TITLE} onclick={() => onview("parents")}>Show changes to parents</Link>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState variant="panel" title="No file changes" titleTone="dim" />
    {/if}
  {/snippet}
</List>
