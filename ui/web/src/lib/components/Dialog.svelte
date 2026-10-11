<!-- A modal dialog over a dimmed window: a title, the content and the actions on the right. Esc and a click on the
     dim area close it unless `dismissible` is false. Focus moves into it and back when it closes. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    open?: boolean;
    title: string;
    width?: "normal" | "wide";
    dismissible?: boolean;
    onclose?: () => void;
    actions?: Snippet;
    children: Snippet;
  }

  let { open = $bindable(false), title, width = "normal", dismissible = true, onclose, actions, children }: Props =
    $props();

  const titleId = $props.id();
  let dialogEl = $state<HTMLDivElement | null>(null);
  let returnFocus: HTMLElement | null = null;

  function close(): void {
    open = false;
    onclose?.();
  }

  $effect(() => {
    if (!open || !dialogEl) {
      return;
    }
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = dialogEl.querySelector<HTMLElement>("[autofocus], input, textarea, select, button:not(:disabled)");
    (first ?? dialogEl).focus();
    return () => {
      if (returnFocus?.isConnected) {
        returnFocus.focus();
      }
    };
  });

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && dismissible && !event.defaultPrevented) {
      event.preventDefault();
      close();
    }
  }
</script>

{#if open}
  <div
    class="overlay"
    role="presentation"
    onmousedown={(event) => dismissible && event.target === event.currentTarget && close()}
  >
    <div
      bind:this={dialogEl}
      class="dialog"
      class:wide={width === "wide"}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      {onkeydown}
    >
      <h2 id={titleId}>{title}</h2>
      {@render children()}
      {#if actions}
        <div class="actions">{@render actions()}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 900;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 14vh;
    background: var(--overlay);
  }

  .dialog {
    width: min(var(--dialog-width), calc(100vw - 32px));
    padding: var(--dialog-padding-top) var(--dialog-padding-x) var(--dialog-padding-bottom);
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: var(--dialog-radius);
    box-shadow: var(--shadow);
    outline: none;
  }

  .wide {
    width: min(var(--dialog-wide-width), calc(100vw - 32px));
  }

  h2 {
    margin: 0 0 var(--dialog-title-gap);
    font-size: var(--font-size-title);
    font-weight: var(--font-weight-semibold);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--dialog-actions-gap);
    margin-top: var(--dialog-actions-top);
  }
</style>
