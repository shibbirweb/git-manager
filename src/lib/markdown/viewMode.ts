// Which Markdown files show a preview, and the view mode each file last used in
// this session (not saved: a restart opens files with the Settings default).

import type { MarkdownViewMode } from "$lib/stores/settingsData";

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdx"]);

/** .md, .markdown and .mdx (shown as plain Markdown). */
export function isMarkdownPath(filePath: string): boolean {
  const name = filePath.slice(filePath.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 && MARKDOWN_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

const sessionModes = new Map<string, MarkdownViewMode>();

export function sessionViewMode(filePath: string, fallback: MarkdownViewMode): MarkdownViewMode {
  return sessionModes.get(filePath) ?? fallback;
}

export function rememberViewMode(filePath: string, mode: MarkdownViewMode): void {
  sessionModes.set(filePath, mode);
}
