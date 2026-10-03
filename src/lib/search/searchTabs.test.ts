import { describe, expect, it } from "vitest";
import { buildCommandSpecs } from "$lib/commands/registry";
import { menuSpec } from "$lib/menu/menuSpec";
import type { ShortcutKey, ShortcutKeys } from "$lib/views/workspaceShortcuts";
import { isReplaceKey, MAX_SELECTION_QUERY, openerForShortcut, openingTab, queryFromSelection, stepTab, tabForKey, usesSymbols } from "./searchTabs";

const keys: ShortcutKeys = { specs: buildCommandSpecs(menuSpec("macos", "app")), platform: "macos", overrides: {} };

function press(key: string, code: string, modifiers: Partial<ShortcutKey> = {}): ShortcutKey {
  return { key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, defaultPrevented: false, ...modifiers };
}

describe("search tabs", () => {
  it("cycles with Tab and Shift+Tab", () => {
    expect(stepTab("all", 1)).toBe("classes");
    expect(stepTab("text", 1)).toBe("all");
    expect(stepTab("all", -1)).toBe("text");
    expect(stepTab("symbols", -1)).toBe("files");
  });

  it("opens each shortcut on its tab and double Shift where it was left", () => {
    expect(openingTab("everywhere", null)).toBe("all");
    expect(openingTab("everywhere", "symbols")).toBe("symbols");
    expect(openingTab("classes", "symbols")).toBe("classes");
    expect(openingTab("text", null)).toBe("text");
  });

  it("maps workspace shortcuts to openers", () => {
    expect(openerForShortcut("goToFile")).toBe("files");
    expect(openerForShortcut("goToClass")).toBe("classes");
    expect(openerForShortcut("goToSymbol")).toBe("symbols");
    expect(openerForShortcut("findInFiles")).toBe("text");
    expect(openerForShortcut("replaceInFiles")).toBe("text");
    expect(openerForShortcut("toggleSidebar")).toBeNull();
  });

  it("switches tabs with their shortcuts while open", () => {
    expect(tabForKey(press("o", "KeyO", { metaKey: true }), keys)).toBe("classes");
    expect(tabForKey(press("ø", "KeyO", { metaKey: true, altKey: true }), keys)).toBe("symbols");
    expect(tabForKey(press("O", "KeyO", { metaKey: true, shiftKey: true }), keys)).toBe("files");
    expect(tabForKey(press("p", "KeyP", { metaKey: true }), keys)).toBe("files");
    // The Command Palette is Quick Open's, not a tab of this popup.
    expect(tabForKey(press("P", "KeyP", { metaKey: true, shiftKey: true }), keys)).toBeNull();
    expect(tabForKey(press("F", "KeyF", { metaKey: true, shiftKey: true }), keys)).toBe("text");
    expect(tabForKey(press("b", "KeyB", { metaKey: true }), keys)).toBeNull();
    expect(tabForKey(press("o", "KeyO"), keys)).toBeNull();
    expect(tabForKey(press("R", "KeyR", { metaKey: true, shiftKey: true }), keys)).toBe("text");
  });

  it("knows the Replace in Files key", () => {
    expect(isReplaceKey(press("R", "KeyR", { metaKey: true, shiftKey: true }), keys)).toBe(true);
    expect(isReplaceKey(press("F", "KeyF", { metaKey: true, shiftKey: true }), keys)).toBe(false);
    expect(isReplaceKey(press("r", "KeyR", { metaKey: true }), keys)).toBe(false);
  });

  it("knows which tabs read the symbol index", () => {
    expect(usesSymbols("all")).toBe(true);
    expect(usesSymbols("classes")).toBe(true);
    expect(usesSymbols("files")).toBe(false);
    expect(usesSymbols("text")).toBe(false);
  });

  it("starts a search with a short one-line selection", () => {
    expect(queryFromSelection("calculateTotal")).toBe("calculateTotal");
    expect(queryFromSelection("cart total")).toBe("cart total");
    expect(queryFromSelection("x".repeat(MAX_SELECTION_QUERY))).toHaveLength(MAX_SELECTION_QUERY);
  });

  it("ignores blank, multi-line and long selections", () => {
    expect(queryFromSelection("")).toBe("");
    expect(queryFromSelection("   ")).toBe("");
    expect(queryFromSelection("first\nsecond")).toBe("");
    expect(queryFromSelection("x".repeat(MAX_SELECTION_QUERY + 1))).toBe("");
  });
});
