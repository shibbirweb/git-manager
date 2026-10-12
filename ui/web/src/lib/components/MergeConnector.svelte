<!-- The column between two merge panes: a ribbon per chunk joining its lines on both sides, and the chunk's
     buttons (apply its side's change, or ignore it) at its top. MergeView measures; this draws. -->
<script lang="ts">
  import type { ChunkKind } from "../logic/mergeGeometry";
  import { ribbonPath } from "../logic/mergeGeometry";
  import { componentTokens } from "../styles/tokens";
  import Icon from "./Icon.svelte";

  export interface ConnectorRibbon {
    index: number;
    kind: ChunkKind;
    aTop: number;
    aBottom: number;
    bTop: number;
    bBottom: number;
    /** The change is added after the other side's (both sides added lines): the title says Append. */
    append?: boolean;
  }

  interface Props {
    ribbons: ConnectorRibbon[];
    side: "left" | "right";
    onapply?: (index: number) => void;
    onignore?: (index: number) => void;
  }

  let { ribbons, side, onapply, onignore }: Props = $props();

  const width = componentTokens.mergeView.gap;
</script>

<div class="connector">
  <svg {width} aria-hidden="true">
    {#each ribbons as ribbon (ribbon.index)}
      <path
        class="ribbon {ribbon.kind}"
        d={ribbonPath(ribbon.aTop, ribbon.aBottom, ribbon.bTop, ribbon.bBottom, width)}
      />
    {/each}
  </svg>
  {#each ribbons as ribbon (ribbon.index)}
    <!-- Apply sits next to its own pane: first on the left, last on the right. -->
    <div class="buttons {side}" style:top="{(side === 'left' ? ribbon.aTop : ribbon.bTop) + 1}px">
      {#if side === "right"}{@render ignoreButton(ribbon.index)}{/if}
      <button
        class="chunk-btn apply {ribbon.kind}"
        type="button"
        title="{ribbon.append ? 'Append' : 'Apply'} {side} change"
        onclick={() => onapply?.(ribbon.index)}
      >
        <Icon name={side === "left" ? "chevrons-right" : "chevrons-left"} size="compact" stroke="bold" />
      </button>
      {#if side === "left"}{@render ignoreButton(ribbon.index)}{/if}
    </div>
  {/each}
</div>

{#snippet ignoreButton(index: number)}
  <button class="chunk-btn ignore" type="button" title="Ignore {side} change" onclick={() => onignore?.(index)}>
    <Icon name="x" size="small" stroke="bold" />
  </button>
{/snippet}

<style>
  .connector {
    flex: none;
    width: var(--merge-view-gap);
    position: relative;
    overflow: hidden;
    background: var(--editor-bg);
  }

  svg {
    position: absolute;
    inset: 0;
    height: 100%;
  }

  .ribbon {
    stroke-width: 1;
  }

  .modified {
    fill: var(--diff-modified);
    stroke: var(--diff-modified-edge);
  }

  .added {
    fill: var(--diff-added);
    stroke: var(--diff-added-edge);
  }

  .deleted {
    fill: var(--diff-deleted);
    stroke: var(--diff-deleted-edge);
  }

  .conflict {
    fill: var(--diff-conflict);
    stroke: var(--diff-conflict-edge);
  }

  .buttons {
    position: absolute;
    display: flex;
    gap: var(--space-1);
  }

  .buttons.left {
    left: var(--space-1);
  }

  .buttons.right {
    right: var(--space-1);
  }

  .chunk-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--merge-view-button-width);
    height: var(--merge-view-button-height);
    padding: 0;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-small);
    background: var(--panel);
    color: var(--text-dim);
    cursor: pointer;
  }

  .chunk-btn:hover {
    color: var(--text);
    border-color: var(--text-dim);
  }

  .chunk-btn.apply.modified {
    color: var(--diff-modified-edge);
  }

  .chunk-btn.apply.added {
    color: var(--diff-added-edge);
  }

  .chunk-btn.apply.deleted {
    color: var(--diff-deleted-edge);
  }

  .chunk-btn.apply.conflict {
    color: var(--diff-conflict-edge);
  }

  .chunk-btn.ignore:hover {
    color: var(--danger);
  }
</style>
