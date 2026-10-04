import { toggleComment } from "@codemirror/commands";
import { language, syntaxTree } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { afterEach, describe, expect, it } from "vitest";
import { commentTokensFor, setSyntaxHighlighting, syntaxHighlightingEnabled } from "./languages";
import { editorLanguage, grammarFor, languageFor, languageName } from "./setup";

describe("languageName", () => {
  it("names common languages by extension", () => {
    expect(languageName("/work/src/app.ts")).toBe("TypeScript");
    expect(languageName("/work/src/main.rs")).toBe("Rust");
    expect(languageName("/work/README.MD")).toBe("Markdown");
  });

  it("names the languages added with their grammars", () => {
    expect(languageName("/work/main.go")).toBe("Go");
    expect(languageName("/work/App.java")).toBe("Java");
    expect(languageName("/work/build.gradle.kts")).toBe("Kotlin");
    expect(languageName("/work/main.cpp")).toBe("C++");
    expect(languageName("/work/util.h")).toBe("C");
    expect(languageName("/work/Program.cs")).toBe("C#");
    expect(languageName("/home/me/.zshrc")).toBe("Shell Script");
    expect(languageName("/work/Gemfile")).toBe("Ruby");
  });

  it("falls back to plain text", () => {
    expect(languageName("/work/LICENSE")).toBe("Plain Text");
    expect(languageName("/work/data.xyz")).toBe("Plain Text");
    expect(languageName("/work/Dockerfile")).toBe("Dockerfile");
    expect(languageName("/work/Dockerfile.dev")).toBe("Dockerfile");
    // A file named like an extension, or like an Object key, is still plain text.
    expect(languageName("/work/go")).toBe("Plain Text");
    expect(languageName("/work/a.constructor")).toBe("Plain Text");
  });
});

describe("grammarFor", () => {
  it("gives every named language a grammar, except Batch and plain text", () => {
    const cases: [string, string | null][] = [
      ["a.js", "javascript"],
      ["a.jsx", "javascript"],
      ["a.ts", "typescript"],
      ["a.tsx", "tsx"],
      ["a.vue", "html"],
      ["a.scss", "css"],
      ["bun.lock", "json"],
      ["a.go", "go"],
      ["A.java", "java"],
      ["a.kt", "kotlin"],
      ["a.swift", "swift"],
      ["a.rb", "ruby"],
      ["Rakefile", "ruby"],
      ["a.sh", "shell"],
      ["a.bash", "shell"],
      ["a.zsh", "shell"],
      ["Cargo.toml", "toml"],
      ["pom.xml", "xml"],
      ["icon.svg", "xml"],
      ["Dockerfile", "dockerfile"],
      ["Containerfile", "dockerfile"],
      ["a.c", "cpp"],
      ["a.hpp", "cpp"],
      ["a.cs", "csharp"],
      ["a.bat", null],
      ["notes.txt", null],
      ["LICENSE", null],
    ];
    for (const [filePath, grammar] of cases) {
      expect(grammarFor(`/work/${filePath}`), filePath).toBe(grammar);
    }
  });

  it("loads a grammar on demand and plain text as nothing", async () => {
    const go = await languageFor("/work/main.go");
    expect(Array.isArray(go)).toBe(false);
    const toml = await languageFor("/work/Cargo.toml");
    expect(Array.isArray(toml)).toBe(false);
    expect(await languageFor("/work/LICENSE")).toEqual([]);
  });
});

describe("syntax highlighting setting", () => {
  afterEach(() => {
    setSyntaxHighlighting(true);
  });

  function stateFor(doc: string, extension: Extension): EditorState {
    return EditorState.create({ doc, extensions: extension });
  }

  function toggled(state: EditorState): string {
    let result = state.doc.toString();
    toggleComment({ state, dispatch: (transaction) => (result = transaction.state.doc.toString()) });
    return result;
  }

  it("gives editors the grammar while it is on", async () => {
    expect(syntaxHighlightingEnabled()).toBe(true);
    const state = stateFor("const a = 1;", await editorLanguage("/work/app.ts"));
    expect(state.facet(language)?.name).toBe("typescript");
  });

  it("gives editors only the comment style while it is off", async () => {
    setSyntaxHighlighting(false);
    expect(syntaxHighlightingEnabled()).toBe(false);
    const ts = stateFor("const a = 1;", await editorLanguage("/work/app.ts"));
    expect(ts.facet(language)).toBeNull();
    expect(syntaxTree(ts).length).toBe(0);
    expect(toggled(ts)).toBe("// const a = 1;");
    expect(toggled(stateFor("x = 1", await editorLanguage("/work/a.py")))).toBe("# x = 1");
    expect(toggled(stateFor("<p>", await editorLanguage("/work/a.html")))).toBe("<!-- <p> -->");
    // No comment style: nothing changes.
    expect(toggled(stateFor("{}", await editorLanguage("/work/a.json")))).toBe("{}");
    expect(toggled(stateFor("text", await editorLanguage("/work/LICENSE")))).toBe("text");
  });

  it("knows a comment style for every grammar but JSON", () => {
    expect(commentTokensFor("/work/a.rs")).toEqual({ line: "//", block: { open: "/*", close: "*/" } });
    expect(commentTokensFor("/work/a.sql")?.line).toBe("--");
    expect(commentTokensFor("/work/a.css")).toEqual({ block: { open: "/*", close: "*/" } });
    expect(commentTokensFor("/work/Dockerfile")?.line).toBe("#");
    expect(commentTokensFor("/work/a.json")).toBeNull();
    expect(commentTokensFor("/work/notes.txt")).toBeNull();
  });
});
