// File languages: the name the status bar shows and the grammar that colors the code. Every
// grammar is a dynamic import, so only the languages of the files actually opened are loaded.
// Languages without an official CodeMirror package use a legacy mode, loaded the same way.

import { LanguageSupport, StreamLanguage, type StreamParser } from "@codemirror/language";
import type { Extension } from "@codemirror/state";

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
  // Dockerfile.dev, Dockerfile.prod and similar, like JetBrains.
  if (name.startsWith("dockerfile.")) {
    return "dockerfile";
  }
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1) : null;
}

/** Display name of a file's language, like VS Code's status bar. */
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
