// Commit message history for the commit box: messages typed but not committed (a failed
// commit, a cleared or replaced box), messages committed from the app and the user's recent
// commits, merged newest first. Pure, so state.json validation and the tests share it.

/** Messages the history dropdown lists per repository. */
export const MAX_MESSAGE_HISTORY = 30;
/** Repositories state.json keeps a history for; the least recently used go first. */
export const MAX_HISTORY_REPOS = 50;
/** Longer text is not a commit message worth keeping. */
export const MAX_MESSAGE_LENGTH = 20_000;

export interface HistoryEntry {
  message: string;
  /** Milliseconds since the epoch. */
  time: number;
}

/** History entries by repository root. */
export type MessageHistory = Record<string, HistoryEntry[]>;

/** Drops blank lines at the start and whitespace at the end, like git does. */
export function cleanMessage(message: string): string {
  return message.replace(/^(?:[ \t]*\r?\n)+/, "").trimEnd();
}

/** Puts `message` first, removing an older copy; blank and huge messages are ignored. */
export function rememberMessage(
  entries: HistoryEntry[],
  message: string,
  time: number,
  cap: number = MAX_MESSAGE_HISTORY,
): HistoryEntry[] {
  const text = cleanMessage(message);
  if (text === "" || text.length > MAX_MESSAGE_LENGTH) {
    return entries;
  }
  return [{ message: text, time }, ...entries.filter((entry) => entry.message !== text)].slice(0, cap);
}

/** Saved and committed messages together, newest first, each message once (its newest time). */
export function mergeHistory(saved: HistoryEntry[], fromLog: HistoryEntry[], cap: number = MAX_MESSAGE_HISTORY): HistoryEntry[] {
  const newest = new Map<string, number>();
  for (const entry of [...saved, ...fromLog]) {
    const text = cleanMessage(entry.message);
    if (text === "") {
      continue;
    }
    const previous = newest.get(text);
    if (previous === undefined || entry.time > previous) {
      newest.set(text, entry.time);
    }
  }
  return [...newest]
    .map(([message, time]) => ({ message, time }))
    .sort((a, b) => b.time - a.time)
    .slice(0, cap);
}

function newestTime(entries: HistoryEntry[]): number {
  return entries.reduce((newest, entry) => Math.max(newest, entry.time), 0);
}

/** Keeps the `max` repositories used most recently. */
export function pruneRepos(history: MessageHistory, max: number = MAX_HISTORY_REPOS): MessageHistory {
  const entries = Object.entries(history);
  if (entries.length <= max) {
    return history;
  }
  return Object.fromEntries(entries.sort((a, b) => newestTime(b[1]) - newestTime(a[1])).slice(0, max));
}

/** `history` with `message` remembered for `repoRoot`; the same object when nothing changed. */
export function rememberInHistory(history: MessageHistory, repoRoot: string, message: string, time: number): MessageHistory {
  const current = history[repoRoot] ?? [];
  const next = rememberMessage(current, message, time);
  if (next === current) {
    return history;
  }
  return pruneRepos({ ...history, [repoRoot]: next });
}

/** Validates the `commitMessages` object of state.json: anything malformed is dropped. */
export function parseMessageHistory(value: unknown): MessageHistory {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const history: MessageHistory = {};
  for (const [repoRoot, raw] of Object.entries(value as Record<string, unknown>)) {
    if (repoRoot === "" || !Array.isArray(raw)) {
      continue;
    }
    const seen = new Set<string>();
    const entries: HistoryEntry[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const { message, time } = item as Record<string, unknown>;
      if (typeof message !== "string" || typeof time !== "number" || !Number.isFinite(time)) {
        continue;
      }
      const text = cleanMessage(message);
      if (text === "" || text.length > MAX_MESSAGE_LENGTH || seen.has(text)) {
        continue;
      }
      seen.add(text);
      entries.push({ message: text, time });
    }
    if (entries.length > 0) {
      history[repoRoot] = entries.slice(0, MAX_MESSAGE_HISTORY);
    }
  }
  return pruneRepos(history);
}

/** The menu label of a message: its first line, shortened. */
export function historyLabel(message: string, width = 72): string {
  const firstLine = cleanMessage(message).split(/\r?\n/, 1)[0] ?? "";
  const chars = [...firstLine];
  const label = chars.length > width ? `${chars.slice(0, width - 3).join("")}...` : firstLine;
  return label === "" ? "(empty first line)" : label;
}
