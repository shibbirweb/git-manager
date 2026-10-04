<!-- Title row of a sidebar panel, like the Changes and Files panels: the name, buttons and a close X. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "$lib/ui/Icon.svelte";

  interface Props {
    title: string;
    /** Tooltip of the close button. */
    hideTitle: string;
    onhide: () => void;
    /** Buttons left of the close button. */
    children?: Snippet;
  }

  let { title, hideTitle, onhide, children }: Props = $props();
</script>

<div class="head">
  <span class="title truncate">{title}</span>
  <div class="spacer"></div>
  {@render children?.()}
  <button class="icon-btn small" onclick={onhide} title={hideTitle} aria-label={hideTitle}>
    <Icon name="x" size={14} />
  </button>
</div>

<style>
  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 6px 0 12px;
    border-bottom: 1px solid var(--border-strong);
  }

  .title {
    min-width: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .spacer {
    flex: 1;
  }

  .head :global(.icon-btn.small) {
    height: 24px;
    min-width: 24px;
  }
</style>
