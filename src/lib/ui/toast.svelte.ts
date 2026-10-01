export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

class ToastStore {
  items = $state<Toast[]>([]);
  private nextId = 1;

  show(kind: ToastKind, title: string, detail?: string, timeoutMs?: number): void {
    const id = this.nextId++;
    this.items.push({ id, kind, title, detail: detail?.trim() || undefined });
    const timeout = timeoutMs ?? (kind === "error" ? 9000 : 3500);
    setTimeout(() => this.dismiss(id), timeout);
  }

  info(title: string, detail?: string): void {
    this.show("info", title, detail);
  }

  success(title: string, detail?: string): void {
    this.show("success", title, detail);
  }

  error(title: string, detail?: string): void {
    this.show("error", title, detail);
  }

  dismiss(id: number): void {
    this.items = this.items.filter((toast) => toast.id !== id);
  }
}

export const toast = new ToastStore();
