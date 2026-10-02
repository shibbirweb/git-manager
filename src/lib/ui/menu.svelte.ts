// Custom context menu, opened with `contextMenu.open(event, items)` at the pointer
// or `contextMenu.openBelow(button, items)` under a button. Items may nest submenus.

export interface MenuCommand {
  label: string;
  action: () => void;
  disabled?: boolean;
  danger?: boolean;
  hint?: string;
}

export interface MenuSubmenu {
  label: string;
  submenu: MenuItem[];
  disabled?: boolean;
}

export interface MenuSeparator {
  separator: true;
}

export type MenuItem = MenuCommand | MenuSubmenu | MenuSeparator;

interface OpenOptions {
  /** Opened with the keyboard: highlight the first item so arrows and Enter work at once. */
  keyboard?: boolean;
  /** Align the menu's right edge with `x` instead of its left edge. */
  alignEnd?: boolean;
}

class ContextMenuStore {
  items = $state.raw<MenuItem[]>([]);
  x = $state(0);
  y = $state(0);
  alignEnd = $state(false);
  keyboard = $state(false);
  visible = $state(false);
  /** Bumped on every open so the host resets its highlight and submenus. */
  version = $state(0);
  /** Focus goes back here when the menu closes. */
  private returnFocus: HTMLElement | null = null;

  open(event: MouseEvent, items: MenuItem[], options: OpenOptions = {}): void {
    event.preventDefault();
    event.stopPropagation();
    this.show(items, event.clientX, event.clientY, options);
  }

  /** Opens under `anchor`, e.g. a "..." button; `event.detail === 0` marks a keyboard click. */
  openBelow(anchor: HTMLElement, items: MenuItem[], options: OpenOptions = {}): void {
    const rect = anchor.getBoundingClientRect();
    this.show(items, options.alignEnd ? rect.right : rect.left, rect.bottom + 2, options);
  }

  private show(items: MenuItem[], x: number, y: number, options: OpenOptions): void {
    const focused = document.activeElement;
    this.returnFocus = focused instanceof HTMLElement && focused !== document.body ? focused : null;
    this.items = items;
    this.x = x;
    this.y = y;
    this.alignEnd = options.alignEnd ?? false;
    this.keyboard = options.keyboard ?? false;
    this.visible = true;
    this.version++;
  }

  /** `restoreFocus` puts the caret back where it was (Escape, or before running an item). */
  close(restoreFocus = false): void {
    if (!this.visible) {
      return;
    }
    this.visible = false;
    const target = this.returnFocus;
    this.returnFocus = null;
    if (restoreFocus && target?.isConnected) {
      target.focus();
    }
  }
}

export const contextMenu = new ContextMenuStore();
