<!-- The changed files of a branch comparison: status letter, name and folder; Up and Down
     move the selection. -->
<script lang="ts">
  import EmptyState from "@nibtree/ui/components/EmptyState.svelte";
  import List from "@nibtree/ui/components/List.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import StatusLetter from "@nibtree/ui/components/StatusLetter.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { fileDir, fileName } from "$lib/log/format";
  import type { ChangedFile } from "$lib/types";

  interface Props {
    files: ChangedFile[];
    selectedPath: string | null;
    onselect: (file: ChangedFile) => void;
  }

  let { files, selectedPath, onselect }: Props = $props();
</script>

<List
  items={files}
  itemKey={(file) => file.path}
  label="Changed files"
  selected={selectedPath}
  {onselect}
  onactivate={onselect}
>
  {#snippet row(file, state)}
    <Row selected={state.selected} title={file.origPath ? `${file.origPath} -> ${file.path}` : file.path}>
      <StatusLetter kind={file.status} />
      <Text truncate>{fileName(file.path)}</Text>
      <Text tone="dim" truncate>{fileDir(file.path)}</Text>
    </Row>
  {/snippet}
  {#snippet empty()}
    <EmptyState variant="panel" title="No files differ" />
  {/snippet}
</List>
