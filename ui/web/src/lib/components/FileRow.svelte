<!-- A changed file in a list: its status letter, type icon, name and dim folder, an optional tag and the actions
     that show on hover (stage, discard...). Click selects, double-click or Enter opens. `checked` adds a box for
     lists that pick files, such as Shelve. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import type { FileKind } from "../logic/fileStatus";
  import FileIcon, { type FileIconView } from "./FileIcon.svelte";
  import Icon from "./Icon.svelte";
  import StatusLetter from "./StatusLetter.svelte";

  interface FileAction {
    icon: IconName;
    title: string;
    danger?: boolean;
    run: () => void;
  }

  interface Props {
    kind: FileKind | null;
    name: string;
    directory?: string;
    note?: string;
    badge?: string;
    icon?: FileIconView;
    selected?: boolean;
    nested?: boolean;
    variant?: "changes" | "list";
    checked?: boolean | null;
    title?: string;
    id?: string;
    keepFocus?: boolean;
    actions?: FileAction[];
    onselect?: () => void;
    onactivate?: () => void;
    oncontextmenu?: (event: MouseEvent) => void;
  }

  let {
    kind,
    name,
    directory = "",
    note = "",
    badge = "",
    icon = null,
    selected = false,
    nested = false,
    variant = "changes",
    checked = $bindable(null),
    title,
    id,
    keepFocus = false,
    actions = [],
    onselect,
    onactivate,
    oncontextmenu,
  }: Props = $props();
</script>

<div
  class="row {variant}"
  class:selected
  class:nested
  role="option"
  tabindex="-1"
  aria-selected={selected}
  {id}
  {title}
  onmousedown={(event) => keepFocus && event.preventDefault()}
  onclick={() => onselect?.()}
  ondblclick={() => onactivate?.()}
  oncontextmenu={(event) => {
    onselect?.();
    oncontextmenu?.(event);
  }}
  onkeydown={(event) => {
    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onactivate?.();
    }
  }}
>
  {#if checked !== null}
    <input
      class="check"
      type="checkbox"
      aria-label="Include {name}"
      bind:checked
      onclick={(event) => event.stopPropagation()}
    />
  {/if}
  <StatusLetter {kind} />
  <FileIcon view={icon} plain={false} />
  <span class="text">
    <span class="name" class:deleted={kind === "deleted"}>{name}</span>
    {#if directory}<span class="directory">{directory}</span>{/if}
    {#if note}<span class="directory">({note})</span>{/if}
  </span>
  {#if badge}<span class="tag">{badge}</span>{/if}
  {#if actions.length}
    <span class="actions">
      {#each actions as action (action.title)}
        <button
          class="action"
          class:danger={action.danger}
          type="button"
          title={action.title}
          aria-label={action.title}
          onclick={(event) => {
            event.stopPropagation();
            action.run();
          }}
          ondblclick={(event) => event.stopPropagation()}
        >
          <Icon name={action.icon} size="medium" />
        </button>
      {/each}
    </span>
  {/if}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--file-row-gap);
    height: var(--file-row-height);
    padding: 0 var(--file-row-padding-right) 0 var(--file-row-padding-left);
    cursor: default;
    outline: none;
  }

  .nested {
    padding-left: var(--file-row-nested-padding-left);
  }

  .row:hover {
    background: var(--hover);
  }

  .selected {
    background: var(--selected-inactive);
  }

  :global([role="listbox"]:focus-within) .selected {
    background: var(--selected);
  }

  /* A plain list of a branch's or commit's files: no indent, selected over hover, a lighter letter. */
  .list {
    gap: var(--space-4);
    padding: 0 var(--file-row-list-padding-x);
  }

  .list.selected {
    background: var(--selected-inactive);
  }

  :global([role="listbox"]:focus-within) .list.selected {
    background: var(--selected);
  }

  .list :global(.letter) {
    font-weight: var(--font-weight-semibold);
  }

  .list .directory {
    margin-left: var(--space-4);
  }

  .check {
    margin: 0;
  }

  .text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    margin-left: var(--space-3);
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }

  .tag {
    flex: none;
    padding: 0 var(--file-row-tag-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-small);
    color: var(--text-dim);
    font-size: var(--font-size-tiny);
    font-weight: var(--font-weight-semibold);
    line-height: var(--file-row-tag-line-height);
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
    width: var(--file-row-action-size);
    height: var(--file-row-action-size);
    padding: 0;
    border: none;
    border-radius: var(--radius-small);
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
