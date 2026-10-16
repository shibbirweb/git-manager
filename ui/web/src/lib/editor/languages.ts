// Syntax highlighting for the library's editors by name, loaded on first use so only the grammars a screen shows
// end up in memory. The app passes its own language support through the editors' `extensions` instead.
import type { Extension } from "@codemirror/state";

export type CodeLanguage = "plain" | "ts" | "js" | "svelte" | "html" | "css" | "json" | "md" | "python" | "rust";

export async function languageSupport(language: CodeLanguage): Promise<Extension> {
  switch (language) {
    case "ts":
    case "js":
      return (await import("@codemirror/lang-javascript")).javascript({ typescript: language === "ts" });
    case "svelte":
    case "html":
      return (await import("@codemirror/lang-html")).html();
    case "css":
      return (await import("@codemirror/lang-css")).css();
    case "json":
      return (await import("@codemirror/lang-json")).json();
    case "md":
      return (await import("@codemirror/lang-markdown")).markdown();
    case "python":
      return (await import("@codemirror/lang-python")).python();
    case "rust":
      return (await import("@codemirror/lang-rust")).rust();
    default:
      return [];
  }
}
