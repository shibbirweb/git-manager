<!-- A big start action with its icon on a rounded tile and its name under it, like Open, Clone and New on the
     Welcome page. The tile turns accent on hover and focus. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    icon: IconName;
    label: string;
    title?: string;
    onclick: () => void;
  }

  let { icon, label, title, onclick }: Props = $props();
</script>

<button class="tile" type="button" {title} {onclick}>
  <span class="tile-icon"><Icon name={icon} size="huge" /></span>
  {label}
</button>

<style>
  .tile {
    width: var(--tile-width);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--tile-gap);
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }

  .tile-icon {
    width: var(--tile-icon-size);
    height: var(--tile-icon-size);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-strong);
    border-radius: var(--tile-icon-radius);
    background: var(--panel-alt);
    color: var(--text);
    transition:
      border-color var(--motion-fast),
      color var(--motion-fast);
  }

  .tile:hover .tile-icon,
  .tile:focus-visible .tile-icon {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
