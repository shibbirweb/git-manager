import { describe, expect, it } from "vitest";
import type { NodeInstall, NodeWanted } from "$lib/types";
import { matchNodeSpec, nodeBadge, pickNode, SHELL_DEFAULT, specTest } from "./nodeVersion";

const installs: NodeInstall[] = ["25.9.0", "24.15.0", "22.23.1", "22.9.0", "20.18.3", "20.18.0", "18.20.6", "18.20.4", "16.20.2"].map(
  (version) => ({ version, binDir: `/nvm/v${version}/bin`, manager: "nvm" }),
);

function matched(spec: string): string | null {
  return matchNodeSpec(spec, installs)?.version ?? null;
}

function wanted(spec: string): NodeWanted {
  return { spec, source: ".nvmrc", filePath: "/app/.nvmrc" };
}

describe("matchNodeSpec", () => {
  it("takes the newest version of a major or minor", () => {
    expect(matched("18")).toBe("18.20.6");
    expect(matched("v20")).toBe("20.18.3");
    expect(matched("20.18")).toBe("20.18.3");
    expect(matched("18.x")).toBe("18.20.6");
    expect(matched("18.20.4")).toBe("18.20.4");
    expect(matched("v22.9.0")).toBe("22.9.0");
    expect(matched("19")).toBeNull();
  });

  it("understands nvm aliases", () => {
    expect(matched("node")).toBe("25.9.0");
    expect(matched("lts/*")).toBe("24.15.0");
    expect(matched("lts/iron")).toBe("20.18.3");
    expect(matched("lts/hydrogen")).toBe("18.20.6");
    expect(matched("lts/unknown")).toBeNull();
  });

  it("understands engines ranges", () => {
    expect(matched(">=18")).toBe("25.9.0");
    expect(matched(">=18 <21")).toBe("20.18.3");
    expect(matched(">= 18.0.0 < 19")).toBe("18.20.6");
    expect(matched("^18.20.5")).toBe("18.20.6");
    expect(matched("~20.18.0")).toBe("20.18.3");
    expect(matched("^16 || ^18")).toBe("18.20.6");
    expect(matched("16 - 18")).toBe("18.20.6");
    expect(matched(">22")).toBe("25.9.0");
    expect(matched("<=20")).toBe("20.18.3");
    expect(matched("<18")).toBe("16.20.2");
    expect(matched("^26")).toBeNull();
  });

  it("refuses what it does not understand", () => {
    expect(specTest("system")).toBeNull();
    expect(specTest("18.a")).toBeNull();
    expect(matched("")).toBeNull();
  });
});

describe("pickNode", () => {
  it("follows the project unless a version was picked", () => {
    const auto = pickNode(wanted("18"), installs, null);
    expect(auto).toMatchObject({ mode: "auto", missing: false });
    expect(auto.install?.version).toBe("18.20.6");
    expect(nodeBadge(auto)).toBe("node 18.20.6");

    const chosen = pickNode(wanted("18"), installs, "/nvm/v22.9.0/bin");
    expect(chosen.mode).toBe("chosen");
    expect(chosen.install?.version).toBe("22.9.0");

    const shell = pickNode(wanted("18"), installs, SHELL_DEFAULT);
    expect(shell).toMatchObject({ mode: "default", install: null });
    expect(nodeBadge(shell)).toBe("");
  });

  it("says when the asked version is missing, and forgets an uninstalled pick", () => {
    const missing = pickNode(wanted("14"), installs, null);
    expect(missing).toMatchObject({ install: null, missing: true });
    expect(nodeBadge(missing)).toBe("node 14 missing");
    expect(pickNode(wanted("16"), installs, "/gone/bin").install?.version).toBe("16.20.2");
    expect(pickNode(null, installs, null)).toMatchObject({ install: null, missing: false });
  });
});
