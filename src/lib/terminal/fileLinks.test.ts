import { describe, expect, it, vi } from "vitest";
import {
  FileExistenceCache,
  fileLinksForLine,
  findPathCandidates,
  lineCells,
  MAX_CANDIDATES_PER_LINE,
  MAX_LINK_LINE,
  parseOsc7,
  resolveTerminalPath,
} from "./fileLinks";

function texts(lineText: string): string[] {
  return findPathCandidates(lineText).map((candidate) => candidate.text);
}

describe("findPathCandidates", () => {
  it("finds paths with a line and a column in the usual forms", () => {
    const [colon] = findPathCandidates("src/cart.ts:12:5 - error TS2322");
    expect(colon).toMatchObject({ start: 0, end: 16, text: "src/cart.ts:12:5", paths: ["src/cart.ts"], line: 12, column: 5 });
    const [line] = findPathCandidates("  at ./lib/a.js:7");
    expect(line).toMatchObject({ start: 5, text: "./lib/a.js:7", paths: ["./lib/a.js"], line: 7, column: null });
    const [paren] = findPathCandidates("src/cart.ts(12,5): error");
    expect(paren).toMatchObject({ text: "src/cart.ts(12,5)", paths: ["src/cart.ts"], line: 12, column: 5 });
    const [parenLine] = findPathCandidates("main.rs(3)");
    expect(parenLine).toMatchObject({ paths: ["main.rs"], line: 3, column: null });
  });

  it("finds bare file names with an extension and paths with a folder", () => {
    expect(texts("modified:   README.md")).toEqual(["README.md"]);
    expect(texts("see /Users/me/shop/package.json.")).toEqual(["/Users/me/shop/package.json"]);
    expect(texts("src/Makefile and docs/")).toEqual(["src/Makefile"]);
  });

  it("skips URLs, flags, plain words and home paths", () => {
    expect(texts("https://github.com/acme/shop/blob/main/a.ts")).toEqual([]);
    expect(texts("--config value hello world 42")).toEqual([]);
    expect(texts("~/notes.txt ..")).toEqual([]);
  });

  it("offers git's a/ and b/ paths without the prefix too", () => {
    const [candidate] = findPathCandidates("--- a/src/cart.ts");
    expect(candidate.paths).toEqual(["a/src/cart.ts", "src/cart.ts"]);
  });

  it("splits on quotes and brackets and drops trailing punctuation", () => {
    expect(texts(`"src/a.ts", 'b.ts'; [c/d.ts]`)).toEqual(["src/a.ts", "b.ts", "c/d.ts"]);
    expect(texts("src/a.ts:12:")).toEqual(["src/a.ts:12"]);
    expect(texts("--file=src/a.ts")).toEqual(["src/a.ts"]);
  });

  it("limits long lines and many candidates", () => {
    expect(findPathCandidates(`a/b.ts ${"x".repeat(MAX_LINK_LINE)}`)).toEqual([]);
    const many = Array.from({ length: MAX_CANDIDATES_PER_LINE + 5 }, (_, index) => `f${index}.ts`).join(" ");
    expect(findPathCandidates(many)).toHaveLength(MAX_CANDIDATES_PER_LINE);
    expect(findPathCandidates("")).toEqual([]);
  });
});

describe("resolveTerminalPath", () => {
  it("resolves against the terminal's folder", () => {
    expect(resolveTerminalPath("src/a.ts", "/work/shop")).toBe("/work/shop/src/a.ts");
    expect(resolveTerminalPath("./src/../lib/b.ts", "/work/shop")).toBe("/work/shop/lib/b.ts");
    expect(resolveTerminalPath("/etc//hosts", null)).toBe("/etc/hosts");
    expect(resolveTerminalPath("src/a.ts", null)).toBeNull();
    expect(resolveTerminalPath("src/a.ts", "relative")).toBeNull();
  });

  it("resolves against a Windows folder", () => {
    expect(resolveTerminalPath("src/a.ts", "C:/work/shop")).toBe("C:/work/shop/src/a.ts");
    expect(resolveTerminalPath("../../../a.ts", "C:/work")).toBe("C:/a.ts");
    expect(resolveTerminalPath("D:/logs//x.log", null)).toBe("D:/logs/x.log");
  });
});

describe("parseOsc7", () => {
  it("reads the folder of a file URL", () => {
    expect(parseOsc7("file://mac.local/Users/me/My%20Shop")).toBe("/Users/me/My Shop");
    expect(parseOsc7("file:///tmp")).toBe("/tmp");
    expect(parseOsc7("file://pc/C:/Users/me/My%20Shop")).toBe("C:/Users/me/My Shop");
  });

  it("ignores anything else", () => {
    expect(parseOsc7("http://x/y")).toBeNull();
    expect(parseOsc7("file://host")).toBeNull();
    expect(parseOsc7("file://host/%E0%A4%A")).toBeNull();
    expect(parseOsc7("")).toBeNull();
  });
});

describe("lineCells", () => {
  it("maps string offsets to cells, skipping the second half of wide characters", () => {
    const { text, cellAt } = lineCells([
      { chars: "界", width: 2 },
      { chars: "", width: 0 },
      { chars: "a", width: 1 },
      { chars: "", width: 1 },
      { chars: "b", width: 1 },
      { chars: "", width: 1 },
      { chars: "", width: 1 },
    ]);
    expect(text).toBe("界a b");
    expect(cellAt).toEqual([0, 2, 3, 4]);
  });
});

describe("FileExistenceCache", () => {
  it("asks once per path and remembers until cleared", async () => {
    const check = vi.fn(async (filePaths: string[]) => filePaths.map((filePath) => (filePath.endsWith(".ts") ? filePath : null)));
    const cache = new FileExistenceCache(check);
    const first = await cache.realPaths(["/w/a.ts", "/w/b.md", "/w/a.ts"]);
    expect([...first]).toEqual([
      ["/w/a.ts", "/w/a.ts"],
      ["/w/b.md", null],
    ]);
    await cache.realPaths(["/w/a.ts"]);
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith(["/w/a.ts", "/w/b.md"]);
    cache.clear();
    await cache.realPaths(["/w/a.ts"]);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("shares a lookup that is still on its way", async () => {
    let finish: (answers: (string | null)[]) => void = () => undefined;
    const check = vi.fn(() => new Promise<(string | null)[]>((resolve) => (finish = resolve)));
    const cache = new FileExistenceCache(check);
    const one = cache.realPaths(["/w/a.ts"]);
    const two = cache.realPaths(["/w/a.ts"]);
    finish(["/w/a.ts"]);
    expect((await one).get("/w/a.ts")).toBe("/w/a.ts");
    expect((await two).get("/w/a.ts")).toBe("/w/a.ts");
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("treats a failed lookup as missing and stays small", async () => {
    const cache = new FileExistenceCache(async () => {
      throw new Error("offline");
    }, 2);
    expect((await cache.realPaths(["/w/a.ts"])).get("/w/a.ts")).toBe(null);
    await cache.realPaths(["/w/b.ts", "/w/c.ts"]);
    expect(cache.size).toBeLessThanOrEqual(2);
  });
});

describe("fileLinksForLine", () => {
  const workspaceFolders = [{ root: "/work/shop", name: "shop" }];

  it("links existing workspace files only", async () => {
    const existing = new Set(["/work/shop/src/cart.ts", "/work/shop/README.md"]);
    const check = vi.fn(async (filePaths: string[]) => filePaths.map((filePath) => (existing.has(filePath) ? filePath : null)));
    const cache = new FileExistenceCache(check);
    const links = await fileLinksForLine("src/cart.ts:3:9 missing.ts /etc/hosts README.md", {
      folderPath: "/work/shop",
      workspaceFolders,
      cache,
    });
    expect(links).toEqual([
      { start: 0, end: 15, text: "src/cart.ts:3:9", filePath: "/work/shop/src/cart.ts", line: 3, column: 9 },
      { start: 38, end: 47, text: "README.md", filePath: "/work/shop/README.md", line: null, column: null },
    ]);
    // /etc/hosts is outside the workspace, so it is never asked about.
    expect(check.mock.calls.flat(2)).not.toContain("/etc/hosts");
  });

  it("opens a file under its real name, whatever case the tool printed", async () => {
    const cache = new FileExistenceCache(async (filePaths) =>
      filePaths.map((filePath) => (filePath.toLowerCase() === "/work/shop/src/cart.ts" ? "/work/shop/src/Cart.ts" : null)),
    );
    const links = await fileLinksForLine("src/CART.ts:4", { folderPath: "/work/shop", workspaceFolders, cache });
    expect(links.map((link) => link.filePath)).toEqual(["/work/shop/src/Cart.ts"]);
  });

  it("falls back to the path without git's prefix", async () => {
    const cache = new FileExistenceCache(async (filePaths) => filePaths.map((filePath) => (filePath === "/work/shop/src/cart.ts" ? filePath : null)));
    const links = await fileLinksForLine("+++ b/src/cart.ts", { folderPath: "/work/shop", workspaceFolders, cache });
    expect(links.map((link) => link.filePath)).toEqual(["/work/shop/src/cart.ts"]);
  });

  it("asks nothing without a workspace", async () => {
    const check = vi.fn(async (filePaths: string[]) => filePaths.map((filePath) => filePath));
    const links = await fileLinksForLine("src/a.ts", { folderPath: "/work/shop", workspaceFolders: [], cache: new FileExistenceCache(check) });
    expect(links).toEqual([]);
    expect(check).not.toHaveBeenCalled();
  });
});

describe("Windows paths in the terminal", () => {
  it("reads printed backslash paths as / paths", () => {
    const [absolute] = findPathCandidates("error in C:\\work\\shop\\src\\cart.ts:12:5", true);
    expect(absolute).toMatchObject({ text: "C:\\work\\shop\\src\\cart.ts:12:5", paths: ["C:/work/shop/src/cart.ts"], line: 12, column: 5 });
    const [relative] = findPathCandidates("src\\cart.ts(3,9)", true);
    expect(relative).toMatchObject({ paths: ["src/cart.ts"], line: 3, column: 9 });
    const [noExtension] = findPathCandidates("c:\\work\\shop\\Makefile", true);
    expect(noExtension?.paths).toEqual(["C:/work/shop/Makefile"]);
  });

  it("keeps backslashes elsewhere, where they are file name characters", () => {
    expect(findPathCandidates("odd\\name.ts", false)[0]?.paths).toEqual(["odd\\name.ts"]);
  });

  it("links a Windows path printed in other case to the workspace file", async () => {
    const windowsFolders = [{ root: "C:/Work/Shop", name: "shop" }];
    const cache = new FileExistenceCache(async (filePaths) =>
      filePaths.map((filePath) => (filePath.toLowerCase() === "c:/work/shop/src/cart.ts" ? "C:/Work/Shop/src/cart.ts" : null)),
    );
    const links = await fileLinksForLine("c:\\work\\shop\\src\\cart.ts:2", { folderPath: "C:/Work/Shop", workspaceFolders: windowsFolders, cache }, true);
    expect(links.map((link) => link.filePath)).toEqual(["C:/Work/Shop/src/cart.ts"]);
  });
});
