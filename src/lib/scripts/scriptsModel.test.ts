import { describe, expect, it } from "vitest";
import type { ScriptSource } from "$lib/types";
import { relativeFolder, scriptArgs, scriptCommand, scriptRows, shellQuote, sourceLabel, terminalName } from "./scriptsModel";

function source(changes: Partial<ScriptSource> = {}): ScriptSource {
  return {
    kind: "npm",
    filePath: "/work/app/package.json",
    folderPath: "/work/app",
    workspaceFolder: "/work/app",
    runner: "pnpm",
    packageName: "shop",
    scripts: [
      { name: "dev", command: "vite", line: 5 },
      { name: "build", command: "vite build", line: 6 },
      { name: "test:unit", command: "vitest run", line: 7 },
    ],
    error: null,
    nodeVersion: null,
    ...changes,
  };
}

describe("shellQuote", () => {
  it("leaves plain names alone and quotes the rest", () => {
    expect(shellQuote("test:unit")).toBe("test:unit");
    expect(shellQuote("@scope/build")).toBe("@scope/build");
    expect(shellQuote("say hi")).toBe("'say hi'");
    expect(shellQuote("it's")).toBe("'it'\\''s'");
    expect(shellQuote("")).toBe("''");
  });
});

describe("scriptCommand", () => {
  it("starts the tool itself with the script as an argument", () => {
    expect(scriptArgs("npm", "pnpm", "lint fix")).toEqual({ program: "pnpm", args: ["run", "lint fix"] });
    expect(scriptArgs("composer", "composer", "test")).toEqual({ program: "composer", args: ["run-script", "test"] });
    expect(scriptArgs("just", "just", "fmt")).toEqual({ program: "just", args: ["fmt"] });
  });

  it("uses each tool's own way to run a script", () => {
    expect(scriptCommand("npm", "npm", "dev")).toBe("npm run dev");
    expect(scriptCommand("npm", "bun", "build")).toBe("bun run build");
    expect(scriptCommand("npm", "yarn", "lint fix")).toBe("yarn run 'lint fix'");
    expect(scriptCommand("composer", "composer", "test")).toBe("composer run-script test");
    expect(scriptCommand("make", "make", "release")).toBe("make release");
    expect(scriptCommand("deno", "deno", "start")).toBe("deno task start");
    expect(scriptCommand("just", "just", "fmt")).toBe("just fmt");
  });
});

describe("labels", () => {
  it("names the file with its package and folder", () => {
    expect(sourceLabel(source(), false)).toEqual({ title: "package.json", detail: "shop" });
    const nested = source({ filePath: "/work/app/packages/ui/package.json", folderPath: "/work/app/packages/ui", packageName: null });
    expect(relativeFolder(nested)).toBe("packages/ui");
    expect(sourceLabel(nested, false)).toEqual({ title: "package.json", detail: "packages/ui" });
    expect(sourceLabel(nested, true)).toEqual({ title: "package.json", detail: "app/packages/ui" });
  });

  it("names a script's terminal after the script and its runner", () => {
    expect(terminalName(source(), "dev")).toBe("dev (pnpm)");
  });
});

describe("scriptRows", () => {
  it("lists each file with its scripts unless collapsed", () => {
    const rows = scriptRows([source()], "", () => false);
    expect(rows.map((row) => row.kind)).toEqual(["source", "script", "script", "script"]);
    const collapsed = scriptRows([source()], "", () => true);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({ kind: "source", expanded: false, matches: 3 });
  });

  it("filters by name or command and opens matching files", () => {
    const other = source({ kind: "make", filePath: "/work/app/Makefile", runner: "make", packageName: null, scripts: [{ name: "deploy", command: "./deploy.sh", line: 3 }] });
    const rows = scriptRows([source(), other], "vite BUILD", () => true);
    expect(rows.map((row) => (row.kind === "script" ? row.script.name : row.source.filePath))).toEqual(["/work/app/package.json", "build"]);
    expect(scriptRows([source(), other], "nothing-like-this", () => false)).toEqual([]);
  });
});
