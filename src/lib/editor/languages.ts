// File languages: the name the status bar shows and the grammar that colors the code. Every
// grammar is a dynamic import, so only the languages of the files actually opened are loaded.
// Languages without an official CodeMirror package use a legacy mode, loaded the same way.
// With the Syntax highlighting setting off, editors get no grammar at all: no parser runs and
// no syntax tree is kept, only the comment style, so Toggle Comment still works.

import { LanguageSupport, StreamLanguage, type StreamParser } from "@codemirror/language";
import { Compartment, EditorState, type Extension, Facet } from "@codemirror/state";
import { type EditorView, ViewPlugin } from "@codemirror/view";

/** The grammars `languageFor` can load. */
export type Grammar =
  | "javascript"
  | "typescript"
  | "tsx"
  | "rust"
  | "php"
  | "html"
  | "css"
  | "json"
  | "markdown"
  | "python"
  | "yaml"
  | "sql"
  | "go"
  | "java"
  | "kotlin"
  | "swift"
  | "ruby"
  | "shell"
  | "toml"
  | "xml"
  | "dockerfile"
  | "cpp"
  | "csharp";

interface CommentTokens {
  line?: string;
  block?: { open: string; close: string };
}

const C_COMMENTS: CommentTokens = { line: "//", block: { open: "/*", close: "*/" } };
const HASH_COMMENTS: CommentTokens = { line: "#" };
const MARKUP_COMMENTS: CommentTokens = { block: { open: "<!--", close: "-->" } };

/** The comment style of each grammar, used while syntax highlighting is off. */
const COMMENT_TOKENS: Record<Grammar, CommentTokens | null> = {
  javascript: C_COMMENTS,
  typescript: C_COMMENTS,
  tsx: C_COMMENTS,
  rust: C_COMMENTS,
  php: C_COMMENTS,
  html: MARKUP_COMMENTS,
  css: { block: { open: "/*", close: "*/" } },
  json: null,
  markdown: MARKUP_COMMENTS,
  python: HASH_COMMENTS,
  yaml: HASH_COMMENTS,
  sql: { line: "--", block: { open: "/*", close: "*/" } },
  go: C_COMMENTS,
  java: C_COMMENTS,
  kotlin: C_COMMENTS,
  swift: C_COMMENTS,
  ruby: HASH_COMMENTS,
  shell: HASH_COMMENTS,
  toml: HASH_COMMENTS,
  xml: MARKUP_COMMENTS,
  dockerfile: HASH_COMMENTS,
  cpp: C_COMMENTS,
  csharp: C_COMMENTS,
};

/** Whole file names that decide the language, lowercased. */
const FILE_NAMES: Record<string, string> = {
  dockerfile: "dockerfile",
  containerfile: "dockerfile",
  gemfile: "rb",
  rakefile: "rb",
  podfile: "rb",
  vagrantfile: "rb",
};

/** Display names by extension (or by the key FILE_NAMES gives a file). */
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
  kts: "Kotlin",
  swift: "Swift",
  rb: "Ruby",
  rake: "Ruby",
  gemspec: "Ruby",
  sh: "Shell Script",
  bash: "Shell Script",
  zsh: "Shell Script",
  bashrc: "Shell Script",
  zshrc: "Shell Script",
  bash_profile: "Shell Script",
  zprofile: "Shell Script",
  zshenv: "Shell Script",
  profile: "Shell Script",
  bat: "Batch",
  toml: "TOML",
  xml: "XML",
  xsd: "XML",
  xsl: "XML",
  xslt: "XML",
  plist: "XML",
  svg: "SVG",
  dockerfile: "Dockerfile",
  c: "C",
  h: "C",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  hpp: "C++",
  hh: "C++",
  hxx: "C++",
  cs: "C#",
  txt: "Plain Text",
};

/** The grammar of each key; keys without one (Batch, Plain Text) stay plain. */
const GRAMMARS: Record<string, Grammar> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  rs: "rust",
  php: "php",
  html: "html",
  htm: "html",
  vue: "html",
  svelte: "html",
  blade: "html",
  css: "css",
  scss: "css",
  less: "css",
  json: "json",
  jsonc: "json",
  lock: "json",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  rb: "ruby",
  rake: "ruby",
  gemspec: "ruby",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  bashrc: "shell",
  zshrc: "shell",
  bash_profile: "shell",
  zprofile: "shell",
  zshenv: "shell",
  profile: "shell",
  toml: "toml",
  xml: "xml",
  xsd: "xml",
  xsl: "xml",
  xslt: "xml",
  plist: "xml",
  svg: "xml",
  dockerfile: "dockerfile",
  c: "cpp",
  h: "cpp",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  hxx: "cpp",
  cs: "csharp",
};

/** The key a file is looked up by: its special name, else its extension; null for neither. */
function languageKey(filePath: string): string | null {
  const name = (filePath.split("/").pop() ?? filePath).toLowerCase();
  if (Object.hasOwn(FILE_NAMES, name)) {
    return FILE_NAMES[name];
  }
  // Dockerfile.dev, Dockerfile.prod and similar.
  if (name.startsWith("dockerfile.")) {
    return "dockerfile";
  }
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1) : null;
}

/** Display name of a file's language, for the status bar. */
export function languageName(filePath: string): string {
  const key = languageKey(filePath);
  return key !== null && Object.hasOwn(LANGUAGE_NAMES, key) ? LANGUAGE_NAMES[key] : "Plain Text";
}

/** The grammar that colors a file, or null for plain text. */
export function grammarFor(filePath: string): Grammar | null {
  const key = languageKey(filePath);
  return key !== null && Object.hasOwn(GRAMMARS, key) ? GRAMMARS[key] : null;
}

/** A legacy CodeMirror 5 mode wrapped as language support, so Markdown previews can use its parser too. */
async function legacy(load: () => Promise<StreamParser<unknown>>): Promise<Extension> {
  return new LanguageSupport(StreamLanguage.define(await load()));
}

async function loadGrammar(grammar: Grammar): Promise<Extension> {
  switch (grammar) {
    case "javascript":
      return (await import("@codemirror/lang-javascript")).javascript({ jsx: true });
    case "typescript":
      return (await import("@codemirror/lang-javascript")).javascript({ typescript: true });
    case "tsx":
      return (await import("@codemirror/lang-javascript")).javascript({ typescript: true, jsx: true });
    case "rust":
      return (await import("@codemirror/lang-rust")).rust();
    case "php":
      return (await import("@codemirror/lang-php")).php();
    case "html":
      return (await import("@codemirror/lang-html")).html();
    case "css":
      return (await import("@codemirror/lang-css")).css();
    case "json":
      return (await import("@codemirror/lang-json")).json();
    case "markdown":
      return (await import("@codemirror/lang-markdown")).markdown();
    case "python":
      return (await import("@codemirror/lang-python")).python();
    case "yaml":
      return (await import("@codemirror/lang-yaml")).yaml();
    case "sql":
      return (await import("@codemirror/lang-sql")).sql();
    case "go":
      return (await import("@codemirror/lang-go")).go();
    case "java":
      return (await import("@codemirror/lang-java")).java();
    case "xml":
      return (await import("@codemirror/lang-xml")).xml();
    case "cpp":
      return (await import("@codemirror/lang-cpp")).cpp();
    case "kotlin":
      return legacy(async () => (await import("@codemirror/legacy-modes/mode/clike")).kotlin);
    case "csharp":
      return legacy(async () => (await import("@codemirror/legacy-modes/mode/clike")).csharp);
    case "swift":
      return legacy(async () => (await import("@codemirror/legacy-modes/mode/swift")).swift);
    case "ruby":
      return legacy(async () => (await import("@codemirror/legacy-modes/mode/ruby")).ruby);
    case "shell":
      return legacy(async () => (await import("@codemirror/legacy-modes/mode/shell")).shell);
    case "toml":
      return legacy(async () => (await import("@codemirror/legacy-modes/mode/toml")).toml);
    case "dockerfile":
      return legacy(async () => (await import("@codemirror/legacy-modes/mode/dockerfile")).dockerFile);
  }
}

/** Resolves the language support for a file path, or an empty extension. */
export async function languageFor(filePath: string): Promise<Extension> {
  const grammar = grammarFor(filePath);
  if (!grammar) {
    return [];
  }
  try {
    return await loadGrammar(grammar);
  } catch {
    return [];
  }
}

/** The comment style of a file, or null when its language has none or is unknown. */
export function commentTokensFor(filePath: string): CommentTokens | null {
  const grammar = grammarFor(filePath);
  return grammar ? COMMENT_TOKENS[grammar] : null;
}

/** A file's comment style as language data, without a parser. */
function plainLanguage(filePath: string): Extension {
  const commentTokens = commentTokensFor(filePath);
  return commentTokens ? EditorState.languageData.of(() => [{ commentTokens }]) : [];
}

let highlighting = true;
const languageCompartment = new Compartment();
const languageViews = new Set<EditorView>();

/** The file an editor shows and whether its compartment holds the grammar. */
const languageInfo = Facet.define<{ filePath: string; highlighted: boolean }, { filePath: string; highlighted: boolean } | null>({
  combine: (values) => values[0] ?? null,
});

async function languageContent(filePath: string, highlighted: boolean): Promise<Extension> {
  return [languageInfo.of({ filePath, highlighted }), highlighted ? await languageFor(filePath) : plainLanguage(filePath)];
}

/** Gives one editor the language the setting asks for, unless it already has it. */
async function applyLanguage(view: EditorView): Promise<void> {
  const info = view.state.facet(languageInfo);
  const wanted = highlighting;
  if (!info || info.highlighted === wanted) {
    return;
  }
  const content = await languageContent(info.filePath, wanted);
  // The setting changed again or the editor closed while the grammar loaded.
  if (wanted !== highlighting || !languageViews.has(view)) {
    return;
  }
  view.dispatch({ effects: languageCompartment.reconfigure(content) });
}

/** Remembers each editor so a changed setting reaches the ones already open. */
const languageRegistry = ViewPlugin.define((view) => {
  languageViews.add(view);
  // An editor built while the setting changed catches up; never dispatch from its constructor.
  if (view.state.facet(languageInfo)?.highlighted !== highlighting) {
    queueMicrotask(() => void applyLanguage(view));
  }
  return {
    destroy() {
      languageViews.delete(view);
    },
  };
});

/**
 * The language of an editor showing `filePath`: its grammar while syntax highlighting is on,
 * only its comment style while it is off. `setSyntaxHighlighting` switches open editors.
 */
export async function editorLanguage(filePath: string): Promise<Extension> {
  return [languageRegistry, languageCompartment.of(await languageContent(filePath, highlighting))];
}

/** Whether new editors and previews get a grammar. */
export function syntaxHighlightingEnabled(): boolean {
  return highlighting;
}

/** Applies a changed Syntax highlighting setting to every open editor. */
export function setSyntaxHighlighting(enabled: boolean): void {
  if (enabled === highlighting) {
    return;
  }
  highlighting = enabled;
  for (const view of [...languageViews]) {
    void applyLanguage(view);
  }
}
