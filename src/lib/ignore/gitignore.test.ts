import { describe, expect, it } from "vitest";
import {
  escapeIgnoreText,
  extensionOf,
  extensionPattern,
  filePattern,
  folderPattern,
  ignoreChoices,
} from "./gitignore";

describe("escapeIgnoreText", () => {
  it("keeps plain paths, spaces inside and unicode", () => {
    expect(escapeIgnoreText("src/my file.txt")).toBe("src/my file.txt");
    expect(escapeIgnoreText("docs/résumé.md")).toBe("docs/résumé.md");
  });

  it("escapes glob characters and backslashes", () => {
    expect(escapeIgnoreText("a*b?c[d].txt")).toBe("a\\*b\\?c\\[d].txt");
    expect(escapeIgnoreText("back\\slash")).toBe("back\\\\slash");
  });

  it("escapes a leading # or ! and trailing spaces", () => {
    expect(escapeIgnoreText("#notes")).toBe("\\#notes");
    expect(escapeIgnoreText("!important")).toBe("\\!important");
    expect(escapeIgnoreText("name  ")).toBe("name\\ \\ ");
    expect(escapeIgnoreText(" leading")).toBe(" leading");
  });

  it("refuses names a line cannot hold", () => {
    expect(escapeIgnoreText("two\nlines")).toBeNull();
    expect(escapeIgnoreText("cr\r")).toBeNull();
    expect(escapeIgnoreText("")).toBeNull();
  });
});

describe("patterns", () => {
  it("anchors files and folders at the root", () => {
    expect(filePattern("build/out.log")).toBe("/build/out.log");
    expect(filePattern("/#tmp")).toBe("/#tmp");
    expect(folderPattern("node_modules/")).toBe("/node_modules/");
    expect(folderPattern("my dir ")).toBe("/my dir\\ /");
  });

  it("finds extensions, not dotfiles", () => {
    expect(extensionOf("a/b/c.tar.gz")).toBe("gz");
    expect(extensionOf(".env")).toBeNull();
    expect(extensionOf("Makefile")).toBeNull();
    expect(extensionOf("trailing.")).toBeNull();
    expect(extensionPattern("logs/app.log")).toBe("*.log");
    expect(extensionPattern("weird.[x]")).toBe("*.\\[x]");
  });

  it("offers the file, its folder and its extension; a folder only itself", () => {
    expect(ignoreChoices("src/app.log", false)).toEqual([
      { kind: "file", pattern: "/src/app.log", scopePath: "src/app.log" },
      { kind: "folder", pattern: "/src/", scopePath: "src" },
      { kind: "extension", pattern: "*.log", scopePath: "src/app.log" },
    ]);
    expect(ignoreChoices("README", false)).toEqual([{ kind: "file", pattern: "/README", scopePath: "README" }]);
    expect(ignoreChoices("dist", true)).toEqual([{ kind: "folder", pattern: "/dist/", scopePath: "dist" }]);
    expect(ignoreChoices("", true)).toEqual([]);
    expect(ignoreChoices("bad\nname.txt", false)).toEqual([{ kind: "extension", pattern: "*.txt", scopePath: "bad\nname.txt" }]);
  });
});
