// Toast kinds and how long each stays, the same as the app's (src/lib/ui/toast.svelte.ts): errors longest, so there
// is time to read them; a toast with a button a little longer than a plain success.

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
