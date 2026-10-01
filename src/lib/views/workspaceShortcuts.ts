// Decides which window-wide shortcut a key press means, kept pure so it can be tested
// without a DOM.

export type WorkspaceShortcut =
  | "goBack"
  | "goForward"
  | "toggleExplorer"
  | "toggleSidebar"
  | "showChanges"
  | "showBranches"
  | "toggleLog";

/** The parts of a KeyboardEvent the decision needs. */
export interface ShortcutKey {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
}

export interface ShortcutContext {
  dialogOpen: boolean;
  mergeOpen: boolean;
}

/**
 * Returns the shortcut for a key press, or null when the window should leave it alone.
 * A key something else already handled (for example Shift+Cmd+G, find previous, in an
 * editor) is skipped, so one press never runs two actions.
 */
export function workspaceShortcut(event: ShortcutKey, context: ShortcutContext): WorkspaceShortcut | null {
  if (context.dialogOpen || context.mergeOpen || event.defaultPrevented) {
    return null;
  }
  // Ctrl+- / Ctrl+Shift+-: Go Back / Go Forward (VS Code on macOS).
  if (event.ctrlKey && !event.metaKey && !event.altKey && event.code === "Minus") {
    return event.shiftKey ? "goForward" : "goBack";
  }
  if (!(event.metaKey || event.ctrlKey)) {
    return null;
  }
  // Option changes the typed character on macOS, so match the physical key.
  if (event.code === "KeyB" && event.altKey && !event.shiftKey) {
    // Option+Cmd+B: VS Code's secondary sidebar toggle.
    return "toggleExplorer";
  }
  if (event.altKey) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === "b" && !event.shiftKey) {
    return "toggleSidebar";
  }
  if (!event.shiftKey) {
    return null;
  }
  if (key === "g") {
    return "showChanges";
  }
  if (key === "e") {
    return "showBranches";
  }
  if (key === "l") {
    return "toggleLog";
  }
  return null;
}
