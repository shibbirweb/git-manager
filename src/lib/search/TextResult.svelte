<!-- One row of the Text tab: a file heading its matches, or a matching line. -->
<script lang="ts">
  import Icon from "$lib/ui/Icon.svelte";
  import type { TextRow } from "./textSearchModel";

  let { row }: { row: TextRow } = $props();
</script>

{#if row.kind === "textFile"}
  <Icon name="file" size={13} />
  <span class="file">{row.name}</span>
  <span class="folder">{row.folder}</span>
  <span class="count">{row.count}</span>
{:else}
  <span class="number">{row.line}</span>
  <span class="text">{#each row.parts as part, partIndex (partIndex)}{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</span>
{/if}

<style>
  .file {
    flex: none;
    max-width: 55%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    font-weight: 600;
    color: var(--text);
  }

  .folder {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    font-size: 12px;
    color: var(--text-faint);
  }

  .count {
    flex: none;
    font-size: 11px;
    color: var(--text-faint);
  }

  .number {
    flex: none;
    min-width: 38px;
    padding-left: 12px;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--editor-line-number);
  }

  .text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    font-family: var(--font-mono);
    font-size: var(--code-size);
    color: var(--text);
  }

  mark {
    background: var(--diff-inline);
    color: inherit;
    border-radius: 2px;
  }
</style>
