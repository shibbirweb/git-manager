// The notification history behind the status bar bell (NotificationBell.svelte). The toast
// store records every message here; nothing is saved, so the list starts empty each launch.

import {
  actionAvailable,
  addNotification,
  dropStaleActions,
  markActionUsed,
  markAllRead,
  type NotificationAction,
  type NotificationEntry,
  type NotificationKind,
  shouldPopUp,
  unreadAlerts,
} from "./notificationModel";

class NotificationStore {
  items = $state.raw<NotificationEntry[]>([]);
  /** The bell's popup is open. */
  open = $state(false);
  /** Mirrors the Do Not Disturb setting (App.svelte keeps it in step). */
  doNotDisturb = $state(false);
  unread = $derived(unreadAlerts(this.items));
  private nextId = 1;

  /** Records a message; returns its id. */
  record(kind: NotificationKind, title: string, detail: string | null, action: NotificationAction | null): number {
    const id = this.nextId++;
    const now = Date.now();
    const entry: NotificationEntry = {
      id,
      kind,
      title,
      detail,
      time: now,
      // A message that arrives while the list is open is seen at once.
      read: this.open,
      action,
      actionUsed: false,
    };
    this.items = addNotification(dropStaleActions(this.items, now), entry);
    return id;
  }

  /** Whether a message of `kind` shows as a toast now. */
  popsUp(kind: NotificationKind): boolean {
    return shouldPopUp(kind, this.doNotDisturb);
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

  toggle(): void {
    this.setOpen(!this.open);
  }

  setOpen(open: boolean): void {
    this.open = open;
    if (open) {
      this.items = markAllRead(this.items);
    }
  }

  clear(): void {
    this.items = [];
  }
}

export const notifications = new NotificationStore();
