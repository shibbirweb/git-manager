// Add to .gitignore: the patterns offered for a file or folder, escaped so git reads them
// as the literal path (gitignore(5)): `\` before `*`, `?`, `[` and `\`, before a leading `#`
// or `!`, and before trailing spaces, which git would drop otherwise. Pure, so it is tested.

export type IgnoreKind = "file" | "folder" | "extension";

export interface IgnoreChoice {
  kind: IgnoreKind;
  /** The line written to the ignore file. */
  pattern: string;
  /** The repo-relative file or folder it was made for (to find tracked matches). */
  scopePath: string;
}

/**
 * A path as literal gitignore text, or null when it cannot be one (a line break in the name).
 * `atLineStart` false: the text follows a "/" or "*.", so a leading "#" or "!" is plain.
 */
export function escapeIgnoreText(text: string, atLineStart = true): string | null {
  if (text === "" || /[\r\n]/.test(text)) {
    return null;
  }
  let escaped = text.replace(/[\\*?[]/g, (character) => `\\${character}`);
  if (atLineStart && (escaped.startsWith("#") || escaped.startsWith("!"))) {
    escaped = `\\${escaped}`;
  }
  const trailing = /( +)$/.exec(escaped)?.[1].length ?? 0;
  if (trailing > 0) {
    escaped = escaped.slice(0, escaped.length - trailing) + "\\ ".repeat(trailing);
  }
  return escaped;
}

function trimSlashes(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** "/path/to/file": only that file, anchored at the repository root. */
export function filePattern(repoRelativePath: string): string | null {
  const escaped = escapeIgnoreText(trimSlashes(repoRelativePath), false);
  return escaped === null ? null : `/${escaped}`;
}

/** "/folder/": that folder and everything in it. */
export function folderPattern(repoRelativePath: string): string | null {
  const escaped = escapeIgnoreText(trimSlashes(repoRelativePath), false);
  return escaped === null ? null : `/${escaped}/`;
}

/** The extension after the last dot of the name; none for "Makefile" or ".env". */
export function extensionOf(repoRelativePath: string): string | null {
  const name = trimSlashes(repoRelativePath).split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) {
    return null;
  }
  return name.slice(dot + 1);
}

/** "*.ext": every file with that extension, anywhere. */
export function extensionPattern(repoRelativePath: string): string | null {
  const extension = extensionOf(repoRelativePath);
  const escaped = extension === null ? null : escapeIgnoreText(extension, false);
  return escaped === null ? null : `*.${escaped}`;
}

function parentOf(repoRelativePath: string): string {
  const trimmed = trimSlashes(repoRelativePath);
  const slash = trimmed.lastIndexOf("/");
  return slash > 0 ? trimmed.slice(0, slash) : "";
}

/**
 * What Add to .gitignore offers for a repo-relative path: a file gets itself, its folder
 * (unless at the root) and its extension; a folder gets itself.
 */
export function ignoreChoices(repoRelativePath: string, isDir: boolean): IgnoreChoice[] {
  const path = trimSlashes(repoRelativePath);
  if (path === "") {
    return [];
  }
  const choices: IgnoreChoice[] = [];
  const add = (kind: IgnoreKind, pattern: string | null, scopePath: string) => {
    if (pattern !== null) {
      choices.push({ kind, pattern, scopePath });
    }
  };
  if (isDir) {
    add("folder", folderPattern(path), path);
    return choices;
  }
  add("file", filePattern(path), path);
  const parent = parentOf(path);
  if (parent) {
    add("folder", folderPattern(parent), parent);
  }
  add("extension", extensionPattern(path), path);
  return choices;
}

export const KIND_HINTS: Record<IgnoreKind, string> = {
  file: "this file",
  folder: "this folder",
  extension: "this extension",
};
