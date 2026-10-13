<!-- A ref's chip in the log and commit details: HEAD filled with the accent, local branches green, remote ones
     violet, tags amber, bisect marks in their colors, and a "+3" chip for the rest. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  export type RefKind =
    "head" | "local" | "remote" | "tag" | "more" | "bisect-bad" | "bisect-good" | "bisect-skip" | "bisect-current";

  interface Props {
    kind: RefKind;
    label: string;
    title?: string;
    icon?: IconName | null;
  }

  let { kind, label, title, icon = null }: Props = $props();
</script>

<span class="ref {kind}" title={title ?? label}>
  {#if icon}<Icon name={icon} size="xsmall" />{/if}
  <span class="name">{label}</span>
</span>

<style>
  .ref {
    --ref-color: var(--text-dim);
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: var(--ref-label-gap);
    max-width: var(--ref-label-max-width);
    height: var(--ref-label-height);
    padding: 0 var(--ref-label-padding-x);
    border: 1px solid color-mix(in srgb, var(--ref-color) 45%, transparent);
    border-radius: var(--ref-label-radius);
    background: color-mix(in srgb, var(--ref-color) 14%, var(--row-bg, var(--panel)));
    color: color-mix(in srgb, var(--ref-color) 80%, var(--text));
    font-size: var(--font-size-xsmall);
    line-height: var(--ref-label-line-height);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .head {
    --ref-color: var(--accent);
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-text);
    font-weight: var(--font-weight-bold);
  }

  .local,
  .bisect-good {
    --ref-color: var(--success);
  }

  .remote {
    /* The app's violet for remote branches, mixed from the accent. */
    --ref-color: color-mix(in srgb, var(--accent) 45%, #b04ad8);
  }

  .tag,
  .bisect-current {
    --ref-color: var(--warning);
  }

  .bisect-bad {
    --ref-color: var(--danger);
  }
</style>
