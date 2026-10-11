<!-- Asks before an action: a title, a message and Cancel / OK. `danger` makes the confirm button red, for actions
     that lose work. Enter confirms. -->
<script lang="ts">
  import Button from "./Button.svelte";
  import Dialog from "./Dialog.svelte";

  interface Props {
    open?: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onconfirm: () => void;
    oncancel?: () => void;
  }

  let {
    open = $bindable(false),
    title,
    message = "",
    confirmLabel = "OK",
    cancelLabel = "Cancel",
    danger = false,
    onconfirm,
    oncancel,
  }: Props = $props();

  function confirm(): void {
    open = false;
    onconfirm();
  }
</script>

<Dialog bind:open {title} onclose={() => oncancel?.()}>
  {#if message}
    <p class="message">{message}</p>
  {/if}
  {#snippet actions()}
    <Button
      onclick={() => {
        open = false;
        oncancel?.();
      }}
    >
      {cancelLabel}
    </Button>
    <Button variant={danger ? "danger-primary" : "primary"} autofocus onclick={confirm}>{confirmLabel}</Button>
  {/snippet}
</Dialog>

<style>
  .message {
    margin: 0 0 var(--dialog-message-gap);
    line-height: 1.5;
    white-space: pre-wrap;
    color: var(--text-dim);
    user-select: text;
    -webkit-user-select: text;
  }
</style>
