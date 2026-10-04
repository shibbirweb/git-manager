// The Command Palette's recently used commands, most recent first, kept in state.json.
// Pure: settingsData.ts validates the saved list with `pickRecentCommands`.

export const MAX_RECENT_COMMANDS = 20;
/** Command ids are short ("git.file.history"); anything longer was not written by the app. */
const MAX_COMMAND_ID = 100;

/** A saved list, validated: unique non-empty strings, at most `MAX_RECENT_COMMANDS`. Unknown ids are kept (a later version may know them). */
export function pickRecentCommands(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || entry === "" || entry.length > MAX_COMMAND_ID || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    if (seen.size >= MAX_RECENT_COMMANDS) {
      break;
    }
  }
  return [...seen];
}

/** `commandId` moved to the front, without duplicates, capped. */
export function pushRecentCommand(recent: readonly string[], commandId: string, limit = MAX_RECENT_COMMANDS): string[] {
  return [commandId, ...recent.filter((entry) => entry !== commandId)].slice(0, limit);
}

/** Position of each command in the list, for ordering; missing ones are not recent. */
export function recentRanks(recent: readonly string[]): Map<string, number> {
  return new Map(recent.map((commandId, index) => [commandId, index]));
}
