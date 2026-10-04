// Clickable file paths in the terminal: `src/app.ts`,
// `src/app.ts:12`, `src/app.ts:12:5` and `src/app.ts(12,5)`, resolved against
// the terminal's folder and kept only for files that exist inside an open
// workspace folder. Kept free of Svelte, Tauri and xterm so it can be tested
// directly; TerminalView turns the results into xterm links.

import { folderFor, joinPath, normalizePath, type FolderRef } from "$lib/stores/workspacePaths";

/** A path-like piece of one terminal line. */
export interface PathCandidate {
  /** String offsets in the line, end exclusive; the link covers the line and column too. */
  start: number;
  end: number;
  text: string;
  /** Paths to try, in order: as printed, then without git's `a/` or `b/` prefix. */
  paths: string[];
  /** 1-based, as printed. */
  line: number | null;
  column: number | null;
}

/** A candidate that names an existing workspace file. */
export interface FileLink {
  start: number;
  end: number;
  text: string;
  filePath: string;
  line: number | null;
  column: number | null;
}

/** Longest line scanned; longer output (minified code, base64) is not worth it. */
export const MAX_LINK_LINE = 2000;
/** Candidates checked per line at most, so one line never asks for dozens of files. */
export const MAX_CANDIDATES_PER_LINE = 16;

// Runs of characters that may form a path, optionally followed by "(12,5)".
const RUN = /[^\s'"`<>[\]{}|,;=()]+(?:\(\d+(?:, ?\d+)?\))?/g;
const COLON_SUFFIX = /^(.*?)(?::(\d+)(?::(\d+))?)?$/;
const PAREN_SUFFIX = /^(.*)\((\d+)(?:, ?(\d+))?\)$/;
const EXTENSION = /\.[A-Za-z][A-Za-z0-9_-]{0,11}$/;
const TRAILING = /[.,:;!?]+$/;

function lineNumber(text: string | undefined): number | null {
  if (!text) {
    return null;
  }
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Whether a printed path is worth asking about: it has a folder part or a file extension. */
function looksLikePath(pathText: string): boolean {
  if (!pathText || pathText.includes("://") || pathText.startsWith("-") || pathText.startsWith("~")) {
    return false;
  }
  if (/^\.+$/.test(pathText.replace(/\/+$/, ""))) {
    return false;
  }
  if (pathText.endsWith("/")) {
    return false;
  }
  return pathText.includes("/") || EXTENSION.test(pathText);
}

/** The path-like pieces of one line of terminal output, left to right. */
export function findPathCandidates(lineText: string): PathCandidate[] {
  if (!lineText || lineText.length > MAX_LINK_LINE) {
    return [];
  }
  const candidates: PathCandidate[] = [];
  for (const match of lineText.matchAll(RUN)) {
    if (candidates.length >= MAX_CANDIDATES_PER_LINE) {
      break;
    }
    const start = match.index ?? 0;
    const text = match[0].replace(TRAILING, "");
    if (!text) {
      continue;
    }
    let pathText: string;
    let line: number | null;
    let column: number | null;
    const paren = PAREN_SUFFIX.exec(text);
    if (paren) {
      pathText = paren[1];
      line = lineNumber(paren[2]);
      column = lineNumber(paren[3]);
    } else {
      const colon = COLON_SUFFIX.exec(text);
      pathText = colon?.[1] ?? text;
      line = lineNumber(colon?.[2]);
      column = lineNumber(colon?.[3]);
    }
    if (!looksLikePath(pathText)) {
      continue;
    }
    const paths = [pathText];
    const gitPrefix = /^[ab]\/(.+)$/.exec(pathText);
    if (gitPrefix && looksLikePath(gitPrefix[1])) {
      paths.push(gitPrefix[1]);
    }
    candidates.push({ start, end: start + text.length, text, paths, line, column });
  }
  return candidates;
}

/** An absolute path for a printed one, or null when it cannot be resolved (relative without a folder). */
export function resolveTerminalPath(pathText: string, folderPath: string | null): string | null {
  if (pathText.startsWith("/")) {
    return normalizePath(pathText);
  }
  if (!folderPath || !folderPath.startsWith("/")) {
    return null;
  }
  return normalizePath(joinPath(folderPath, pathText));
}

/**
 * The folder an OSC 7 sequence reports (`file://host/path`, percent-encoded),
 * which shells send after every `cd` when their integration is on.
 */
export function parseOsc7(data: string): string | null {
  const text = (data ?? "").trim();
  if (!text.toLowerCase().startsWith("file://")) {
    return null;
  }
  const rest = text.slice("file://".length);
  const slash = rest.indexOf("/");
  if (slash < 0) {
    return null;
  }
  try {
    const folderPath = decodeURIComponent(rest.slice(slash));
    return folderPath.startsWith("/") && !folderPath.includes("\0") ? folderPath : null;
  } catch {
    return null;
  }
}

/** One xterm cell, as much of it as the mapping needs. */
export interface CellText {
  chars: string;
  width: number;
}

/**
 * The line's text with, for each string offset, the cell it sits in. Wide
 * characters take two cells (the second has width 0 and no text), so string
 * offsets and cell columns differ once one appears.
 */
export function lineCells(cells: CellText[]): { text: string; cellAt: number[] } {
  let text = "";
  const cellAt: number[] = [];
  cells.forEach((cell, cellIndex) => {
    if (cell.width === 0) {
      return;
    }
    const chars = cell.chars || " ";
    text += chars;
    for (let offset = 0; offset < chars.length; offset += 1) {
      cellAt.push(cellIndex);
    }
  });
  // Trailing blanks are not part of any path.
  const trimmed = text.replace(/\s+$/, "");
  return { text: trimmed, cellAt: cellAt.slice(0, trimmed.length) };
}

/**
 * Remembers which files exist for the lines on screen. Lookups for one line go
 * to the backend in one call, the same path is never asked twice at once, and
 * the cache is dropped when the terminal scrolls (TerminalView calls `clear`),
 * so it only ever holds what the viewport showed.
 */
export class FileExistenceCache {
  private known = new Map<string, boolean>();
  private pending = new Map<string, Promise<boolean>>();

  constructor(
    private readonly check: (filePaths: string[]) => Promise<boolean[]>,
    private readonly limit = 400,
  ) {}

  get size(): number {
    return this.known.size;
  }

  async exists(filePaths: string[]): Promise<Map<string, boolean>> {
    const unique = [...new Set(filePaths)];
    const unknown = unique.filter((filePath) => !this.known.has(filePath) && !this.pending.has(filePath));
    if (unknown.length > 0) {
      const request = this.check(unknown).catch(() => unknown.map(() => false));
      unknown.forEach((filePath, index) => {
        this.pending.set(
          filePath,
          request.then((answers) => {
            const exists = answers[index] === true;
            this.pending.delete(filePath);
            if (this.known.size >= this.limit) {
              this.known.clear();
            }
            this.known.set(filePath, exists);
            return exists;
          }),
        );
      });
    }
    const result = new Map<string, boolean>();
    for (const filePath of unique) {
      const known = this.known.get(filePath);
      result.set(filePath, known ?? (await (this.pending.get(filePath) ?? Promise.resolve(false))));
    }
    return result;
  }

  clear(): void {
    this.known.clear();
  }
}

export interface LinkContext {
  /** The terminal's folder: the last OSC 7 one, else where it started. */
  folderPath: string | null;
  workspaceFolders: FolderRef[];
  cache: FileExistenceCache;
}

/** The file links of one line: candidates resolved, kept inside the workspace and checked for existence. */
export async function fileLinksForLine(lineText: string, context: LinkContext): Promise<FileLink[]> {
  const candidates = findPathCandidates(lineText);
  if (candidates.length === 0 || context.workspaceFolders.length === 0) {
    return [];
  }
  const resolved = candidates.map((candidate) =>
    candidate.paths
      .map((pathText) => resolveTerminalPath(pathText, context.folderPath))
      .filter((filePath): filePath is string => filePath !== null && folderFor(context.workspaceFolders, filePath) !== null),
  );
  const toCheck = resolved.flat();
  if (toCheck.length === 0) {
    return [];
  }
  const exists = await context.cache.exists(toCheck);
  const links: FileLink[] = [];
  candidates.forEach((candidate, index) => {
    const filePath = resolved[index].find((candidatePath) => exists.get(candidatePath) === true);
    if (filePath) {
      links.push({
        start: candidate.start,
        end: candidate.end,
        text: candidate.text,
        filePath,
        line: candidate.line,
        column: candidate.column,
      });
    }
  });
  return links;
}
