<script lang="ts">
  import type { ChangeKind, FileStatus } from "$lib/types";
  import FileTypeIcon from "$lib/fileIcons/FileTypeIcon.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { splitPath, statusLetter, statusTitle, type RowAction } from "./fileStatus";

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

  let { file, kind, selected, id, nested = false, actions, badge = null, note = null, onselect, onactivate, oncontextmenu }: Props =
    $props();

  const parts = $derived(splitPath(file.path));
  const title = $derived(
    (file.origPath && kind === "renamed"
      ? `${statusTitle(kind)}: ${file.origPath} -> ${file.path}`
      : `${statusTitle(kind)}: ${file.path}`) + (note ? ` (${note})` : ""),
  );

  function runAction(event: MouseEvent, action: RowAction): void {
    event.stopPropagation();
    action.run();
  }
</script>

<!-- The list owns the keyboard (see ChangesView), so a click must not move the focus onto the row. -->
<div
  class="row"
  class:selected
  class:nested
  {id}
  role="option"
  tabindex="-1"
  aria-selected={selected}
  data-path={file.path}
  {title}
  onmousedown={(event) => event.preventDefault()}
  onclick={onselect}
  ondblclick={onactivate}
  oncontextmenu={(event) => {
    onselect();
    oncontextmenu(event);
  }}
  onkeydown={(event) => {
    // Only when the row itself got the focus; the list handles its keys otherwise.
    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
      onactivate();
    }
  }}
>
  <span class="letter kind-{kind ?? 'conflicted'}">{statusLetter(kind)}</span>
  <FileTypeIcon fileName={parts.name} plain={false} />
  <span class="text truncate">
    <span class="name" class:deleted={kind === "deleted"}>{parts.name}</span>
    {#if parts.directory}
      <span class="directory">{parts.directory}</span>
    {/if}
    {#if note}
      <span class="directory">({note})</span>
    {/if}
  </span>
  {#if badge}
    <span class="tag">{badge}</span>
  {/if}
  {#if actions.length > 0}
    <span class="actions">
      {#each actions as action (action.title)}
        <button
          class="action"
          class:danger={action.danger}
          title={action.title}
          aria-label={action.title}
          onclick={(event) => runAction(event, action)}
          ondblclick={(event) => event.stopPropagation()}
        >
          <Icon name={action.icon} size={13} />
        </button>
      {/each}
    </span>
  {/if}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    padding: 0 6px 0 28px;
    cursor: default;
    outline: none;
  }

  .row.nested {
    padding-left: 40px;
  }

  .row:hover {
    background: var(--hover);
  }

  .row.selected {
    background: var(--selected-inactive);
  }

  :global(.file-list:focus-within) .row.selected {
    background: var(--selected);
  }

  .letter {
    flex: none;
    width: 12px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 700;
    text-align: center;
  }

  .kind-added {
    color: var(--success);
  }

  .kind-modified,
  .kind-typechange {
    color: var(--accent);
  }

  .kind-deleted {
    color: var(--danger);
    opacity: 0.8;
  }

  .kind-renamed {
    color: var(--tok-property);
  }

  .kind-untracked {
    color: color-mix(in srgb, var(--success) 60%, var(--text-faint));
  }

  .kind-conflicted {
    color: var(--danger);
  }

  .text {
    flex: 1;
    min-width: 0;
  }

  .name {
    color: var(--text);
  }

  .name.deleted {
    color: var(--text-dim);
    text-decoration: line-through;
    text-decoration-color: var(--text-faint);
  }

  .directory {
    margin-left: 6px;
    color: var(--text-dim);
    font-size: 12px;
  }

  .tag {
    flex: none;
    padding: 0 5px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--text-dim);
    font-size: 10px;
    font-weight: 600;
    line-height: 14px;
  }

  .actions {
    flex: none;
    display: none;
    gap: 1px;
  }

  .row:hover .actions {
    display: flex;
  }

  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .action:hover {
    background: var(--border-strong);
    color: var(--text);
  }

  .action.danger:hover {
    color: var(--danger);
  }
</style>
