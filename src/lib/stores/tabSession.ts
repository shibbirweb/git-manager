// The file tabs of each workspace, kept in state.json so they come back after a restart
// (Settings > Editor > Reopen tabs on start). Only paths, flags and positions are kept:
// a restored tab loads its file the first time it is shown. Untitled tabs are kept too; their
// text lives in ~/.gitmanager/unsaved (unsavedText.svelte.ts). Pure, so the validation of a
// hand-edited state.json can be tested.

import {
  type GroupLayout,
  keepInLayout,
  layoutGroupIds,
  MAX_GROUPS,
  parseGroupLayout,
  renameGroups,
  rowLayout,
} from "./groupLayout";
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

/** The first (or only) editor group, plus the others of a split editor. */
export interface SavedTabSession extends SavedTabGroup {
  /** The other editor groups in layout order; missing without a split. */
  groups?: SavedTabGroup[];
  /** How the groups sit (groupLayout.ts); its group ids are indexes: 0 this group, 1 the first of `groups`, and so on. */
  layout?: GroupLayout;
  /** Index of the group that had the focus. */
  focused?: number;
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

/** Every group of a session, the first one first. */
export function sessionGroups(session: SavedTabSession): SavedTabGroup[] {
  return [{ tabs: session.tabs, active: session.active }, ...(session.groups ?? [])];
}

/**
 * A session from `groups` (indexes as in `layout`, side by side without one): groups without
 * tabs drop out, the rest are put in layout order and numbered again, and a lone group is
 * saved without a layout.
 */
export function sessionOf(groups: readonly SavedTabGroup[], layout: GroupLayout | null, focused: number): SavedTabSession {
  const kept = groups.flatMap((group, index) => (group.tabs.length > 0 ? [index] : []));
  if (kept.length <= 1) {
    const only = groups[kept[0] ?? 0] ?? { tabs: [], active: null };
    return { tabs: only.tabs, active: only.active };
  }
  const fitting = (layout && parseGroupLayout(layout, groups.length)) ?? rowLayout(groups.map((_, index) => index));
  const trimmed = keepInLayout(fitting, new Set(kept)) ?? rowLayout(kept);
  const order = layoutGroupIds(trimmed);
  const [first, ...rest] = order.map((index) => groups[index]);
  return {
    tabs: first.tabs,
    active: first.active,
    groups: rest,
    layout: renameGroups(trimmed, (index) => order.indexOf(index)),
    focused: Math.max(0, order.indexOf(focused)),
  };
}

/** One workspace's saved tabs, each group validated; null when nothing usable is left. */
export function parseTabSession(value: unknown): SavedTabSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const data = value as Record<string, unknown>;
  const first = parseTabGroup(data);
  let session: SavedTabSession;
  if (Array.isArray(data.groups)) {
    const groups = [first, ...data.groups.slice(0, MAX_GROUPS - 1).map(parseTabGroup)];
    const focused = typeof data.focused === "number" && Number.isInteger(data.focused) ? data.focused : 0;
    session = sessionOf(groups, parseGroupLayout(data.layout, groups.length), focused);
  } else {
    // Before Split Down a session had at most one right group.
    session = sessionOf([first, parseTabGroup(data.right)], null, data.rightFocused === true ? 1 : 0);
  }
  return session.tabs.length > 0 ? session : null;
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
 * their known positions. `groups` are the editor groups, numbered by their index in `layout`.
 */
export function tabSessionOf(
  groups: readonly SessionGroup[],
  layout: GroupLayout | null,
  focused: number,
  isFile: (tabPath: string) => boolean,
  positions: ReadonlyMap<string, TabPosition>,
): SavedTabSession {
  return sessionOf(
    groups.map((group) => savedGroup(group.tabs, group.active, isFile, positions)),
    layout,
    focused,
  );
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

/** Every path a session holds, first group first: what `restorableTabs` needs answers for. */
export function sessionPaths(session: SavedTabSession): string[] {
  return sessionGroups(session).flatMap((group) => group.tabs.map((tab) => tab.path));
}

/**
 * What to reopen: the saved tabs that still exist (`exists` answers per path, in the order of
 * `sessionPaths`) and lie in the workspace (`inWorkspace`). The active tab falls back to the
 * first one left; a group left empty is dropped.
 */
export function restorableTabs(
  session: SavedTabSession,
  exists: readonly boolean[],
  inWorkspace: (filePath: string) => boolean,
): SavedTabSession {
  let offset = 0;
  const groups = sessionGroups(session).map((group) => {
    const start = offset;
    offset += group.tabs.length;
    const tabs = group.tabs.filter((tab, index) => exists[start + index] === true && inWorkspace(tab.path));
    const active = tabs.some((tab) => tab.path === group.active) ? group.active : (tabs[0]?.path ?? null);
    return { tabs, active };
  });
  return sessionOf(groups, session.layout ?? null, session.focused ?? 0);
}

/**
 * Remember unsaved changes: the session to restore once the tabs with kept text are known.
 * With `reopenAll` off (Reopen tabs on start) only those tabs come back. A kept tab the
 * session lacks (the window closed before the session was written) joins the first group.
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
  const [first, ...others] = (session ? sessionGroups(session) : [{ tabs: [], active: null }]).map(pick);
  const present = new Set([first, ...others].flatMap((group) => group.tabs.map((tab) => tab.path)));
  const added: SavedTab[] = keptPaths
    .filter((tabPath) => !present.has(tabPath) && isSessionTabPath(tabPath))
    .map((tabPath) => ({ path: tabPath, preview: false, pinned: false, position: null }));
  const merged: SavedTabGroup = { tabs: [...first.tabs, ...added].slice(0, MAX_SAVED_TABS), active: first.active };
  const groups = [merged, ...others].map((group) => ({ ...group, active: group.active ?? group.tabs[0]?.path ?? null }));
  const result = sessionOf(groups, session?.layout ?? null, session?.focused ?? 0);
  return result.tabs.length > 0 ? result : null;
}
