// A terminal moved into the editor area, like VS Code's "Move Terminal into
// Editor Area". It shares the tab strip with file tabs, so its "path" is a
// pseudo path that can never be a file (see stores/commitTabs.ts for the same
// idea): it does not start with "/", so folder and repository lookups never
// match it. Kept free of Svelte so it can be tested directly.

const PREFIX = "terminal:";

/** Where a terminal is shown: the panel below the editor, an editor tab, or the panel's Run tab (a run session). */
export type TerminalLocation = "panel" | "editor" | "run";

export function terminalTabPath(terminalKey: number): string {
  return `${PREFIX}${terminalKey}`;
}

/** The terminal key of a terminal tab path, or null for any other tab. */
export function parseTerminalTabPath(tabPath: string): number | null {
  if (!tabPath.startsWith(PREFIX)) {
    return null;
  }
  const rest = tabPath.slice(PREFIX.length);
  if (!/^[1-9][0-9]{0,15}$/.test(rest)) {
    return null;
  }
  const terminalKey = Number(rest);
  return Number.isSafeInteger(terminalKey) ? terminalKey : null;
}

export function isTerminalTab(tabPath: string): boolean {
  return parseTerminalTabPath(tabPath) !== null;
}

/** Keys of the terminals whose tabs are among `tabPaths`, in order. */
export function terminalKeysOf(tabPaths: string[]): number[] {
  const terminalKeys: number[] = [];
  for (const tabPath of tabPaths) {
    const terminalKey = parseTerminalTabPath(tabPath);
    if (terminalKey !== null) {
      terminalKeys.push(terminalKey);
    }
  }
  return terminalKeys;
}

/** The parts of a terminal entry the panel rules need. */
export interface PlacedTerminal {
  key: number;
  location: TerminalLocation;
  /** Split group in the panel (see splitPanes.ts). */
  group?: number;
}

export interface PanelState {
  /** The terminal the panel shows; always one of its own terminals, or null. */
  activeKey: number | null;
  panelOpen: boolean;
}

/**
 * The panel after `leavingKey` leaves it (moved into the editor, killed or
 * exited): the shown terminal follows the usual close rule among the panel's
 * terminals only, and like VS Code the panel hides with its last terminal.
 * A terminal in the editor never changes the panel.
 */
export function panelAfterLeave(terminals: PlacedTerminal[], leavingKey: number, state: PanelState): PanelState {
  const leaving = terminals.find((terminal) => terminal.key === leavingKey);
  if (!leaving || leaving.location !== "panel") {
    return state;
  }
  const panelKeys = terminals.filter((terminal) => terminal.location === "panel").map((terminal) => terminal.key);
  const remaining = panelKeys.filter((terminalKey) => terminalKey !== leavingKey);
  if (remaining.length === 0) {
    return { activeKey: null, panelOpen: false };
  }
  if (state.activeKey !== leavingKey && state.activeKey !== null && remaining.includes(state.activeKey)) {
    return state;
  }
  // A split terminal hands over to the pane beside it, so its group stays on screen.
  if (leaving.group !== undefined) {
    const groupKeys = terminals
      .filter((terminal) => terminal.location === "panel" && terminal.group === leaving.group)
      .map((terminal) => terminal.key);
    const siblings = groupKeys.filter((terminalKey) => terminalKey !== leavingKey);
    if (siblings.length > 0) {
      const groupIndex = groupKeys.indexOf(leavingKey);
      return { activeKey: siblings[Math.min(groupIndex, siblings.length - 1)], panelOpen: state.panelOpen };
    }
  }
  const index = panelKeys.indexOf(leavingKey);
  return { activeKey: remaining[Math.min(index, remaining.length - 1)], panelOpen: state.panelOpen };
}

/** Where a terminal's view is placed: the panel, its editor tab, or parked out of sight. */
export type TerminalPlacement = "panel" | "editor" | "run" | "parked";

/**
 * A terminal is parked while the place that should show it is not on screen
 * (the panel was never opened, or its tab is still being created).
 */
export function terminalPlacement(location: TerminalLocation, hasSlot: boolean): TerminalPlacement {
  if (!hasSlot) {
    return "parked";
  }
  return location;
}
