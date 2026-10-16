<!-- A patch in monospace with its lines colored: added and removed lines tinted, hunk headers in the accent color,
     file headers bold. Read-only and selectable; for an editable or side-by-side diff use DiffView. Give `patch`
     (git diff output) or `lines` already split. `note` adds a last hunk-styled line, such as "the diff is cut
     short". -->
<script lang="ts">
  import { patchLines, type PatchLine } from "../logic/patchLines";

  interface Props {
    patch?: string;
    lines?: PatchLine[] | null;
    note?: string;
    label: string;
  }

  let { patch = "", lines = null, note = "", label }: Props = $props();

  const shown = $derived(lines ?? patchLines(patch));
</script>

<div class="patch" role="document" aria-label={label}>
  {#each shown as line, index (index)}
    <div class="line {line.kind}">{line.text || " "}</div>
  {/each}
  {#if note}<div class="line hunk">{note}</div>{/if}
</div>

<style>
  .patch {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--patch-view-padding-y) 0;
    background: var(--editor-bg);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-code);
    line-height: var(--patch-view-line-height);
    white-space: pre;
    user-select: text;
  }

  .line {
    min-width: max-content;
    padding: 0 var(--patch-view-line-padding-x);
  }

  .file {
    color: var(--text-dim);
    font-weight: var(--font-weight-semibold);
  }

  .hunk {
    color: var(--accent);
    background: var(--panel-alt);
  }

  .added {
    background: var(--diff-added);
  }

  .deleted {
    background: var(--diff-deleted);
  }
</style>
