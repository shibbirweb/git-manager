import { describe, expect, it } from "vitest";
import { menuSpec } from "$lib/menu/menuSpec";
import { EMPTY_KEY_PLAN, editorKeyPlan, sameKeyPlan } from "./editorKeyPlan";
import { buildCommandSpecs } from "./registry";

const specs = buildCommandSpecs(menuSpec("macos", "app"));
const linuxSpecs = buildCommandSpecs(menuSpec("linux", "app"));
/** Jump to Navigation Bar works from an editor even with the default keys. */
const NAV_BAR = { commandId: "edit.navigationBar", key: "Meta-ArrowUp" };

describe("editorKeyPlan", () => {
  it("only takes the Navigation Bar key without custom keys", () => {
    expect(editorKeyPlan(specs, {}, "macos")).toEqual({ ...EMPTY_KEY_PLAN, window: [NAV_BAR] });
    expect(editorKeyPlan(linuxSpecs, {}, "linux").window).toEqual([{ commandId: "edit.navigationBar", key: "Alt-Home" }]);
  });

  it("follows a custom Navigation Bar key, and leaves the editor alone without one", () => {
    expect(editorKeyPlan(specs, { "edit.navigationBar": "Alt+Home" }, "macos").window).toEqual([
      { commandId: "edit.navigationBar", key: "Alt-Home" },
    ]);
    expect(editorKeyPlan(specs, { "edit.navigationBar": null }, "macos")).toEqual(EMPTY_KEY_PLAN);
  });

  it("binds an editor command's new key and blocks its old one", () => {
    const plan = editorKeyPlan(specs, { "code.duplicate": "CmdOrCtrl+Alt+D" }, "macos");
    expect(plan.commands).toEqual([{ commandId: "code.duplicate", key: "Alt-Meta-d" }]);
    expect(plan.blocked).toEqual(["Shift-Meta-d"]);
    expect(plan.window).toEqual([NAV_BAR]);
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
    expect(plan.window).toEqual([{ commandId: "git.push", key: "Meta-d" }, NAV_BAR]);
  });

  it("lets an editor key win in the editor when both keep it", () => {
    const plan = editorKeyPlan(specs, { "git.push": "CmdOrCtrl+D" }, "macos");
    expect(plan.window).toEqual([NAV_BAR]);
    // An editor command moved to Cmd+Up keeps it in the editor.
    expect(editorKeyPlan(specs, { "code.duplicate": "Cmd+Up" }, "macos").window).toEqual([]);
  });

  it("makes a window command's custom key work from an editor", () => {
    const plan = editorKeyPlan(specs, { "view.sidebar": "CmdOrCtrl+I" }, "macos");
    expect(plan.window).toEqual([NAV_BAR, { commandId: "view.sidebar", key: "Meta-i" }]);
    // Removing a window key changes nothing in the editor.
    expect(editorKeyPlan(specs, { "view.sidebar": null }, "macos")).toEqual(editorKeyPlan(specs, {}, "macos"));
  });

  it("compares plans by content", () => {
    const overrides = { "code.duplicate": "F6" };
    expect(sameKeyPlan(editorKeyPlan(specs, overrides, "macos"), editorKeyPlan(specs, { ...overrides }, "macos"))).toBe(true);
    expect(sameKeyPlan(editorKeyPlan(specs, overrides, "macos"), EMPTY_KEY_PLAN)).toBe(false);
  });
});
