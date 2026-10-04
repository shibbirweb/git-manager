<!-- The status bar bell: unread errors and warnings on the badge; the popup lists every message
     of this session, newest first, with any button that still works. -->
<script lang="ts">
  import { fullDate, relativeTime } from "$lib/log/format";
  import { settings } from "$lib/stores/settings.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import type { IconName } from "$lib/ui/icons";
  import { toast } from "$lib/ui/toast.svelte";
  import { badgeText, bellTitle, kindLabel, type NotificationKind } from "./notificationModel";
  import { notifications } from "./notifications.svelte";

  let rootEl = $state<HTMLDivElement | null>(null);
  /** The time the relative times are counted from; refreshed while the list is open. */
  let now = $state(Date.now());

  const unread = $derived(notifications.unread);
  const hasUnreadError = $derived(notifications.items.some((entry) => !entry.read && entry.kind === "error"));
  const doNotDisturb = $derived(settings.notificationsDoNotDisturb);

  $effect(() => {
    if (!notifications.open) {
      return;
    }
    now = Date.now();
    const timer = setInterval(() => {
      now = Date.now();
    }, 30_000);
    return () => clearInterval(timer);
  });

  function kindIcon(kind: NotificationKind): IconName {
    if (kind === "error" || kind === "warning") {
      return "alert";
    }
    return kind === "success" ? "check" : "lightbulb";
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || !notifications.open || dialogs.active !== null || event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    notifications.setOpen(false);
  }
</script>

<svelte:window
  onmousedown={(event) => {
    if (notifications.open && rootEl && !rootEl.contains(event.target as Node)) {
      notifications.setOpen(false);
    }
  }}
  onkeydown={onKeydown}
/>

<div class="bell" bind:this={rootEl}>
  <button
    class="item icon-only"
    class:open={notifications.open}
    onclick={() => notifications.toggle()}
    title={bellTitle(unread, notifications.items.length, doNotDisturb)}
    aria-label="Notifications"
  >
    <Icon name={doNotDisturb ? "bell-off" : "bell"} size={12} />
    {#if unread > 0}
      <span class="badge" class:error={hasUnreadError}>{badgeText(unread)}</span>
    {/if}
  </button>
  {#if notifications.open}
    <div class="popup" role="dialog" aria-label="Notifications">
      <div class="head">
        <strong>Notifications</strong>
        <label class="dnd" title="Only errors pop up; everything is still listed here">
          <input
            type="checkbox"
            checked={doNotDisturb}
            onchange={(event) => settings.setPreference("notificationsDoNotDisturb", event.currentTarget.checked)}
          />
          <span>Do Not Disturb</span>
        </label>
        <button class="btn small" disabled={notifications.items.length === 0} onclick={() => notifications.clear()}>
          Clear All
        </button>
      </div>
      <div class="list">
        {#each notifications.items as entry (entry.id)}
          <div class="entry {entry.kind}">
            <span class="kind" title={kindLabel(entry.kind)}><Icon name={kindIcon(entry.kind)} size={13} /></span>
            <div class="body">
              <div class="title-row">
                <span class="title selectable">{entry.title}</span>
                <span class="time" title={fullDate(Math.floor(entry.time / 1000))}>
                  {relativeTime(Math.floor(entry.time / 1000), now)}
                </span>
              </div>
              {#if entry.detail}
                <pre class="detail selectable">{entry.detail}</pre>
              {/if}
              {#if entry.action && notifications.actionAvailable(entry)}
                <button class="btn small action" onclick={() => toast.runNotificationAction(entry.id)}>
                  {entry.action.label}
                </button>
              {/if}
            </div>
          </div>
        {:else}
          <div class="empty">No notifications yet</div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .bell {
    position: relative;
  }

  .item {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    height: 20px;
    padding: 0 5px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .item:hover,
  .item.open {
    background: var(--hover);
    color: var(--text);
  }

  .badge {
    min-width: 14px;
    height: 14px;
    padding: 0 4px;
    border-radius: 7px;
    background: var(--warning);
    color: var(--accent-text);
    font-size: 10px;
    font-weight: 600;
    line-height: 14px;
    text-align: center;
  }

  .badge.error {
    background: var(--danger);
  }

  .popup {
    position: absolute;
    right: 0;
    bottom: 26px;
    z-index: 600;
    width: 380px;
    max-height: min(480px, 70vh);
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: var(--shadow);
    color: var(--text);
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }

  .head strong {
    flex: 1;
  }

  .dnd {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-dim);
    cursor: pointer;
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 0;
  }

  .entry {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .entry:last-child {
    border-bottom: none;
  }

  .kind {
    flex: none;
    padding-top: 1px;
    color: var(--accent);
  }

  .entry.success .kind {
    color: var(--success);
  }

  .entry.warning .kind {
    color: var(--warning);
  }

  .entry.error .kind {
    color: var(--danger);
  }

  .body {
    flex: 1;
    min-width: 0;
  }

  .title-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .title {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    font-size: 12.5px;
    overflow-wrap: anywhere;
  }

  .time {
    flex: none;
    font-size: 11px;
    color: var(--text-dim);
  }

  .detail {
    margin: 3px 0 0;
    max-height: 72px;
    overflow: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-dim);
  }

  .action {
    margin-top: 6px;
  }

  .empty {
    padding: 20px 12px;
    text-align: center;
    color: var(--text-dim);
    font-size: 12px;
  }
</style>
