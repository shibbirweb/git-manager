<!-- A modal dialog over a dimmed window. `message` (a question and buttons, like confirms), `form` (the Git
     dialogs: a scrolling body of fields and a footer; Cmd+Enter submits) or `split` (Settings: a side column and
     a content area). Esc and a click on the dim area close it unless `dismissible` is false. Focus moves in and
     back when it closes. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import { DialogMover } from "../logic/dialogMover.svelte";
  import { presetVar, type DialogWidth } from "../logic/presets";
  import DialogHead from "./DialogHead.svelte";

  interface Props {
    open?: boolean;
    title: string;
    variant?: "message" | "form" | "split" | "panel";
    subtitle?: string;
    icon?: IconName | null;
    iconTone?: "accent" | "success" | "warning" | "danger";
    width?: DialogWidth;
    dismissible?: boolean;
    /** Drag the title to move it; double-click the title to center it again. */
    movable?: boolean;
    onclose?: () => void;
    onsubmit?: () => void;
    actions?: Snippet;
    footnote?: Snippet;
    toolbar?: Snippet;
    sidebar?: Snippet;
    children: Snippet;
  }

  let {
    open = $bindable(false),
    title,
    variant = "message",
    subtitle = "",
    icon = null,
    iconTone = "accent",
    width = variant === "form" ? "normal" : variant === "panel" ? "large" : "small",
    dismissible = true,
    movable = false,
    onclose,
    onsubmit,
    actions,
    footnote,
    toolbar,
    sidebar,
    children,
  }: Props = $props();

  const titleId = $props.id();
  let dialogEl = $state<HTMLDivElement | null>(null);
  let returnFocus: HTMLElement | null = null;

  const mover = new DialogMover();
  function close(): void {
    open = false;
    onclose?.();
  }

  $effect(() => {
    if (!open || !dialogEl) {
      return;
    }
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = dialogEl.querySelector<HTMLElement>(
      "[autofocus], input:not([type=checkbox]):not([type=radio]), textarea, select, button:not(:disabled)",
    );
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
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && onsubmit) {
      event.preventDefault();
      onsubmit();
    }
  }
</script>

{#snippet heading()}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <h2
    id={titleId}
    class:handle={movable}
    title={movable ? "Drag to move, double-click to center" : undefined}
    onpointerdown={(event) => movable && dialogEl && mover.start(event, dialogEl)}
    onpointermove={(event) => mover.move(event)}
    onpointerup={() => mover.end()}
    onpointercancel={() => mover.end()}
    ondblclick={() => movable && mover.center()}>{title}</h2
  >
{/snippet}

{#if open}
  <div
    class="overlay is-{variant}"
    role="presentation"
    onmousedown={(event) => dismissible && event.target === event.currentTarget && close()}
  >
    <div
      bind:this={dialogEl}
      class="dialog is-{variant}"
      class:moving={mover.moving !== null}
      style:transform={mover.transform}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      style:--dialog-chosen-width={variant === "split" ? null : presetVar("dialogWidth", width)}
      {onkeydown}
    >
      {#if variant === "split"}
        <div class="nav">
          {@render heading()}
          {@render sidebar?.()}
        </div>
        <div class="content">{@render children()}</div>
      {:else}
        {#if icon || subtitle || variant === "panel"}
          <DialogHead
            {title}
            {titleId}
            {subtitle}
            {icon}
            {iconTone}
            size={variant === "panel" ? "panel" : "normal"}
            onclose={variant === "panel" && dismissible ? close : undefined}
          />
        {:else}
          {@render heading()}
        {/if}
        {@render toolbar?.()}
        <div class="body">{@render children()}</div>
        {#if actions || footnote}
          <div class="actions">
            {#if footnote}<span class="footnote">{@render footnote()}</span>{/if}
            {@render actions?.()}
          </div>
        {/if}
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

  .overlay.is-form {
    z-index: 850;
    padding-top: 10vh;
  }

  .overlay.is-split {
    z-index: 850;
    padding-top: 8vh;
  }

  .dialog {
    width: min(var(--dialog-chosen-width), calc(100vw - 2 * var(--space-8)));
    padding: var(--dialog-padding-top) var(--dialog-padding-x) var(--dialog-padding-bottom);
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: var(--dialog-radius);
    box-shadow: var(--shadow);
    outline: none;
  }

  .dialog.is-form {
    display: flex;
    flex-direction: column;
    max-height: 80vh;
    padding: var(--form-dialog-padding-top) var(--form-dialog-padding-x) var(--form-dialog-padding-bottom);
  }

  .dialog.is-split {
    display: flex;
    width: min(var(--split-dialog-width), calc(100vw - 2 * var(--space-8)));
    height: min(var(--split-dialog-height), 84vh);
    padding: 0;
    overflow: hidden;
    border-radius: var(--split-dialog-radius);
  }

  .handle {
    cursor: grab;
    user-select: none;
  }

  .moving,
  .moving .handle {
    cursor: grabbing;
  }

  .moving {
    box-shadow: var(--shadow-lifted);
  }

  h2 {
    margin: 0 0 var(--dialog-title-gap);
    font-size: var(--text-title-size);
    font-weight: var(--text-title-weight);
  }

  .is-form .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--form-dialog-body-gap);
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--dialog-actions-gap);
    margin-top: var(--dialog-actions-top);
  }

  .is-form .actions {
    margin-top: var(--form-dialog-actions-top);
  }

  .nav {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: var(--split-dialog-nav-width);
    padding: var(--split-dialog-nav-padding-top) var(--split-dialog-nav-padding-x)
      var(--split-dialog-nav-padding-bottom);
    background: var(--panel-alt);
    border-right: 1px solid var(--border-strong);
  }

  .nav h2 {
    margin: 0 var(--space-4) var(--space-6);
    font-size: var(--text-heading-size);
  }

  .content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .footnote {
    flex: 1;
    min-width: 0;
  }

  /* Panel: a large dialog with a scrolling body between its head (and toolbar) and a footer with a line above. */
  .overlay.is-panel {
    z-index: 855;
    padding-top: 8vh;
  }

  .dialog.is-panel {
    display: flex;
    flex-direction: column;
    max-height: 84vh;
    padding: 0;
    border-radius: var(--panel-dialog-radius);
  }

  .is-panel .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--panel-dialog-body-padding-top) var(--panel-dialog-body-padding-x)
      var(--panel-dialog-body-padding-bottom);
  }

  .is-panel .actions {
    gap: var(--panel-dialog-foot-gap);
    margin: 0;
    padding: var(--panel-dialog-foot-padding-top) var(--panel-dialog-body-padding-x)
      var(--panel-dialog-foot-padding-bottom);
    border-top: 1px solid var(--border-strong);
  }
</style>
