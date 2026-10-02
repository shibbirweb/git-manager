// Decides which window-wide shortcut a key press means, kept pure so it can be tested
// without a DOM.

export type WorkspaceShortcut =
  | "goBack"
  | "goForward"
  | "toggleExplorer"
  | "toggleSidebar"
  | "showChanges"
  | "showBranches"
  | "toggleLog"
  | "toggleTerminal"
  | "newTerminal"
  | "goToFile"
  | "goToClass"
  | "goToSymbol"
  | "findInFiles"
  | "replaceInFiles"
  | "nextTab"
  | "previousTab"
  | "toggleWordWrap";

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
  // Ctrl+` / Ctrl+Shift+`: toggle the terminal panel / new terminal (VS Code). Matched by the
  // physical key since layouts type other characters there; Cmd+` switches windows on macOS.
  if (event.ctrlKey && !event.metaKey && !event.altKey && event.code === "Backquote") {
    return event.shiftKey ? "newTerminal" : "toggleTerminal";
  }
  // Ctrl+- / Ctrl+Shift+-: Go Back / Go Forward (VS Code on macOS).
  if (event.ctrlKey && !event.metaKey && !event.altKey && event.code === "Minus") {
    return event.shiftKey ? "goForward" : "goBack";
  }
  // Option+Z: toggle word wrap (VS Code), by the physical key since Option+Z types a character.
  if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.code === "KeyZ") {
    return "toggleWordWrap";
  }
  if (!(event.metaKey || event.ctrlKey)) {
    return null;
  }
  // Option changes the typed character on macOS, so match the physical key.
  if (event.code === "KeyB" && event.altKey && !event.shiftKey) {
    // Option+Cmd+B: VS Code's secondary sidebar toggle.
    return "toggleExplorer";
  }
  if (event.code === "KeyO" && event.altKey && !event.shiftKey) {
    // Option+Cmd+O: JetBrains' Go to Symbol.
    return "goToSymbol";
  }
  if (event.altKey) {
    return null;
  }
  // Shift+Cmd+] / Shift+Cmd+[: next and previous editor tab (macOS), by the physical key.
  if (event.shiftKey && (event.code === "BracketRight" || event.code === "BracketLeft")) {
    return event.code === "BracketRight" ? "nextTab" : "previousTab";
  }
  const key = event.key.toLowerCase();
  if (key === "b" && !event.shiftKey) {
    return "toggleSidebar";
  }
  // Cmd+P (VS Code) and Shift+Cmd+O (JetBrains) open Go to File, Cmd+O Go to Class,
  // Shift+Cmd+F Find in Files and Shift+Cmd+R Replace in Files (JetBrains); double Shift
  // (Search Everywhere) is handled apart. Cmd+F and Cmd+R belong to the editor.
  if (key === "p" && !event.shiftKey) {
    return "goToFile";
  }
  if (key === "o" && !event.shiftKey) {
    return "goToClass";
  }
  if (!event.shiftKey) {
    return null;
  }
  if (key === "o") {
    return "goToFile";
  }
  if (key === "f") {
    return "findInFiles";
  }
  if (key === "r") {
    return "replaceInFiles";
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
