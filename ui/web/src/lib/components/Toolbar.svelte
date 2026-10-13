<!-- A row of controls along a view's edge. `variant` picks the place: a tab's top bar, a panel's bar, the diff
     editor's bar, the bar above a file (file) or the terminal panel's head (compact), the log's bar, a filter row, the
     merge editor's bar and footer, a dialog's filter bar, a pane's bar inside a dialog, a pane's head (head), a
     popup's head (popup), a vertical column of tools (rail), the tinted bar of a file with conflicts (conflict), a
     file bar along the bottom (strip) or a dialog's footer (dialog-footer); `placement` bottom puts the line on
     top. `children` sit at the start, `end` at the far end. Vertical Dividers inside take the toolbar's length and
     spacing. With `responsive` it measures its width, so a Text, Badge or Divider inside can step aside with
     `hideAt` or `dotAt` when the bar gets narrow. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { BarSize, provideBarSize } from "../logic/barSize.svelte";

  type ToolbarVariant =
    | "tab"
    | "panel"
    | "editor"
    | "file"
    | "compact"
    | "log"
    | "filter"
    | "merge"
    | "footer"
    | "dialog"
    | "pane"
    | "head"
    | "popup"
    | "rail"
    | "conflict"
    | "strip"
    | "search"
    | "dialog-footer";

  interface Props {
    variant?: ToolbarVariant;
    label: string;
    children: Snippet;
    placement?: "top" | "bottom";
    end?: Snippet;
    responsive?: boolean;
  }

  let { variant = "tab", label, placement = "top", responsive = false, children, end }: Props = $props();
  const bar = new BarSize();
  provideBarSize(bar);
</script>

<div
  class="toolbar {variant}"
  class:bottom={placement === "bottom"}
  role="toolbar"
  aria-label={label}
  aria-orientation={variant === "rail" ? "vertical" : undefined}
  use:bar.observe={responsive}
>
  {@render children()}
  {#if end}
    <span class="spacer"></span>
    {@render end()}
  {/if}
</div>

<style>
  .toolbar {
    --divider-length: var(--toolbar-divider-length);
    --divider-space: var(--toolbar-divider-space);
    flex: none;
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .spacer {
    flex: 1;
  }

  .tab {
    gap: var(--toolbar-tab-gap);
    height: var(--toolbar-tab-height);
    padding: 0 var(--toolbar-tab-padding-x);
    border-bottom: 1px solid var(--border-strong);
  }

  .panel {
    gap: var(--toolbar-panel-gap);
    height: var(--toolbar-panel-height);
    padding: 0 var(--toolbar-panel-padding-right) 0 var(--toolbar-panel-padding-left);
    border-bottom: 1px solid var(--border);
  }

  /* The editors' bars paint the panel color over the editor; the others sit on their view's background. */
  .editor,
  .file,
  .compact,
  .strip,
  .merge,
  .footer {
    background: var(--panel);
  }

  .file,
  .compact,
  .strip {
    --divider-length: var(--toolbar-file-divider-length);
    gap: var(--toolbar-file-gap);
    height: var(--toolbar-file-height);
    padding: 0 var(--toolbar-file-padding-right) 0 var(--toolbar-file-padding-left);
    border-bottom: 1px solid var(--border-strong);
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }

  /* The terminal panel's head: its words in the text color; its buttons dim themselves. */
  .compact {
    gap: var(--toolbar-compact-gap);
    color: var(--text);
  }

  /* The empty editor's bottom strip: a file bar with its line on top. */
  .strip {
    gap: normal;
    border-top: 1px solid var(--border-strong);
    border-bottom: none;
  }

  .head {
    gap: var(--toolbar-head-gap);
    padding: var(--toolbar-head-padding-y) var(--toolbar-head-padding-x);
    border-bottom: 1px solid var(--border);
  }

  .popup {
    gap: var(--toolbar-popup-gap);
    padding: var(--toolbar-popup-padding) var(--toolbar-popup-padding-x);
    border-bottom: 1px solid var(--border);
  }

  .conflict {
    flex-wrap: wrap;
    gap: var(--toolbar-conflict-gap-y) var(--toolbar-conflict-gap-x);
    min-height: var(--toolbar-conflict-min-height);
    padding: var(--toolbar-conflict-padding-y) var(--toolbar-conflict-padding-right) var(--toolbar-conflict-padding-y)
      var(--toolbar-conflict-padding-left);
    border-bottom: 1px solid var(--border-strong);
    background: color-mix(in srgb, var(--danger) 7%, var(--panel));
  }

  .rail {
    flex-direction: column;
    align-items: center;
    gap: var(--toolbar-rail-gap);
    width: var(--toolbar-rail-width);
    padding-top: var(--toolbar-rail-padding-top);
    border-right: 1px solid var(--border);
  }

  .editor {
    --divider-space: var(--toolbar-editor-divider-space);
    gap: var(--toolbar-editor-gap);
    height: var(--toolbar-editor-height);
    padding: 0 var(--toolbar-editor-padding-x);
    border-bottom: 1px solid var(--border-strong);
  }

  .log {
    gap: var(--toolbar-log-gap);
    height: var(--toolbar-log-height);
    padding: 0 var(--toolbar-log-padding-x);
    border-bottom: 1px solid var(--border-strong);
  }

  .filter {
    gap: var(--toolbar-filter-gap);
    padding: var(--toolbar-filter-padding);
  }

  /* A panel's filter row, with a line under it (Branches). */
  .search {
    padding: var(--toolbar-search-padding);
    border-bottom: 1px solid var(--border);
  }

  .merge,
  .footer {
    --divider-length: var(--toolbar-merge-divider-length);
    --divider-space: var(--toolbar-merge-divider-space);
    gap: var(--toolbar-merge-gap);
    padding: var(--toolbar-merge-padding-y) var(--toolbar-merge-padding-x);
  }

  .merge {
    border-bottom: 1px solid var(--border-strong);
  }

  .footer {
    gap: var(--toolbar-footer-gap);
    border-top: 1px solid var(--border-strong);
  }

  .dialog {
    gap: var(--toolbar-dialog-gap);
    padding: var(--toolbar-dialog-padding-top) var(--toolbar-dialog-padding-x) var(--toolbar-dialog-padding-bottom);
    border-bottom: 1px solid var(--border-strong);
  }

  .pane {
    gap: var(--toolbar-pane-gap);
    padding: var(--toolbar-pane-padding-y) var(--toolbar-pane-padding-x);
    border-bottom: 1px solid var(--border);
  }

  /* A dialog's footer with a note and buttons, like Keyboard Shortcuts' help. */
  .dialog-footer {
    gap: var(--toolbar-dialog-footer-gap);
    padding: var(--toolbar-dialog-footer-padding-y) var(--toolbar-dialog-footer-padding-x);
    border-top: 1px solid var(--border-strong);
    font-size: var(--font-size-small);
  }

  /* A bar placed under its view (File toolbar: Bottom): its line on top. */
  .bottom {
    border-top: 1px solid var(--border-strong);
    border-bottom: none;
  }
</style>
