<!-- Draws the toasts as notification balloons in the bottom right corner, above the status bar and beside the right
     activity bar, newest at the bottom. It shows `items`; the store decides when they go, and `onhold` tells it the
     pointer is over one so it can stay. -->
<script lang="ts">
  import type { ToastItem } from "../logic/toastModel";
  import Notification from "./Notification.svelte";

  interface Props {
    items: ToastItem[];
    ondismiss: (id: number) => void;
    onaction?: (id: number) => void;
    onhold?: (id: number, held: boolean) => void;
  }

  let { items, ondismiss, onaction, onhold }: Props = $props();
</script>

<div class="toasts">
  {#each items as item (item.id)}
    <Notification
      kind={item.kind}
      title={item.title}
      detail={item.detail ?? null}
      source={item.source ?? null}
      actionLabel={item.action?.label ?? null}
      onaction={() => onaction?.(item.id)}
      ondismiss={() => ondismiss(item.id)}
      onhold={(held) => onhold?.(item.id, held)}
    />
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: var(--toast-offset-right);
    bottom: var(--toast-offset-bottom);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--toast-gap);
    max-width: calc(100vw - 2 * var(--toast-offset-right));
  }
</style>
