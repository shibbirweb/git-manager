import { describe, expect, it } from "vitest";
import { applyPatch, diffJson, isEmptyPatch, type JsonObject, parsePatch, rebaseIncoming, withoutKeys } from "./configPatch";

describe("diffJson", () => {
  it("is empty when nothing changed", () => {
    const value = { theme: "dark", openTabs: { a: { tabs: ["x"] } } };
    expect(isEmptyPatch(diffJson(value, structuredClone(value)))).toBe(true);
  });

  it("sets changed values, null included, and removes keys that went away", () => {
    const patch = diffJson(
      { theme: "dark", terminalShell: "zsh", old: 1, keybindings: { "file.save": "Cmd+S" } },
      { theme: "light", terminalShell: null, keybindings: { "file.save": null } },
    );
    expect(patch.set).toEqual([
      { path: ["theme"], value: "light" },
      { path: ["terminalShell"], value: null },
      { path: ["keybindings", "file.save"], value: null },
    ]);
    expect(patch.remove).toEqual([["old"]]);
  });

  it("compares objects entry by entry and arrays whole", () => {
    const patch = diffJson(
      { openTabs: { a: { tabs: ["x"] }, b: { tabs: ["y"] } }, recentFolders: ["/a", "/b"] },
      { openTabs: { a: { tabs: ["x"] }, b: { tabs: ["y", "z"] } }, recentFolders: ["/b", "/a"] },
    );
    expect(patch.set).toEqual([
      { path: ["openTabs", "b", "tabs"], value: ["y", "z"] },
      { path: ["recentFolders"], value: ["/b", "/a"] },
    ]);
  });

  it("replaces a value that changed between object and not", () => {
    expect(diffJson({ a: { b: 1 } }, { a: [1] }).set).toEqual([{ path: ["a"], value: [1] }]);
    expect(diffJson({ a: 1 }, { a: { b: 1 } }).set).toEqual([{ path: ["a"], value: { b: 1 } }]);
  });
});

describe("applyPatch", () => {
  it("round-trips a diff and never changes its input", () => {
    const base: JsonObject = { theme: "dark", openTabs: { a: { tabs: ["x"] } }, gone: true };
    const next: JsonObject = { theme: "light", openTabs: { a: { tabs: ["x"] }, b: { tabs: [] } }, added: null };
    const frozen = JSON.stringify(base);
    expect(applyPatch(base, diffJson(base, next))).toEqual(next);
    expect(JSON.stringify(base)).toBe(frozen);
  });

  it("creates objects along a path and skips removals that find nothing", () => {
    const result = applyPatch({ x: 3 }, { set: [{ path: ["x", "deep"], value: 1 }], remove: [["missing", "key"], []] });
    expect(result).toEqual({ x: { deep: 1 } });
  });

  it("replaces everything for an empty path", () => {
    expect(applyPatch({ a: 1 }, { set: [{ path: [], value: { b: 2 } }], remove: [] })).toEqual({ b: 2 });
  });
});

describe("rebaseIncoming", () => {
  it("applies another window's change and keeps this window's unsaved ones on top", () => {
    const base: JsonObject = { theme: "dark", editorFontSize: 13, openTabs: { mine: 1 } };
    const local: JsonObject = { theme: "dark", editorFontSize: 15, openTabs: { mine: 2 } };
    const incoming = diffJson(
      { theme: "dark", editorFontSize: 13, openTabs: { mine: 1 } },
      { theme: "light", editorFontSize: 14, openTabs: { mine: 1, theirs: 9 } },
    );
    const result = rebaseIncoming(base, local, incoming);
    expect(result.base).toEqual({ theme: "light", editorFontSize: 14, openTabs: { mine: 1, theirs: 9 } });
    expect(result.local).toEqual({ theme: "light", editorFontSize: 15, openTabs: { mine: 2, theirs: 9 } });
    // What this window writes next is only its own change.
    expect(diffJson(result.base, result.local).set).toEqual([
      { path: ["editorFontSize"], value: 15 },
      { path: ["openTabs", "mine"], value: 2 },
    ]);
  });

  it("follows removals from the other window", () => {
    const result = rebaseIncoming({ a: 1, b: 2 }, { a: 1, b: 2 }, { set: [], remove: [["b"]] });
    expect(result.local).toEqual({ a: 1 });
  });
});

describe("withoutKeys and parsePatch", () => {
  it("leaves out changes under the given top-level keys", () => {
    const patch = withoutKeys(
      { set: [{ path: ["sidebarWidth"], value: 300 }, { path: ["openTabs", "a"], value: 1 }], remove: [["leftPanel"], ["recentFolders"]] },
      ["sidebarWidth", "leftPanel"],
    );
    expect(patch).toEqual({ set: [{ path: ["openTabs", "a"], value: 1 }], remove: [["recentFolders"]] });
  });

  it("reads what is well formed and drops the rest", () => {
    expect(parsePatch(null)).toEqual({ set: [], remove: [] });
    expect(
      parsePatch({
        set: [{ path: ["a"], value: 1 }, { path: "a", value: 1 }, { path: ["b"] }, { path: [3], value: 1 }, { path: ["c"], value: null }],
        remove: [["x"], "y", [1]],
      }),
    ).toEqual({ set: [{ path: ["a"], value: 1 }, { path: ["c"], value: null }], remove: [["x"]] });
  });
});
