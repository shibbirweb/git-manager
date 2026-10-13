import { describe, expect, it } from "vitest";
import { dialogKeyAction, isLineField, type DialogKey, type DialogKeyOptions } from "./dialogKeys";

function key(name: string, extra: Partial<DialogKey> = {}): DialogKey {
  return {
    key: name,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    defaultPrevented: false,
    ...extra,
  };
}

const FORM: DialogKeyOptions = { dismissible: true, canSubmit: true, enterSubmits: false, inLineField: true };

describe("dialogKeyAction", () => {
  it("closes on Escape only when dismissible", () => {
    expect(dialogKeyAction(key("Escape"), FORM)).toBe("close");
    expect(dialogKeyAction(key("Escape"), { ...FORM, dismissible: false })).toBeNull();
  });

  it("submits on Cmd+Enter or Ctrl+Enter anywhere", () => {
    expect(dialogKeyAction(key("Enter", { metaKey: true }), { ...FORM, inLineField: false })).toBe("submit");
    expect(dialogKeyAction(key("Enter", { ctrlKey: true }), FORM)).toBe("submit");
    expect(dialogKeyAction(key("Enter", { metaKey: true }), { ...FORM, canSubmit: false })).toBeNull();
  });

  it("submits on a plain Enter in a one-line field only with enterSubmits", () => {
    expect(dialogKeyAction(key("Enter"), FORM)).toBeNull();
    const prompt = { ...FORM, enterSubmits: true };
    expect(dialogKeyAction(key("Enter"), prompt)).toBe("submit");
    expect(dialogKeyAction(key("Enter"), { ...prompt, inLineField: false })).toBeNull();
    expect(dialogKeyAction(key("Enter", { shiftKey: true }), prompt)).toBeNull();
    expect(dialogKeyAction(key("Enter", { altKey: true }), prompt)).toBeNull();
  });

  it("leaves keys a field handled or an input method is still composing", () => {
    const prompt = { ...FORM, enterSubmits: true };
    expect(dialogKeyAction(key("Enter", { isComposing: true }), prompt)).toBeNull();
    expect(dialogKeyAction(key("Escape", { defaultPrevented: true }), prompt)).toBeNull();
  });
});

describe("isLineField", () => {
  it("is a text-like input, not a button, box or text area", () => {
    expect(isLineField({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isLineField({ tagName: "input", type: "password" })).toBe(true);
    expect(isLineField({ tagName: "input", type: "search" })).toBe(true);
    expect(isLineField({ tagName: "input", type: "checkbox" })).toBe(false);
    expect(isLineField({ tagName: "TEXTAREA", type: "textarea" })).toBe(false);
    expect(isLineField({ tagName: "BUTTON", type: "submit" })).toBe(false);
    expect(isLineField({ tagName: "DIV" })).toBe(false);
    expect(isLineField(null)).toBe(false);
  });
});
