<!-- A dialog's head when it has more than a title: an icon on a tinted tile, the title with a dim subtitle under it,
     and a close button when `onclose` is given. Dialog draws it from its `icon`, `subtitle` and `panel` variant. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";
  import IconButton from "./IconButton.svelte";

  interface Props {
    title: string;
    titleId?: string;
    subtitle?: string;
    icon?: IconName | null;
    iconTone?: "accent" | "success" | "warning" | "danger";
    size?: "normal" | "panel" | "content";
    onclose?: () => void;
  }

  let { title, titleId, subtitle = "", icon = null, iconTone = "accent", size = "normal", onclose }: Props = $props();
</script>

<div class="head {size}" class:with-icon={!!icon}>
  {#if icon}<span class="icon-tile {iconTone}"><Icon name={icon} size="regular" /></span>{/if}
  <div class="head-text">
    <h2 id={titleId}>{title}</h2>
    {#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
  </div>
  {#if onclose && !icon}<IconButton icon="x" label="Close" iconSize="normal" onclick={onclose} />{/if}
</div>

<style>
  .head {
    display: flex;
    align-items: flex-start;
    gap: var(--dialog-head-gap);
    margin-bottom: var(--dialog-head-bottom);
  }

  .subtitle {
    margin: 0;
  }

  h2 {
    margin: var(--space-1) 0;
    font-size: var(--text-title-size);
    font-weight: var(--text-title-weight);
    overflow-wrap: anywhere;
  }

  .panel h2 {
    margin: 0;
  }

  .head-text {
    flex: 1;
    min-width: 0;
  }

  .subtitle {
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }

  .icon-tile {
    --tone: var(--accent);
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--dialog-head-icon-size);
    height: var(--dialog-head-icon-size);
    border-radius: var(--dialog-head-icon-radius);
    background: color-mix(in srgb, var(--tone) 14%, transparent);
    color: var(--tone);
  }

  .success {
    --tone: var(--success);
  }

  .warning {
    --tone: var(--warning);
  }

  .danger {
    --tone: var(--danger);
  }

  .panel {
    align-items: center;
    gap: var(--panel-dialog-head-gap);
    margin: 0;
    padding: var(--panel-dialog-head-padding-top) var(--panel-dialog-head-padding-right)
      var(--panel-dialog-head-padding-bottom) var(--panel-dialog-head-padding-left);
  }

  .panel.with-icon {
    align-items: flex-start;
    padding: var(--panel-dialog-icon-head-padding-top) var(--panel-dialog-body-padding-x)
      var(--panel-dialog-icon-head-padding-bottom);
  }

  /* A split dialog's content: the section's title with the close button, Settings' head. */
  .content {
    align-items: center;
    justify-content: space-between;
    gap: normal;
    margin: 0;
    padding: var(--dialog-head-content-padding-top) var(--dialog-head-content-padding-right)
      var(--dialog-head-content-padding-bottom) var(--dialog-head-content-padding-left);
  }

  .content h2 {
    margin: 0;
  }

  .panel .icon-tile {
    width: var(--panel-dialog-icon-size);
    height: var(--panel-dialog-icon-size);
    border-radius: var(--panel-dialog-icon-radius);
  }
</style>
