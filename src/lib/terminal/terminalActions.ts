// What a terminal does with the clipboard, its own keys and its right-click menu. TerminalView wires them to its
// xterm instance; the app's own shortcuts are left to the window.
import type { Terminal } from "@xterm/xterm";
import { localKeys, terminalAppKeySet } from "$lib/commands/commandRuntime";
import { errorMessage } from "$lib/api";
import { settings } from "$lib/stores/settings.svelte";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { terminalKeyAction } from "./keys";

export async function copySelection(instance: Terminal): Promise<void> {
  const text = instance.getSelection();
  if (!text) {
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    toast.error("Could not copy", errorMessage(error));
  }
}

export async function pasteClipboard(instance: Terminal): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      instance.paste(text);
    }
  } catch (error) {
    toast.error("Could not paste", errorMessage(error));
  }
}

/**
 * Copy on selection: keyboard and double-click selections copy at once, a drag when the mouse is released (on the
 * window, so it runs after xterm finished the selection, even outside). It runs inside the mouse or key event,
 * which WebKit needs for clipboard access; a failure is shown once, so a blocked clipboard does not toast on every
 * selection.
 */
export class CopyOnSelect {
  private selecting = false;
  private failed = false;

  constructor(private readonly instance: Terminal) {}

  /** Watches the mouse on `host`; returns the cleanup. */
  attach(host: HTMLElement): () => void {
    const down = (event: MouseEvent) => {
      if (event.button === 0) {
        this.selecting = true;
      }
    };
    const up = () => {
      if (this.selecting) {
        this.selecting = false;
        this.copy();
      }
    };
    host.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    return () => {
      host.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
    };
  }

  /** The selection changed: copy now unless a drag is still selecting. */
  selectionChanged(): void {
    if (!this.selecting) {
      this.copy();
    }
  }

  private copy(): void {
    if (!settings.terminalCopyOnSelect || !this.instance.hasSelection()) {
      return;
    }
    const text = this.instance.getSelection();
    if (!text) {
      return;
    }
    navigator.clipboard.writeText(text).catch((error) => {
      if (!this.failed) {
        this.failed = true;
        toast.error("Could not copy the selection", errorMessage(error));
      }
    });
  }
}

export interface TerminalKeyContext {
  isMac: boolean;
  canSplit: boolean;
  find: () => void;
  split: () => void;
}

/**
 * xterm's key handler: true lets the shell have the key. Keys for the app (Ctrl+`, Cmd shortcuts) return false so
 * xterm leaves them alone and they bubble to the window shortcuts unhandled.
 */
export function handleTerminalKey(instance: Terminal, event: KeyboardEvent, context: TerminalKeyContext): boolean {
  const action = terminalKeyAction(event, {
    isMac: context.isMac,
    hasSelection: instance.hasSelection(),
    findEnabled: settings.terminalFind,
    canSplit: context.canSplit,
    appKeys: terminalAppKeySet(),
  });
  if (action === "shell") {
    return true;
  }
  if (event.type !== "keydown" || action === "app") {
    return false;
  }
  event.preventDefault();
  if (action === "copy") {
    void copySelection(instance);
  } else if (action === "paste") {
    void pasteClipboard(instance);
  } else if (action === "clear") {
    instance.clear();
  } else if (action === "selectAll") {
    instance.selectAll();
  } else if (action === "find") {
    context.find();
  } else if (action === "split") {
    context.split();
  }
  return false;
}

/** The terminal's right-click menu: Copy, Paste, Select All, Clear, Find, then the store's own items. */
export function terminalMenu(
  instance: Terminal,
  context: { isMac: boolean; exited: boolean; find: () => void; more: MenuItem[] },
): MenuItem[] {
  const mac = context.isMac;
  // Keys this view binds itself, in words for this platform.
  const keys = (accelerator: string | null) => (accelerator ? localKeys(accelerator) : undefined);
  const items: MenuItem[] = [
    {
      label: "Copy",
      hint: keys(mac ? "Cmd+C" : "Ctrl+Shift+C"),
      disabled: !instance.hasSelection(),
      action: () => void copySelection(instance),
    },
    {
      label: "Paste",
      hint: keys(mac ? "Cmd+V" : "Ctrl+Shift+V"),
      disabled: context.exited,
      action: () => void pasteClipboard(instance),
    },
    { label: "Select All", hint: keys(mac ? "Cmd+A" : null), action: () => instance.selectAll() },
    { label: "Clear", hint: keys(mac ? "Cmd+K" : null), action: () => instance.clear() },
  ];
  if (settings.terminalFind) {
    items.push(
      { separator: true },
      { label: "Find...", hint: keys(mac ? "Cmd+F" : "Ctrl+Shift+F"), action: context.find },
    );
  }
  items.push({ separator: true }, ...context.more);
  return items;
}
