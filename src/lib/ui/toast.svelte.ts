import { notifications } from "$lib/notifications/notifications.svelte";

export type ToastKind = "info" | "success" | "warning" | "error";

/** A button in the toast, e.g. Undo; clicking it runs `run` and closes the toast. */
export interface ToastAction {
  label: string;
  run: () => void;
  /**
   * False once the button cannot work any more (what it acts on changed). The notification list
   * offers a button with this check for 30 minutes, one without it for 2.
   */
  valid?: () => boolean;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  action?: ToastAction;
  /** The same message in the notification history (the status bar bell). */
  notificationId: number;
}

class ToastStore {
  items = $state<Toast[]>([]);
  private nextId = 1;

  show(kind: ToastKind, title: string, detail?: string, timeoutMs?: number, action?: ToastAction): void {
    const trimmed = detail?.trim() || undefined;
    // Every message goes to the history; Do Not Disturb only keeps non-errors off screen.
    const notificationId = notifications.record(kind, title, trimmed ?? null, action ?? null);
    if (!notifications.popsUp(kind)) {
      return;
    }
    const id = this.nextId++;
    this.items.push({ id, kind, title, detail: trimmed, action, notificationId });
    const timeout = timeoutMs ?? (kind === "error" ? 9000 : kind === "warning" ? 6000 : 3500);
    setTimeout(() => this.dismiss(id), timeout);
  }

  info(title: string, detail?: string): void {
    this.show("info", title, detail);
  }

  success(title: string, detail?: string): void {
    this.show("success", title, detail);
  }

  warning(title: string, detail?: string): void {
    this.show("warning", title, detail);
  }

  error(title: string, detail?: string): void {
    this.show("error", title, detail);
  }

  /** A success toast with a button, shown a little longer so there is time to click it. */
  successWithAction(title: string, detail: string | undefined, action: ToastAction): void {
    this.show("success", title, detail, 8000, action);
  }

  /** Runs a toast's button, then closes the toast. */
  runAction(id: number): void {
    const item = this.items.find((entry) => entry.id === id) ?? null;
    this.dismiss(id);
    if (item?.action) {
      notifications.runAction(item.notificationId);
    }
  }

  /** Runs a button from the notification list, closing its toast if it is still up. */
  runNotificationAction(notificationId: number): void {
    this.items = this.items.filter((toast) => toast.notificationId !== notificationId);
    notifications.runAction(notificationId);
  }

  dismiss(id: number): void {
    this.items = this.items.filter((toast) => toast.id !== id);
  }
}

export const toast = new ToastStore();
