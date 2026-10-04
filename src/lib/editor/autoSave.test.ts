import { describe, expect, it } from "vitest";
import { type AutoSaveCheck, shouldAutoSave } from "./autoSave";

const ready: AutoSaveCheck = {
  mode: "afterDelay",
  trigger: "delay",
  dirty: true,
  editable: true,
  saving: false,
  conflicted: false,
  inMergeTool: false,
};

describe("shouldAutoSave", () => {
  it("saves on the trigger that matches the mode", () => {
    expect(shouldAutoSave(ready)).toBe(true);
    expect(shouldAutoSave({ ...ready, trigger: "focus" })).toBe(false);
    expect(shouldAutoSave({ ...ready, mode: "onFocusChange", trigger: "focus" })).toBe(true);
    expect(shouldAutoSave({ ...ready, mode: "onFocusChange", trigger: "delay" })).toBe(false);
    expect(shouldAutoSave({ ...ready, mode: "off" })).toBe(false);
    expect(shouldAutoSave({ ...ready, mode: "off", trigger: "focus" })).toBe(false);
  });

  it("never saves clean, read-only, busy or conflicted files", () => {
    expect(shouldAutoSave({ ...ready, dirty: false })).toBe(false);
    expect(shouldAutoSave({ ...ready, editable: false })).toBe(false);
    expect(shouldAutoSave({ ...ready, saving: true })).toBe(false);
    expect(shouldAutoSave({ ...ready, conflicted: true })).toBe(false);
    expect(shouldAutoSave({ ...ready, inMergeTool: true })).toBe(false);
  });
});
