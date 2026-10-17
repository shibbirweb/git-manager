<!-- Search Everywhere's results: a virtual List driven by the search field (arrows, Page keys, Ctrl+N/P, Enter),
     with headings, files, symbols, "more" rows and Text matches grouped under their files. -->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import EmptyState from "@nibtree/ui/components/EmptyState.svelte";
  import HighlightText from "@nibtree/ui/components/HighlightText.svelte";
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import List from "@nibtree/ui/components/List.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import SectionTitle from "@nibtree/ui/components/SectionTitle.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { partsToRanges } from "@nibtree/ui/logic/highlight";
  import { isSelectable, type PopupRow } from "./popupRows";
  import SymbolResult from "./SymbolResult.svelte";
  import TextResult from "./TextResult.svelte";

  interface Props {
    rows: PopupRow[];
    field: HTMLInputElement | null;
    selected: string | null;
    /** Text tab with its Replace field: each file gets a Replace button. */
    replaceOpen: boolean;
    replaceDisabled: boolean;
    emptyText: string;
    onactivate: (row: PopupRow, event?: { shiftKey: boolean; metaKey: boolean }) => void;
    onreplace: (filePath: string) => void;
  }

  let {
    rows,
    field,
    selected = $bindable(null),
    replaceOpen,
    replaceDisabled,
    emptyText,
    onactivate,
    onreplace,
  }: Props = $props();
</script>

<List
  items={rows}
  itemKey={(row) => row.key}
  label="Results"
  height="xlarge"
  virtual="relaxed"
  {field}
  fieldKeys="drive"
  clickActivates
  skip={(row) => !isSelectable(row)}
  bind:selected
  {onactivate}
>
  {#snippet row(row, rowState)}
    {#if row.kind === "header"}
      <SectionTitle variant="picker" title={row.label} />
    {:else if row.kind === "textFile"}
      <Row title={row.path}>
        <TextResult {row} />
        {#if replaceOpen}
          <Button
            size="mini"
            keepFocus
            disabled={replaceDisabled}
            title="Replace the matches in this file (asks first)"
            onclick={() => onreplace(row.path)}
          >
            Replace
          </Button>
        {/if}
      </Row>
    {:else}
      <Row
        selected={rowState.selected}
        title={row.kind === "file" ? row.file.path : row.kind === "symbol" ? row.symbol.title : undefined}
      >
        {#if row.kind === "file"}
          {@const name = partsToRanges(row.file.nameParts)}
          {@const folder = partsToRanges(row.file.folderParts)}
          <Icon name="file" size="normal" />
          <Text truncate><HighlightText text={name.text} ranges={name.ranges} /></Text>
          <Text size="small" tone="faint" truncate><HighlightText text={folder.text} ranges={folder.ranges} /></Text>
        {:else if row.kind === "symbol"}
          <SymbolResult symbol={row.symbol} />
        {:else if row.kind === "more"}
          <Icon name="more" size="normal" />
          <Text>{row.label}</Text>
        {:else}
          <TextResult {row} />
        {/if}
      </Row>
    {/if}
  {/snippet}
  {#snippet empty()}
    <EmptyState variant="panel" title={emptyText} titleTone="dim" />
  {/snippet}
</List>
