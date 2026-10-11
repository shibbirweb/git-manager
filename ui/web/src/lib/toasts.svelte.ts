// A toast queue for screens that use the library on their own (the showcase). The app keeps its own store, which
// also records each message in the notification history, and renders it with ToastHost the same way.
import { toastTimeout, type ToastAction, type ToastItem, type ToastKind } from "./logic/toastModel";

export function createToasts() {
  let nextId = 1;
  const state = $state<{ items: ToastItem[] }>({ items: [] });

  function dismiss(id: number): void {
    state.items = state.items.filter((item) => item.id !== id);
  }

  function show(kind: ToastKind, title: string, detail?: string, action?: ToastAction): void {
    const id = nextId++;
    state.items.push({ id, kind, title, detail: detail?.trim() || undefined, action });
    setTimeout(() => dismiss(id), toastTimeout(kind, action !== undefined));
  }

  return {
    get items(): ToastItem[] {
      return state.items;
    },
    show,
    dismiss,
    runAction(id: number): void {
      const item = state.items.find((entry) => entry.id === id);
      dismiss(id);
      item?.action?.run();
    },
  };
}
