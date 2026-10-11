<!-- The centered message of an empty panel or tab, with an optional icon, hint and action. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    title: string;
    hint?: string;
    icon?: IconName | null;
    action?: Snippet;
  }

  let { title, hint = "", icon = null, action }: Props = $props();
</script>

<div class="empty">
  {#if icon}
    <Icon name={icon} size={18} />
  {/if}
  <div class="title">{title}</div>
  {#if hint}
    <div class="hint">{hint}</div>
  {/if}
  {@render action?.()}
</div>

<style>
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--empty-state-gap);
    padding: var(--empty-state-padding);
    text-align: center;
  }

  .hint {
    color: var(--text-dim);
  }
</style>
