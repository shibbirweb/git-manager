// A toast queue for screens that use the library on their own (the showcase). The app keeps its own store, which
// also records each message in the notification history, and renders it with ToastHost the same way.
import { toastTimeout, type ToastAction, type ToastItem, type ToastKind } from "./logic/toastModel";

/** After the pointer leaves a toast it was holding open. */
const AFTER_HOLD_MS = 2500;

export function createToasts() {
  let nextId = 1;
  const state = $state<{ items: ToastItem[] }>({ items: [] });
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  function dismiss(id: number): void {
    clearTimeout(timers.get(id));
    timers.delete(id);
    state.items = state.items.filter((item) => item.id !== id);
  }

  function closeAfter(id: number, timeoutMs: number): void {
    clearTimeout(timers.get(id));
    timers.set(
      id,
      setTimeout(() => dismiss(id), timeoutMs),
    );
  }

  function show(kind: ToastKind, title: string, detail?: string, action?: ToastAction, source?: string): void {
    const id = nextId++;
    state.items.push({ id, kind, title, detail: detail?.trim() || undefined, action, source });
    closeAfter(id, toastTimeout(kind, action !== undefined));
  }

  return {
    get items(): ToastItem[] {
      return state.items;
    },
    show,
    dismiss,
    hold(id: number, held: boolean): void {
      if (held) {
        clearTimeout(timers.get(id));
        timers.delete(id);
      } else if (state.items.some((item) => item.id === id)) {
        closeAfter(id, AFTER_HOLD_MS);
      }
    },
    runAction(id: number): void {
      const item = state.items.find((entry) => entry.id === id);
      dismiss(id);
      item?.action?.run();
    },
  };
}
