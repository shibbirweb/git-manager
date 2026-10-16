// The notification history behind the Notifications panel (NotificationsPanel.svelte, opened from the bell in the
// right activity bar or the status bar). The toast store records every message here; nothing is saved, so the list
// starts empty each launch.

import {
  actionAvailable,
  addNotification,
  dropStaleActions,
  markActionUsed,
  markAllRead,
  removeNotification,
  type NotificationAction,
  type NotificationEntry,
  type NotificationKind,
  shouldPopUp,
  unreadAlerts,
} from "./notificationModel";

class NotificationStore {
  items = $state.raw<NotificationEntry[]>([]);
  /** The Notifications panel is shown (editorSettingsSync keeps it in step with the right sidebar). */
  open = $state(false);
  /** Mirrors the Do Not Disturb setting (App.svelte keeps it in step). */
  doNotDisturb = $state(false);
  unread = $derived(unreadAlerts(this.items));
  /** Unread when the panel opened, or arrived while it is shown: the panel marks these with a dot. */
  fresh = $state.raw<ReadonlySet<number>>(new Set());
  private nextId = 1;

  /** Records a message; returns its id. */
  record(
    kind: NotificationKind,
    title: string,
    detail: string | null,
    action: NotificationAction | null,
    source: string | null = null,
  ): number {
    const id = this.nextId++;
    const now = Date.now();
    const entry: NotificationEntry = {
      id,
      kind,
      title,
      detail,
      source,
      time: now,
      // A message that arrives while the list is open is seen at once.
      read: this.open,
      action,
      actionUsed: false,
    };
    this.items = addNotification(dropStaleActions(this.items, now), entry);
    if (this.open) {
      this.fresh = new Set([...this.fresh, id]);
    }
    return id;
  }

  /** Whether a message of `kind` shows as a toast now. */
  popsUp(kind: NotificationKind): boolean {
    return shouldPopUp(kind, this.doNotDisturb, this.open);
  }

  actionAvailable(entry: NotificationEntry): boolean {
    return actionAvailable(entry, Date.now());
  }

  /** Runs an entry's button once; later clicks (or the toast's) do nothing. */
  runAction(notificationId: number): void {
    const entry = this.items.find((item) => item.id === notificationId) ?? null;
    if (!entry || !this.actionAvailable(entry)) {
      return;
    }
    this.items = markActionUsed(this.items, notificationId);
    entry.action?.run();
  }

  markActionUsed(notificationId: number): void {
    this.items = markActionUsed(this.items, notificationId);
  }

  setOpen(open: boolean): void {
    if (open === this.open) {
      return;
    }
    this.open = open;
    if (open) {
      this.fresh = new Set(this.items.filter((entry) => !entry.read).map((entry) => entry.id));
      this.items = markAllRead(this.items);
    } else {
      this.fresh = new Set();
    }
  }

  remove(notificationId: number): void {
    this.items = removeNotification(this.items, notificationId);
  }

  clear(): void {
    this.items = [];
    this.fresh = new Set();
  }
}

export const notifications = new NotificationStore();
