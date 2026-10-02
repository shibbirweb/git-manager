import { describe, expect, it } from "vitest";
import type { NodeInstall, ScriptSource } from "$lib/types";
import { describeRun, nodePickFor, scriptRunId, scriptRunSpec, withRunner } from "./scriptRun";

const install: NodeInstall = { version: "20.11.1", manager: "nvm", binDir: "/nvm/v20.11.1/bin" } as NodeInstall;

const npm: ScriptSource = {
  kind: "npm",
  filePath: "/work/app/package.json",
  folderPath: "/work/app",
  workspaceFolder: "/work",
  runner: "npm",
  packageName: "app",
  scripts: [{ name: "dev", command: "vite", line: 3 }],
  error: null,
  nodeVersion: { spec: "20", source: ".nvmrc", filePath: "/work/app/.nvmrc" },
};

const make: ScriptSource = { ...npm, kind: "make", filePath: "/work/app/Makefile", runner: "make", nodeVersion: null };

describe("scriptRun", () => {
  it("applies Run With only to package.json", () => {
    expect(withRunner(npm, "pnpm").runner).toBe("pnpm");
    expect(withRunner(npm, null).runner).toBe("npm");
    expect(withRunner(make, "pnpm").runner).toBe("make");
  });

  it("picks the Node version the project asks for, or the one chosen", () => {
    expect(nodePickFor(npm, [install], {})?.install?.version).toBe("20.11.1");
    expect(nodePickFor(npm, [install], { [npm.filePath]: "default" })?.install).toBeNull();
    expect(nodePickFor(make, [install], {})).toBeNull();
  });

  it("starts the script the way the Scripts panel does", () => {
    const script = npm.scripts[0];
    const pick = nodePickFor(npm, [install], {});
    const spec = scriptRunSpec(withRunner(npm, "pnpm"), script, pick);
    expect(spec.runId).toBe(scriptRunId(npm, script));
    expect(spec.program).toBe("pnpm");
    expect(spec.cwd).toBe("/work/app");
    expect(spec.nodeBinDir).toBe("/nvm/v20.11.1/bin");
    expect(spec.description).toContain("(Node 20.11.1, nvm)");
    expect(describeRun(make, { name: "build", command: "", line: 0 }, null)).not.toContain("Node");
  });
});
