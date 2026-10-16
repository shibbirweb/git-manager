// Toast kinds and how long each stays, the same as the app's (src/lib/ui/toast.svelte.ts): errors longest, so there
// is time to read them; a toast with a button a little longer than a plain success. Each kind's icon, color and name
// are shared by the balloons and the notification list (Notification.svelte).
import type { IconName } from "../icons";

export type ToastKind = "info" | "success" | "warning" | "error";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  action?: ToastAction;
  /** Where it came from, such as the repository a push ran in. */
  source?: string;
}

export function toastTimeout(kind: ToastKind, hasAction = false): number {
  if (kind === "error") {
    return 9000;
  }
  if (kind === "warning") {
    return 6000;
  }
  return hasAction ? 8000 : 3500;
}

/** The icon in the kind's circle, like the IDE balloons: i, a check, or a mark for a problem. */
export function kindIcon(kind: ToastKind): IconName {
  if (kind === "error") {
    return "circle-alert";
  }
  if (kind === "warning") {
    return "alert";
  }
  return kind === "success" ? "circle-check" : "info";
}

export function kindTone(kind: ToastKind): "accent" | "success" | "warning" | "danger" {
  if (kind === "error") {
    return "danger";
  }
  return kind === "info" ? "accent" : kind;
}

/** The kind's name, read with the message. */
export function kindLabel(kind: ToastKind): string {
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
