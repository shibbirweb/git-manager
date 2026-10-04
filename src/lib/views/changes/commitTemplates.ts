// Commit message templates: the user's own (Settings > Git) with placeholders, git's
// `commit.template` file, and the subject line length guide. Pure, so settings.json
// validation and the tests share it.

export interface CommitTemplate {
  name: string;
  text: string;
}

export const MAX_COMMIT_TEMPLATES = 50;
export const MAX_TEMPLATE_NAME_LENGTH = 80;
export const MAX_TEMPLATE_TEXT_LENGTH = 10_000;
/** Past this many characters the subject line gets a soft warning, like git's 50/72 habit. */
export const SUBJECT_SOFT_LIMIT = 72;

export const TEMPLATE_PLACEHOLDERS: { token: string; hint: string }[] = [
  { token: "{branch}", hint: "the current branch" },
  { token: "{ticket}", hint: "the ticket in the branch name, like GM-12" },
  { token: "{user}", hint: "your user.name" },
  { token: "{date}", hint: "today, like 2026-10-03" },
  { token: "{cursor}", hint: "where the caret goes" },
];

/** Validates the `commitTemplates` list of settings.json: anything malformed is dropped. */
export function parseCommitTemplates(value: unknown): CommitTemplate[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const templates: CommitTemplate[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const { name, text } = item as Record<string, unknown>;
    if (typeof name !== "string" || typeof text !== "string") {
      continue;
    }
    const cleanName = name.trim();
    if (cleanName === "" || cleanName.length > MAX_TEMPLATE_NAME_LENGTH || text.length > MAX_TEMPLATE_TEXT_LENGTH) {
      continue;
    }
    templates.push({ name: cleanName, text });
    if (templates.length >= MAX_COMMIT_TEMPLATES) {
      break;
    }
  }
  return templates;
}

/** Why `name` cannot name the template at `index`, or null. */
export function validateTemplateName(name: string, templates: CommitTemplate[], index: number): string | null {
  const clean = name.trim();
  if (clean === "") {
    return "Give the template a name";
  }
  if (clean.length > MAX_TEMPLATE_NAME_LENGTH) {
    return `Keep the name under ${MAX_TEMPLATE_NAME_LENGTH} characters`;
  }
  const taken = templates.some((template, other) => other !== index && template.name.toLowerCase() === clean.toLowerCase());
  return taken ? "Another template has this name" : null;
}

// A Jira-style key: 2 to 10 capital letters (digits after the first), a dash, a number.
const STRICT_TICKET = /(?:^|[^A-Za-z0-9])([A-Z][A-Z0-9]{1,9}-\d+)(?![0-9])/;
// Lower-case keys too ("abc-123-fix"), when the word is not a usual branch prefix.
const LOOSE_TICKET = /(?:^|[^A-Za-z0-9])([A-Za-z]{2,10})-(\d+)(?![0-9])/g;
const NOT_TICKETS = new Set([
  "alpha",
  "beta",
  "bugfix",
  "build",
  "chore",
  "docs",
  "feat",
  "feature",
  "fix",
  "hotfix",
  "patch",
  "rc",
  "refactor",
  "release",
  "test",
  "version",
  "wip",
]);

/** The ticket key in a branch name ("feat/GM-12-search" gives "GM-12"), or null. */
export function ticketFromBranch(branchName: string | null): string | null {
  if (!branchName) {
    return null;
  }
  const strict = STRICT_TICKET.exec(branchName);
  if (strict) {
    return strict[1];
  }
  for (const match of branchName.matchAll(LOOSE_TICKET)) {
    if (!NOT_TICKETS.has(match[1].toLowerCase())) {
      return `${match[1].toUpperCase()}-${match[2]}`;
    }
  }
  return null;
}

export interface TemplateContext {
  /** The current branch; null when detached or unknown. */
  branch: string | null;
  /** The configured user.name, if any. */
  userName: string | null;
  date: Date;
}

/** "2026-10-03" in local time. */
export function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Fills in {branch}, {ticket}, {user} and {date}; unknown values become empty. The first
 * {cursor} marks where the caret goes (its offset in the result) and every {cursor} is removed.
 * Other braces are left as they are.
 */
export function expandTemplate(text: string, context: TemplateContext): { text: string; cursor: number | null } {
  const values: Record<string, string> = {
    branch: context.branch ?? "",
    ticket: ticketFromBranch(context.branch) ?? "",
    user: context.userName ?? "",
    date: isoDate(context.date),
  };
  let result = "";
  let cursor: number | null = null;
  let last = 0;
  for (const match of text.matchAll(/\{(branch|ticket|user|date|cursor)\}/g)) {
    result += text.slice(last, match.index);
    if (match[1] === "cursor") {
      cursor ??= result.length;
    } else {
      result += values[match[1]];
    }
    last = match.index + match[0].length;
  }
  result += text.slice(last);
  return { text: result, cursor };
}

/**
 * Splits a `commit.template` file: the text to prefill (comment lines removed, since a
 * commit with -F keeps them) and the comments, shown as the box's placeholder instead.
 */
export function splitGitTemplate(raw: string, commentChar = "#"): { text: string; comments: string } {
  const text: string[] = [];
  const comments: string[] = [];
  for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith(commentChar)) {
      comments.push(line.slice(commentChar.length).trim());
    } else {
      text.push(line);
    }
  }
  return {
    text: text.join("\n").replace(/^(?:[ \t]*\n)+/, "").trimEnd(),
    comments: comments.filter((comment) => comment !== "").join("\n"),
  };
}

/** Characters in the first line of `message`. */
export function subjectLength(message: string): number {
  const firstLine = message.replace(/^(?:[ \t]*\r?\n)+/, "").split(/\r?\n/, 1)[0] ?? "";
  return [...firstLine.trimEnd()].length;
}

/** A short note when the subject line is longer than `limit`, else null. */
export function subjectWarning(message: string, limit: number = SUBJECT_SOFT_LIMIT): string | null {
  const length = subjectLength(message);
  return length > limit ? `Subject is ${length} characters; keep it to ${limit}` : null;
}
