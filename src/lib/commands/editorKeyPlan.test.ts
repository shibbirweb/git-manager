import { describe, expect, it } from "vitest";
import { menuSpec } from "$lib/menu/menuSpec";
import { EMPTY_KEY_PLAN, editorKeyPlan, sameKeyPlan } from "./editorKeyPlan";
import { buildCommandSpecs } from "./registry";

const specs = buildCommandSpecs(menuSpec("macos", "app"));
const linuxSpecs = buildCommandSpecs(menuSpec("linux", "app"));

describe("editorKeyPlan", () => {
  it("is empty without custom keys", () => {
    expect(editorKeyPlan(specs, {}, "macos")).toEqual(EMPTY_KEY_PLAN);
  });

  it("binds an editor command's new key and blocks its old one", () => {
    const plan = editorKeyPlan(specs, { "code.duplicate": "CmdOrCtrl+Alt+D" }, "macos");
    expect(plan.commands).toEqual([{ commandId: "code.duplicate", key: "Alt-Meta-d" }]);
    expect(plan.blocked).toEqual(["Shift-Meta-d"]);
    expect(plan.window).toEqual([]);
  });

  it("writes the keys for the platform", () => {
    const plan = editorKeyPlan(linuxSpecs, { "code.duplicate": "CmdOrCtrl+Alt+D" }, "linux");
    expect(plan.commands).toEqual([{ commandId: "code.duplicate", key: "Ctrl-Alt-d" }]);
    expect(plan.blocked).toEqual(["Ctrl-Shift-d"]);
  });

  it("does not block a default key another editor command took", () => {
    const plan = editorKeyPlan(specs, { "code.duplicate": "CmdOrCtrl+D", "code.selectNextOccurrence": "CmdOrCtrl+Shift+D" }, "macos");
    expect(plan.commands).toEqual([
      { commandId: "code.duplicate", key: "Meta-d" },
      { commandId: "code.selectNextOccurrence", key: "Shift-Meta-d" },
    ]);
    expect(plan.blocked).toEqual([]);
  });

  it("hands a freed editor key to the window command that now has it", () => {
    const plan = editorKeyPlan(specs, { "code.selectNextOccurrence": null, "git.push": "CmdOrCtrl+D" }, "macos");
    expect(plan.commands).toEqual([]);
    expect(plan.blocked).toEqual([]);
    expect(plan.window).toEqual([{ commandId: "git.push", key: "Meta-d" }]);
  });

  it("lets an editor key win in the editor when both keep it", () => {
    const plan = editorKeyPlan(specs, { "git.push": "CmdOrCtrl+D" }, "macos");
    expect(plan.window).toEqual([]);
  });

  it("makes a window command's custom key work from an editor", () => {
    const plan = editorKeyPlan(specs, { "view.sidebar": "CmdOrCtrl+I" }, "macos");
    expect(plan.window).toEqual([{ commandId: "view.sidebar", key: "Meta-i" }]);
    // Removing a window key changes nothing in the editor.
    expect(editorKeyPlan(specs, { "view.sidebar": null }, "macos")).toEqual(EMPTY_KEY_PLAN);
  });

  it("compares plans by content", () => {
    const overrides = { "code.duplicate": "F6" };
    expect(sameKeyPlan(editorKeyPlan(specs, overrides, "macos"), editorKeyPlan(specs, { ...overrides }, "macos"))).toBe(true);
    expect(sameKeyPlan(editorKeyPlan(specs, overrides, "macos"), EMPTY_KEY_PLAN)).toBe(false);
  });
});
