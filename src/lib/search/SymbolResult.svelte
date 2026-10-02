<!-- One class or symbol in the Search Everywhere popup: kind badge, name, container and file. -->
<script lang="ts">
  import type { SymbolRow } from "./symbolSearchModel";

  let { symbol }: { symbol: SymbolRow } = $props();
</script>

<span class="badge {symbol.kind.tone}" title={symbol.kind.label}>{symbol.kind.letter}</span>
<span class="name">{#each symbol.nameParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}</span>
{#if symbol.containerParts.length > 0}
  <span class="container">in {#each symbol.containerParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}</span>
{/if}
<span class="location">{symbol.location}</span>

<style>
  .badge {
    flex: none;
    width: 15px;
    height: 15px;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9.5px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--panel);
  }

  .badge.type {
    background: var(--tok-type);
  }

  .badge.interface {
    background: var(--tok-keyword);
  }

  .badge.function {
    background: var(--tok-function);
  }

  .badge.constant {
    background: var(--tok-property);
  }

  .name {
    flex: none;
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    color: var(--text);
  }

  .container {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    font-size: 12px;
    color: var(--text-dim);
  }

  .location {
    flex: 0 1 auto;
    margin-left: auto;
    min-width: 0;
    max-width: 45%;
    padding-left: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    text-align: right;
    font-size: 12px;
    color: var(--text-faint);
  }

  b {
    font-weight: 600;
    color: var(--accent);
  }
</style>
