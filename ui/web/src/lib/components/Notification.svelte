<!-- One notification, drawn: the kind's icon in a circle, a bold title, where it came
     from, the detail (kept selectable) and an action link. The balloon floats as a toast with a shadow and holds
     itself open while the pointer is over it; the row sits in the notification list with its time after the source
     and an unread dot.
     The close button shows on hover and keyboard focus. -->
<script lang="ts">
  import { kindIcon, kindLabel, kindTone, type ToastKind } from "../logic/toastModel";
  import Icon from "./Icon.svelte";
  import IconButton from "./IconButton.svelte";
  import Link from "./Link.svelte";
  import Time from "./Time.svelte";

  interface Props {
    kind: ToastKind;
    title: string;
    detail?: string | null;
    source?: string | null;
    time?: number | null;
    actionLabel?: string | null;
    variant?: "balloon" | "row";
    unread?: boolean;
    onaction?: () => void;
    ondismiss?: () => void;
    onhold?: (held: boolean) => void;
  }

  let {
    kind,
    title,
    detail = null,
    source = null,
    time = null,
    actionLabel = null,
    variant = "balloon",
    unread = false,
    onaction,
    ondismiss,
    onhold,
  }: Props = $props();

  const showTime = $derived(variant === "row" && time !== null);
  const role = $derived(variant === "row" ? "group" : kind === "error" ? "alert" : "status");
</script>

<div
  class="notification {variant}"
  {role}
  aria-label="{kindLabel(kind)}: {title}"
  onpointerenter={() => onhold?.(true)}
  onpointerleave={() => onhold?.(false)}
  onfocusin={() => onhold?.(true)}
  onfocusout={() => onhold?.(false)}
>
  <span class="kind" title={kindLabel(kind)}>
    <Icon name={kindIcon(kind)} size="large" tone={kindTone(kind)} />
  </span>
  <div class="body">
    <div class="head">
      <span class="title">{title}</span>
      {#if unread}
        <span class="dot" aria-label="Unread"></span>
      {/if}
    </div>
    {#if source || showTime}
      <div class="source">
        {#if source}
          <span>{source}</span>
        {/if}
        {#if showTime}
          <span class="time"><Time time={time ?? 0} /></span>
        {/if}
      </div>
    {/if}
    {#if detail}
      <pre class="detail">{detail}</pre>
    {/if}
    {#if actionLabel}
      <div class="actions">
        <Link onclick={() => onaction?.()}>{actionLabel}</Link>
      </div>
    {/if}
  </div>
  {#if ondismiss}
    <span class="close">
      <IconButton icon="x" label="Close" size="micro" iconSize="compact" tone="dim" onclick={() => ondismiss()} />
    </span>
  {/if}
</div>

<style>
  .notification {
    display: flex;
    align-items: flex-start;
    gap: var(--notification-gap);
    min-width: 0;
    color: var(--text);
  }

  .balloon {
    width: var(--notification-width);
    max-width: 100%;
    padding: var(--notification-padding-y) var(--notification-padding-right) var(--notification-padding-y)
      var(--notification-padding-left);
    border: 1px solid var(--border-strong);
    border-radius: var(--notification-radius);
    background: var(--panel);
    box-shadow: var(--shadow);
  }

  .row {
    padding: var(--notification-row-padding-y) var(--notification-row-padding-right) var(--notification-row-padding-y)
      var(--notification-row-padding-left);
  }

  .row:hover {
    background: var(--hover);
  }

  .kind {
    flex: none;
    display: inline-flex;
  }

  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--notification-line-gap);
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: var(--space-4);
    min-width: 0;
  }

  .title {
    flex: 1;
    min-width: 0;
    font-weight: var(--font-weight-semibold);
    overflow-wrap: anywhere;
    user-select: text;
    -webkit-user-select: text;
  }

  .dot {
    flex: none;
    align-self: center;
    width: var(--notification-dot);
    height: var(--notification-dot);
    border-radius: var(--radius-round);
    background: var(--accent);
  }

  .source {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    color: var(--text-dim);
    font-size: var(--font-size-small);
    overflow-wrap: anywhere;
  }

  .time {
    white-space: nowrap;
  }

  .detail {
    margin: 0;
    max-height: var(--notification-detail-max-height);
    overflow: auto;
    font: inherit;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    user-select: text;
    -webkit-user-select: text;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
    padding-top: var(--space-1);
  }

  .close {
    flex: none;
    opacity: 0;
    transition: opacity var(--motion-fast) ease;
  }

  .notification:hover .close,
  .notification:focus-within .close {
    opacity: 1;
  }
</style>
