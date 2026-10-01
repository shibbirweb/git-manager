// Custom context menu, opened with `contextMenu.open(event, items)`.

export type MenuItem =
  | {
      label: string;
      action: () => void;
      disabled?: boolean;
      danger?: boolean;
      hint?: string;
    }
  | { separator: true };

class ContextMenuStore {
  items = $state<MenuItem[]>([]);
  x = $state(0);
  y = $state(0);
  visible = $state(false);

  open(event: MouseEvent, items: MenuItem[]): void {
    event.preventDefault();
    event.stopPropagation();
    this.items = items;
    this.x = event.clientX;
    this.y = event.clientY;
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }
}

export const contextMenu = new ContextMenuStore();
