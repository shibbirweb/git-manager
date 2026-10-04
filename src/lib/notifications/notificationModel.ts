// Notification history: every toast is also kept here (newest first, at most 200, gone on
// restart), so a message that vanished, or one Do Not Disturb kept off screen, can be read
// later. Pure list operations; notifications.svelte.ts holds the list.

export type NotificationKind = "info" | "success" | "warning" | "error";

/** A toast's button (Undo, Show...), kept with the message while it is still useful. */
export interface NotificationAction {
  label: string;
  run: () => void;
  /**
   * False once the action cannot work any more (what it acts on changed); checked when the list
   * shows it. Actions with it stay in the list for 30 minutes, others for 2.
   */
  valid?: () => boolean;
}

export interface NotificationEntry {
  id: number;
  kind: NotificationKind;
  title: string;
  detail: string | null;
  /** Milliseconds since the epoch. */
  time: number;
  /** Seen in the list; only unread errors and warnings count on the bell. */
  read: boolean;
  action: NotificationAction | null;
  /** The action ran once (from the toast or the list): it is not offered again. */
  actionUsed: boolean;
}

export const MAX_NOTIFICATIONS = 200;
/**
 * How long the list offers a button. Buttons were made for a toast seen right away, so without
 * a `valid` check one lasts about as long as a toast plus a little; with one (the producer checks
 * that what it acts on is unchanged) it lasts longer.
 */
export const ACTION_LIFETIME_MS = 2 * 60 * 1000;
export const CHECKED_ACTION_LIFETIME_MS = 30 * 60 * 1000;

function actionLifetime(action: NotificationAction): number {
  return action.valid ? CHECKED_ACTION_LIFETIME_MS : ACTION_LIFETIME_MS;
}

/** Adds `entry` at the top, dropping the oldest past the cap. */
export function addNotification(list: readonly NotificationEntry[], entry: NotificationEntry): NotificationEntry[] {
  return [entry, ...list].slice(0, MAX_NOTIFICATIONS);
}

/** Lets go of buttons past their lifetime, so the list does not hold what they captured (an Undo's patch). */
export function dropStaleActions(list: readonly NotificationEntry[], nowMs: number): NotificationEntry[] {
  const stale = (entry: NotificationEntry) => entry.action !== null && nowMs - entry.time > actionLifetime(entry.action);
  if (!list.some(stale)) {
    return list as NotificationEntry[];
  }
  return list.map((entry) => (stale(entry) ? { ...entry, action: null } : entry));
}

export function markAllRead(list: readonly NotificationEntry[]): NotificationEntry[] {
  if (list.every((entry) => entry.read)) {
    return list as NotificationEntry[];
  }
  return list.map((entry) => (entry.read ? entry : { ...entry, read: true }));
}

/** A used button is never offered again, so its closure is let go too. */
export function markActionUsed(list: readonly NotificationEntry[], notificationId: number): NotificationEntry[] {
  return list.map((entry) => (entry.id === notificationId && !entry.actionUsed ? { ...entry, actionUsed: true, action: null } : entry));
}

/** Unread errors and warnings: the bell's count. */
export function unreadAlerts(list: readonly NotificationEntry[]): number {
  return list.filter((entry) => !entry.read && (entry.kind === "error" || entry.kind === "warning")).length;
}

/** Whether the list still offers the entry's button. */
export function actionAvailable(entry: NotificationEntry, nowMs: number): boolean {
  if (!entry.action || entry.actionUsed || nowMs - entry.time > actionLifetime(entry.action)) {
    return false;
  }
  try {
    return entry.action.valid?.() ?? true;
  } catch {
    return false;
  }
}

/** Do Not Disturb keeps everything but errors off screen; they are still recorded. */
export function shouldPopUp(kind: NotificationKind, doNotDisturb: boolean): boolean {
  return !doNotDisturb || kind === "error";
}

/** The bell's badge: the count, capped so it stays narrow. */
export function badgeText(count: number): string {
  if (count <= 0) {
    return "";
  }
  return count > 99 ? "99+" : String(count);
}

export function kindLabel(kind: NotificationKind): string {
  switch (kind) {
    case "error":
      return "Error";
    case "warning":
      return "Warning";
    case "success":
      return "Done";
    default:
      return "Info";
  }
}

/** The bell's tooltip. */
export function bellTitle(unread: number, total: number, doNotDisturb: boolean): string {
  let summary = "No notifications";
  if (unread > 0) {
    summary = `${unread} unread ${unread === 1 ? "problem" : "problems"}`;
  } else if (total > 0) {
    summary = `${total} ${total === 1 ? "notification" : "notifications"}`;
  }
  const parts = [summary];
  if (doNotDisturb) {
    parts.push("Do Not Disturb is on");
  }
  return parts.join(". ");
}
