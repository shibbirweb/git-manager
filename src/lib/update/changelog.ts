// CHANGELOG.md parsing ("Keep a Changelog" format), shared by the app's
// What's New dialog and the update dialog. The release workflows read the
// same file through scripts/version.ts (`notes`).

export interface ChangelogEntry {
  /** "0.2.0", or "Unreleased". */
  version: string;
  /** ISO date from the heading, when present. */
  date: string | null;
  /** Markdown between this heading and the next version heading. */
  body: string;
}

const HEADING = /^##\s+\[?([^\]\s]+)\]?(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\s*$/;

export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: { version: string; date: string | null; lines: string[] } | null = null;
  const finish = () => {
    if (current) {
      entries.push({ version: current.version, date: current.date, body: current.lines.join("\n").trim() });
    }
  };
  for (const line of text.split(/\r?\n/)) {
    const match = HEADING.exec(line);
    if (match) {
      finish();
      current = { version: match[1], date: match[2] ?? null, lines: [] };
      continue;
    }
    // Reference-style link definitions at the bottom are not notes.
    if (current && !/^\[[^\]]+\]:\s*\S+/.test(line)) {
      current.lines.push(line);
    }
  }
  finish();
  return entries;
}

/** The entry for a version; a leading "v" is ignored on both sides. */
export function entryFor(text: string, version: string): ChangelogEntry | null {
  const wanted = version.replace(/^v/, "");
  return parseChangelog(text).find((entry) => entry.version.replace(/^v/, "") === wanted) ?? null;
}

/** Released entries (not "Unreleased"), newest first as written in the file. */
export function releasedEntries(text: string): ChangelogEntry[] {
  return parseChangelog(text).filter((entry) => entry.version.toLowerCase() !== "unreleased");
}
