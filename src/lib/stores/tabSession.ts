// The file tabs of each workspace, kept in state.json so they come back after a restart
// (Settings > Editor > Reopen tabs on start). Only paths, flags and positions are kept:
// a restored tab loads its file the first time it is shown. Untitled tabs are kept too; their
// text lives in ~/.gitmanager/unsaved (unsavedText.svelte.ts). Pure, so the validation of a
// hand-edited state.json can be tested.

import { isUntitledTab } from "./untitledTabs";

/** Where the caret and the view were in a file tab. Lines and columns are 0-based. */
export interface TabPosition {
  line: number;
  column: number;
  /** The (fractional) line at the top of the editor. */
  topLine: number;
}

export interface SavedTab {
  /** Absolute file path, or an Untitled tab's path. */
  path: string;
  preview: boolean;
  pinned: boolean;
  position: TabPosition | null;
}

export interface SavedTabGroup {
  tabs: SavedTab[];
  /** The tab that was on screen, if it is one of `tabs`. */
  active: string | null;
}

/** The left (or only) editor group, plus the right one of a split editor. */
export interface SavedTabSession extends SavedTabGroup {
  /** The right editor group; missing without a split. */
  right?: SavedTabGroup;
  /** The right group had the focus. */
  rightFocused?: boolean;
}

/** Tabs kept per workspace; more than anyone keeps open, and small enough for state.json. */
export const MAX_SAVED_TABS = 50;
/** Workspaces whose tabs are kept; the least recently saved go first. */
export const MAX_TAB_SESSIONS = 30;
/** No real line number or column is near this; it keeps a hand edit from holding huge numbers. */
const MAX_POSITION = 10_000_000;
export const MAX_PATH_LENGTH = 4096;

/** An absolute path the app could have written: "/..." or "C:/..." (and "C:\..."). */
export function isSavablePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 1 &&
    value.length <= MAX_PATH_LENGTH &&
    !value.includes("\0") &&
    (value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value))
  );
}

/** A tab a session may hold: a file, or an Untitled tab. */
export function isSessionTabPath(value: unknown): value is string {
  return isSavablePath(value) || (typeof value === "string" && isUntitledTab(value));
}

function pickCount(value: unknown, fractional: boolean): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const clamped = Math.min(MAX_POSITION, value);
  return fractional ? Math.round(clamped * 100) / 100 : Math.floor(clamped);
}

export function parseTabPosition(value: unknown): TabPosition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const data = value as Record<string, unknown>;
  const line = pickCount(data.line, false);
  if (line === null) {
    return null;
  }
  return {
    line,
    column: pickCount(data.column, false) ?? 0,
    topLine: pickCount(data.topLine, true) ?? Math.max(0, line - 5),
  };
}

/** One group's saved tabs: valid absolute paths only, no repeats, capped. */
function parseTabGroup(value: unknown): SavedTabGroup {
  const data = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const tabs: SavedTab[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(data.tabs) ? data.tabs : []) {
    if (tabs.length >= MAX_SAVED_TABS) {
      break;
    }
    const tab = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
    const path = tab?.path;
    if (!tab || !isSessionTabPath(path) || seen.has(path)) {
      continue;
    }
    seen.add(path);
    tabs.push({
      path,
      preview: tab.preview === true,
      pinned: tab.pinned === true,
      position: parseTabPosition(tab.position),
    });
  }
  const active = typeof data.active === "string" && seen.has(data.active) ? data.active : null;
  return { tabs, active };
}

/** One workspace's saved tabs, each group validated; null when nothing usable is left. */
export function parseTabSession(value: unknown): SavedTabSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const data = value as Record<string, unknown>;
  const left = parseTabGroup(data);
  const right = parseTabGroup(data.right);
  if (left.tabs.length === 0) {
    // A right group alone is just the tabs.
    return right.tabs.length > 0 ? right : null;
  }
  return right.tabs.length > 0 ? { ...left, right, rightFocused: data.rightFocused === true } : left;
}

/** Every workspace's saved tabs, by workspace id, the most recently saved last. */
export function parseTabSessions(value: unknown): Record<string, SavedTabSession> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const sessions: [string, SavedTabSession][] = [];
  for (const [workspaceId, entry] of Object.entries(value as Record<string, unknown>)) {
    const session = workspaceId.length > 0 && workspaceId.length <= MAX_PATH_LENGTH * 4 ? parseTabSession(entry) : null;
    if (session) {
      sessions.push([workspaceId, session]);
    }
  }
  return Object.fromEntries(sessions.slice(-MAX_TAB_SESSIONS));
}

/**
 * `sessions` with `workspaceId` set to `session` (moved to the end, as the most recent), or
 * removed when `session` is null or empty; the oldest beyond `MAX_TAB_SESSIONS` are dropped.
 */
export function withTabSession(
  sessions: Record<string, SavedTabSession>,
  workspaceId: string,
  session: SavedTabSession | null,
): Record<string, SavedTabSession> {
  const { [workspaceId]: _previous, ...rest } = sessions;
  const entries = Object.entries(rest);
  if (session && session.tabs.length > 0) {
    entries.push([workspaceId, session]);
  }
  return Object.fromEntries(entries.slice(-MAX_TAB_SESSIONS));
}

export interface SessionTab {
  path: string;
  preview: boolean;
  pinned?: boolean;
}

export interface SessionGroup {
  tabs: readonly SessionTab[];
  active: string | null;
}

/**
 * The session to save for the open tabs: file tabs only (`isFile`), in order, capped, with
 * their known positions. `right` is the right editor group of a split editor.
 */
export function tabSessionOf(
  tabs: readonly SessionTab[],
  active: string | null,
  isFile: (tabPath: string) => boolean,
  positions: ReadonlyMap<string, TabPosition>,
  right: (SessionGroup & { focused: boolean }) | null = null,
): SavedTabSession {
  const left = savedGroup(tabs, active, isFile, positions);
  const saved = right ? savedGroup(right.tabs, right.active, isFile, positions) : null;
  if (!saved || saved.tabs.length === 0) {
    return left;
  }
  if (left.tabs.length === 0) {
    return saved;
  }
  return { ...left, right: saved, rightFocused: right?.focused ?? false };
}

function savedGroup(
  tabs: readonly SessionTab[],
  active: string | null,
  isFile: (tabPath: string) => boolean,
  positions: ReadonlyMap<string, TabPosition>,
): SavedTabGroup {
  const saved: SavedTab[] = [];
  for (const tab of tabs) {
    if (saved.length >= MAX_SAVED_TABS) {
      break;
    }
    if (!isFile(tab.path) || !isSessionTabPath(tab.path)) {
      continue;
    }
    saved.push({ path: tab.path, preview: tab.preview, pinned: tab.pinned ?? false, position: positions.get(tab.path) ?? null });
  }
  return { tabs: saved, active: active !== null && saved.some((tab) => tab.path === active) ? active : null };
}

/** Two sessions hold the same tabs, flags and positions, so saving again would change nothing. */
export function sameTabSession(a: SavedTabSession | null, b: SavedTabSession | null): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Every path a session holds, left group first: what `restorableTabs` needs answers for. */
export function sessionPaths(session: SavedTabSession): string[] {
  return [...session.tabs, ...(session.right?.tabs ?? [])].map((tab) => tab.path);
}

/**
 * What to reopen: the saved tabs that still exist (`exists` answers per path, in the order of
 * `sessionPaths`) and lie in the workspace (`inWorkspace`). The active tab falls back to the
 * first one left; a right group left empty is dropped.
 */
export function restorableTabs(
  session: SavedTabSession,
  exists: readonly boolean[],
  inWorkspace: (filePath: string) => boolean,
): SavedTabSession {
  const pick = (group: SavedTabGroup, offset: number): SavedTabGroup => {
    const tabs = group.tabs.filter((tab, index) => exists[offset + index] === true && inWorkspace(tab.path));
    const active = tabs.some((tab) => tab.path === group.active) ? group.active : (tabs[0]?.path ?? null);
    return { tabs, active };
  };
  const left = pick(session, 0);
  const right = session.right ? pick(session.right, session.tabs.length) : null;
  if (!right || right.tabs.length === 0) {
    return left;
  }
  if (left.tabs.length === 0) {
    return right;
  }
  return { ...left, right, rightFocused: session.rightFocused ?? false };
}

/**
 * Remember unsaved changes: the session to restore once the tabs with kept text are known.
 * With `reopenAll` off (Reopen tabs on start) only those tabs come back. A kept tab the
 * session lacks (the window closed before the session was written) joins the left group.
 */
export function sessionWithKept(
  session: SavedTabSession | null,
  keptPaths: readonly string[],
  reopenAll: boolean,
): SavedTabSession | null {
  const kept = new Set(keptPaths);
  const pick = (group: SavedTabGroup): SavedTabGroup => {
    const tabs = reopenAll ? group.tabs : group.tabs.filter((tab) => kept.has(tab.path));
    return { tabs, active: tabs.some((tab) => tab.path === group.active) ? group.active : null };
  };
  const left = session ? pick(session) : { tabs: [], active: null };
  const right = session?.right ? pick(session.right) : null;
  const present = new Set([...left.tabs, ...(right?.tabs ?? [])].map((tab) => tab.path));
  const added: SavedTab[] = keptPaths
    .filter((tabPath) => !present.has(tabPath) && isSessionTabPath(tabPath))
    .map((tabPath) => ({ path: tabPath, preview: false, pinned: false, position: null }));
  const merged: SavedTabGroup = { tabs: [...left.tabs, ...added].slice(0, MAX_SAVED_TABS), active: left.active };
  const active = merged.active ?? merged.tabs[0]?.path ?? null;
  if (!right || right.tabs.length === 0) {
    return merged.tabs.length > 0 ? { ...merged, active } : null;
  }
  if (merged.tabs.length === 0) {
    return { ...right, active: right.active ?? right.tabs[0]?.path ?? null };
  }
  return { ...merged, active, right, rightFocused: session?.rightFocused ?? false };
}
