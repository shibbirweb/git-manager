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

export interface ToastOptions {
  /** How long it stays; the kind decides when omitted. */
  timeoutMs?: number;
  action?: ToastAction;
  /** Where it came from, such as the repository, when the workspace has several. */
  source?: string | null;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  action?: ToastAction;
  source?: string;
  /** The same message in the notification history (the Notifications panel). */
  notificationId: number;
}

/** Balloons on screen at once; older ones close early but stay in the list. */
export const MAX_TOASTS = 4;
/** After the pointer leaves a toast it was holding open. */
const AFTER_HOLD_MS = 2500;

class ToastStore {
  items = $state<Toast[]>([]);
  private nextId = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  show(kind: ToastKind, title: string, detail?: string, options: ToastOptions = {}): void {
    const trimmed = detail?.trim() || undefined;
    const source = options.source || undefined;
    const action = options.action;
    // Every message goes to the history; Do Not Disturb only keeps non-errors off screen.
    const notificationId = notifications.record(kind, title, trimmed ?? null, action ?? null, source ?? null);
    if (!notifications.popsUp(kind)) {
      return;
    }
    const id = this.nextId++;
    this.items.push({ id, kind, title, detail: trimmed, action, source, notificationId });
    for (const old of this.items.slice(0, Math.max(0, this.items.length - MAX_TOASTS))) {
      this.dismiss(old.id);
    }
    this.closeAfter(id, options.timeoutMs ?? (kind === "error" ? 9000 : kind === "warning" ? 6000 : 3500));
  }

  info(title: string, detail?: string, source?: string | null): void {
    this.show("info", title, detail, { source });
  }

  success(title: string, detail?: string, source?: string | null): void {
    this.show("success", title, detail, { source });
  }

  warning(title: string, detail?: string, source?: string | null): void {
    this.show("warning", title, detail, { source });
  }

  error(title: string, detail?: string, source?: string | null): void {
    this.show("error", title, detail, { source });
  }

  /** A success toast with a button, shown a little longer so there is time to click it. */
  successWithAction(title: string, detail: string | undefined, action: ToastAction, source?: string | null): void {
    this.show("success", title, detail, { timeoutMs: 8000, action, source });
  }

  /** The pointer is over a toast: it stays until the pointer leaves, then closes a little later. */
  hold(id: number, held: boolean): void {
    if (held) {
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
    } else if (this.items.some((item) => item.id === id)) {
      this.closeAfter(id, AFTER_HOLD_MS);
    }
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
    for (const item of this.items.filter((toast) => toast.notificationId === notificationId)) {
      this.dismiss(item.id);
    }
    notifications.runAction(notificationId);
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.items = this.items.filter((toast) => toast.id !== id);
  }

  private closeAfter(id: number, timeoutMs: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), timeoutMs),
    );
  }
}

export const toast = new ToastStore();
