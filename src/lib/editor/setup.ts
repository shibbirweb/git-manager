// Shared CodeMirror configuration. Languages are loaded on demand so only the
// grammars actually used end up in memory.

import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { classHighlighter } from "@lezer/highlight";
import { settings } from "$lib/stores/settings.svelte";

export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "var(--code-size)",
    backgroundColor: "var(--editor-bg)",
    color: "var(--text)",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.55",
  },
  ".cm-content": {
    caretColor: "var(--text)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--text)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--editor-gutter)",
    color: "var(--editor-line-number)",
    border: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 10px 0 12px",
    minWidth: "40px",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--editor-active-line)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--editor-active-line)",
    color: "var(--text-dim)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--editor-selection)",
  },
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in srgb, var(--warning) 30%, transparent)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "color-mix(in srgb, var(--accent) 18%, transparent)",
  },
  ".cm-panels": {
    backgroundColor: "var(--panel)",
    color: "var(--text)",
    borderColor: "var(--border-strong)",
  },
  ".cm-panels input, .cm-panels button": {
    fontFamily: "var(--font-ui)",
  },
});

export interface EditorOptions {
  readOnly?: boolean;
  /** Extra extensions appended after the defaults. */
  extensions?: Extension[];
}

export function baseExtensions({ readOnly = false, extensions = [] }: EditorOptions = {}): Extension[] {
  const common: Extension[] = [
    lineNumbers(),
    highlightSpecialChars(),
    drawSelection(),
    syntaxHighlighting(classHighlighter),
    bracketMatching(),
    highlightSelectionMatches(),
    editorTheme,
    // Read when the editor is created; open editors keep their values.
    EditorState.tabSize.of(settings.tabSize),
    indentUnit.of(" ".repeat(settings.tabSize)),
    keymap.of([...searchKeymap, ...defaultKeymap]),
  ];
  if (readOnly) {
    return [...common, EditorState.readOnly.of(true), ...extensions];
  }
  return [
    ...common,
    history(),
    indentOnInput(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    keymap.of([...historyKeymap, indentWithTab]),
    ...extensions,
  ];
}

function extensionOf(path: string): string {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : name.toLowerCase();
}

const LANGUAGE_NAMES: Record<string, string> = {
  js: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  jsx: "JavaScript JSX",
  ts: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",
  tsx: "TypeScript JSX",
  rs: "Rust",
  php: "PHP",
  html: "HTML",
  htm: "HTML",
  vue: "Vue",
  svelte: "Svelte",
  blade: "Blade",
  css: "CSS",
  scss: "SCSS",
  less: "Less",
  json: "JSON",
  jsonc: "JSON with Comments",
  lock: "JSON",
  md: "Markdown",
  markdown: "Markdown",
  py: "Python",
  yml: "YAML",
  yaml: "YAML",
  sql: "SQL",
  go: "Go",
  java: "Java",
  kt: "Kotlin",
  swift: "Swift",
  rb: "Ruby",
  sh: "Shell Script",
  bash: "Shell Script",
  zsh: "Shell Script",
  bat: "Batch",
  toml: "TOML",
  xml: "XML",
  txt: "Plain Text",
};

/** Display name of a file's language, like VS Code's status bar. */
export function languageName(path: string): string {
  const name = path.split("/").pop() ?? path;
  if (!name.includes(".")) {
    return name.toLowerCase() === "dockerfile" ? "Dockerfile" : "Plain Text";
  }
  return LANGUAGE_NAMES[extensionOf(path)] ?? "Plain Text";
}

/** Resolves the language support for a file path, or an empty extension. */
export async function languageFor(path: string): Promise<Extension> {
  const ext = extensionOf(path);
  try {
    switch (ext) {
      case "js":
      case "mjs":
      case "cjs":
      case "jsx":
        return (await import("@codemirror/lang-javascript")).javascript({ jsx: true });
      case "ts":
      case "mts":
      case "cts":
        return (await import("@codemirror/lang-javascript")).javascript({ typescript: true });
      case "tsx":
        return (await import("@codemirror/lang-javascript")).javascript({ typescript: true, jsx: true });
      case "rs":
        return (await import("@codemirror/lang-rust")).rust();
      case "php":
        return (await import("@codemirror/lang-php")).php();
      case "html":
      case "htm":
      case "vue":
      case "svelte":
      case "blade":
        return (await import("@codemirror/lang-html")).html();
      case "css":
      case "scss":
      case "less":
        return (await import("@codemirror/lang-css")).css();
      case "json":
      case "jsonc":
      case "lock":
        return (await import("@codemirror/lang-json")).json();
      case "md":
      case "markdown":
        return (await import("@codemirror/lang-markdown")).markdown();
      case "py":
        return (await import("@codemirror/lang-python")).python();
      case "yml":
      case "yaml":
        return (await import("@codemirror/lang-yaml")).yaml();
      case "sql":
        return (await import("@codemirror/lang-sql")).sql();
      default:
        return [];
    }
  } catch {
    return [];
  }
}
