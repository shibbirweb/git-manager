// Pure parts of the integrated terminal: naming, which terminal becomes active
// after one closes, where a new one starts and which shell it runs. Kept free of
// Svelte, Tauri and xterm so it can be tested directly.

import type { ShellProfile } from "$lib/types";

/** Longest name Rename accepts. */
export const MAX_TERMINAL_NAME = 60;

/** Name used when the shell is not known yet. */
export const FALLBACK_SHELL_NAME = "terminal";

/**
 * A name not used by another terminal, like VS Code: the first zsh is "zsh",
 * the next "zsh (2)", then "zsh (3)". Freed numbers are reused.
 */
export function uniqueTerminalName(shellName: string, takenNames: string[]): string {
  const base = shellName.trim() || FALLBACK_SHELL_NAME;
  const taken = new Set(takenNames);
  if (!taken.has(base)) {
    return base;
  }
  let number = 2;
  while (taken.has(`${base} (${number})`)) {
    number += 1;
  }
  return `${base} (${number})`;
}

/**
 * The terminal to show after `closedKey` closes: the active one stays when
 * another closes; otherwise its right neighbour, else its left one, else none.
 */
export function activeAfterClose(terminalKeys: number[], closedKey: number, activeKey: number | null): number | null {
  const remaining = terminalKeys.filter((terminalKey) => terminalKey !== closedKey);
  if (activeKey !== closedKey && activeKey !== null && remaining.includes(activeKey)) {
    return activeKey;
  }
  const index = terminalKeys.indexOf(closedKey);
  if (remaining.length === 0) {
    return null;
  }
  if (index < 0) {
    return remaining[0];
  }
  return remaining[Math.min(index, remaining.length - 1)];
}

export interface StartFolderInput {
  /** A folder asked for explicitly, e.g. from the Files panel. */
  requestedFolder?: string | null;
  /** Root of the active repository. */
  repoRoot?: string | null;
  /** Workspace folder roots, in order. */
  workspaceFolders?: string[];
}

/** Where a new terminal starts; null lets the backend use the home folder. */
export function startFolder(input: StartFolderInput): string | null {
  return input.requestedFolder || input.repoRoot || input.workspaceFolders?.[0] || null;
}

/**
 * The shell id to spawn. An explicit choice wins; the default setting is used
 * while it still exists on this machine (or while the list is unknown); null
 * means the login shell.
 */
export function resolveShellId(requestedShellId: string | null, defaultShellId: string | null, shells: ShellProfile[]): string | null {
  if (requestedShellId) {
    return requestedShellId;
  }
  if (!defaultShellId) {
    return null;
  }
  if (shells.length === 0 || shells.some((shell) => shell.id === defaultShellId)) {
    return defaultShellId;
  }
  return null;
}

/** Display name of the shell a terminal will run, before it has started. */
export function shellNameFor(shellId: string | null, shells: ShellProfile[]): string {
  const shell = shellId ? shells.find((profile) => profile.id === shellId) : shells.find((profile) => profile.isDefault);
  if (shell) {
    return shell.name;
  }
  if (shellId) {
    return shellId.slice(shellId.lastIndexOf("/") + 1) || FALLBACK_SHELL_NAME;
  }
  return FALLBACK_SHELL_NAME;
}

/** Last part of a folder path, shown next to the terminal name. */
export function folderLabel(folderPath: string | null): string {
  if (!folderPath) {
    return "~";
  }
  const trimmed = folderPath.length > 1 ? folderPath.replace(/\/+$/, "") : folderPath;
  return trimmed.slice(trimmed.lastIndexOf("/") + 1) || trimmed;
}

/** Checks a name typed in Rename; returns the problem or null. */
export function validateTerminalName(value: string): string | null {
  const name = value.trim();
  if (!name) {
    return "Enter a name";
  }
  if (name.length > MAX_TERMINAL_NAME) {
    return `Use at most ${MAX_TERMINAL_NAME} characters`;
  }
  return null;
}

/** Line written when a shell ends with an error, dimmed with SGR 2. */
export function exitMessage(exitCode: number | null): string {
  const text = exitCode === null ? "[Process exited]" : `[Process exited with code ${exitCode}]`;
  return `\r\n\x1b[2m${text}\x1b[0m\r\n`;
}

/** The terminal itself keeps at least this much width beside the list. */
export const MIN_TERMINAL_VIEW_WIDTH = 240;

/** Widest the terminal list may be in a panel this wide, so the terminal keeps its room. */
export function maxListWidth(panelWidth: number, minListWidth: number): number {
  return Math.max(minListWidth, Math.round(panelWidth - MIN_TERMINAL_VIEW_WIDTH));
}

/** Height actually used: the saved one, kept between the minimum and what the editor can spare. */
export function clampPanelHeight(savedHeight: number, minHeight: number, maxHeight: number): number {
  return Math.round(Math.max(minHeight, Math.min(savedHeight, Math.max(minHeight, maxHeight))));
}

/** How far a terminal has got on its way to a running shell. */
export type StartupPhase = "loading" | "starting" | "ready" | "failed";

/** A shell that prints nothing (no prompt yet) still counts as started after this long. */
export const QUIET_SHELL_MS = 1500;

/** Status shown in an empty terminal while it starts; null once there is something to see. */
export function startupLabel(phase: StartupPhase, shellName: string): string | null {
  if (phase === "loading") {
    return "Loading terminal...";
  }
  if (phase === "starting") {
    return `Starting ${shellName.trim() || FALLBACK_SHELL_NAME}...`;
  }
  return null;
}

/** Heading of the error shown in place of a terminal that could not start. */
export function startupFailureTitle(xtermLoaded: boolean, shellName: string): string {
  return xtermLoaded ? `Could not start ${shellName.trim() || FALLBACK_SHELL_NAME}` : "Could not load the terminal";
}
