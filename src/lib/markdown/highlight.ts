// Syntax highlighting for fenced code in the Markdown preview, with the editor's
// own Lezer grammars and the shared `tok-*` classes (colored by app.css in
// light and dark), so no second highlighting library is loaded.

import type { Language } from "@codemirror/language";
import { highlightCode } from "@lezer/highlight";
import { codeHighlighters } from "$lib/editor/highlighter";

type Parser = Language["parser"];

/** Longer blocks are shown as plain text: highlighting them would stall typing. */
export const MAX_HIGHLIGHT_CHARS = 100_000;

/** Fence names mapped to a file extension the editor knows a grammar for. */
const FENCE_EXTENSIONS: Record<string, string> = {
  js: "js",
  javascript: "js",
  mjs: "js",
  cjs: "js",
  node: "js",
  jsx: "jsx",
  ts: "ts",
  typescript: "ts",
  tsx: "tsx",
  rust: "rs",
  rs: "rs",
  php: "php",
  html: "html",
  htm: "html",
  xhtml: "html",
  vue: "html",
  svelte: "html",
  css: "css",
  scss: "css",
  less: "css",
  json: "json",
  jsonc: "json",
  json5: "json",
  md: "md",
  markdown: "md",
  py: "py",
  python: "py",
  yaml: "yaml",
  yml: "yaml",
  sql: "sql",
  mysql: "sql",
  postgresql: "sql",
  sqlite: "sql",
  go: "go",
  golang: "go",
  java: "java",
  kotlin: "kt",
  kt: "kt",
  swift: "swift",
  ruby: "rb",
  rb: "rb",
  sh: "sh",
  bash: "sh",
  zsh: "sh",
  shell: "sh",
  console: "sh",
  toml: "toml",
  xml: "xml",
  svg: "xml",
  dockerfile: "dockerfile",
  docker: "dockerfile",
  c: "c",
  h: "c",
  cpp: "cpp",
  "c++": "cpp",
  cs: "cs",
  csharp: "cs",
  "c#": "cs",
};

/** The editor file extension for a fence's language name, or null for plain text. */
export function fenceExtension(language: string): string | null {
  return FENCE_EXTENSIONS[language.toLowerCase()] ?? null;
}

const FENCE_OPEN = /^ {0,3}(?:`{3,}|~{3,})[ \t]*([\w#+.-]+)/gm;

/** Language names of the fenced blocks in a document, without repeats. */
export function fenceLanguages(source: string): string[] {
  return [...new Set([...source.matchAll(FENCE_OPEN)].map((match) => match[1].toLowerCase()))];
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Code as HTML with `tok-*` spans. */
export function highlightToHtml(code: string, parser: Parser): string {
  const parts: string[] = [];
  highlightCode(
    code,
    parser.parse(code),
    codeHighlighters,
    (text, classes) => {
      parts.push(classes ? `<span class="${classes}">${escapeHtml(text)}</span>` : escapeHtml(text));
    },
    () => {
      parts.push("\n");
    },
  );
  return parts.join("");
}

/**
 * Highlights fenced blocks for one preview. Grammars load on first use; until
 * then a block is plain and `onReady` asks for another render. Results are
 * cached so an unchanged block renders to the same HTML on every keystroke.
 */
export class CodeHighlighter {
  private parsers = new Map<string, Parser | null | "loading">();
  private cache = new Map<string, string>();
  private used = new Set<string>();
  private enabled = true;

  constructor(
    private readonly loadParser: (extension: string) => Promise<Parser | null>,
    private readonly onReady: () => void,
  ) {}

  /**
   * The Syntax highlighting setting. Off, every block is plain and the grammars and cached
   * HTML are let go; on, they load again on the next render. Returns whether it changed.
   */
  setEnabled(enabled: boolean): boolean {
    if (enabled === this.enabled) {
      return false;
    }
    this.enabled = enabled;
    this.parsers.clear();
    this.cache.clear();
    this.used.clear();
    return true;
  }

  /** Loads the grammars for `languages`, so a first render can highlight right away. */
  async preload(languages: string[]): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const extensions = new Set(languages.map(fenceExtension).filter((extension): extension is string => extension !== null));
    await Promise.all(
      [...extensions]
        .filter((extension) => !this.parsers.has(extension))
        .map(async (extension) => {
          this.parsers.set(extension, "loading");
          try {
            this.parsers.set(extension, (await this.loadParser(extension)) ?? null);
          } catch {
            this.parsers.set(extension, null);
          }
        }),
    );
  }

  highlight(code: string, language: string): string | null {
    const extension = fenceExtension(language);
    if (!this.enabled || !extension || code.length > MAX_HIGHLIGHT_CHARS) {
      return null;
    }
    const key = `${extension}\u0000${code}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      this.used.add(key);
      return cached;
    }
    const parser = this.parsers.get(extension);
    if (parser === undefined) {
      this.parsers.set(extension, "loading");
      this.loadParser(extension)
        .then((loaded) => {
          if (!this.enabled) {
            return;
          }
          this.parsers.set(extension, loaded ?? null);
          if (loaded) {
            this.onReady();
          }
        })
        .catch(() => {
          this.parsers.set(extension, null);
        });
      return null;
    }
    if (parser === null || parser === "loading") {
      return null;
    }
    const html = highlightToHtml(code, parser);
    this.cache.set(key, html);
    this.used.add(key);
    return html;
  }

  /** Called after each render: forgets blocks that are no longer in the document. */
  sweep(): void {
    for (const key of this.cache.keys()) {
      if (!this.used.has(key)) {
        this.cache.delete(key);
      }
    }
    this.used.clear();
  }
}
