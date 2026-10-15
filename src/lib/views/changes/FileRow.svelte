<script lang="ts">
  import type { ChangeKind, FileStatus } from "$lib/types";
  import LibraryFileRow from "@git-manager/ui/components/FileRow.svelte";
  import { fileIcons } from "$lib/fileIcons/fileIcons.svelte";
  import { splitPath, statusTitle, type RowAction } from "./fileStatus";

  interface Props {
    file: FileStatus;
    /** Change kind shown for this row; null for a conflicted file. */
    kind: ChangeKind | null;
    selected: boolean;
    /** DOM id, so the list can point screen readers at the selected row. */
    id?: string;
    /** Indented one level, under a repository header. */
    nested?: boolean;
    actions: RowAction[];
    /** A small tag after the name, e.g. "LFS" or "submodule". */
    badge?: string | null;
    /** Dim text after the path, e.g. a submodule's "new commits". */
    note?: string | null;
    onselect: () => void;
    onactivate: () => void;
    oncontextmenu: (event: MouseEvent) => void;
  }

  let {
    file,
    kind,
    selected,
    id,
    nested = false,
    actions,
    badge = null,
    note = null,
    onselect,
    onactivate,
    oncontextmenu,
  }: Props = $props();

  const parts = $derived(splitPath(file.path));
  const title = $derived(
    (file.origPath && kind === "renamed"
      ? `${statusTitle(kind)}: ${file.origPath} -> ${file.path}`
      : `${statusTitle(kind)}: ${file.path}`) + (note ? ` (${note})` : ""),
  );

  const icon = $derived(fileIcons.resolve?.(parts.name) ?? null);
</script>

<!-- The list owns the keyboard (see ChangesView), so a click must not move the focus onto the row. -->
<LibraryFileRow
  {kind}
  name={parts.name}
  directory={parts.directory}
  note={note ?? ""}
  badge={badge ?? ""}
  {icon}
  {selected}
  {nested}
  {id}
  {title}
  keepFocus
  {actions}
  {onselect}
  {onactivate}
  {oncontextmenu}
/>
