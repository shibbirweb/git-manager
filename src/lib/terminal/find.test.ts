import { describe, expect, it } from "vitest";
import {
  DEFAULT_FIND_OPTIONS,
  FIND_HIGHLIGHT_LIMIT,
  findBarKey,
  type FindKey,
  findCounterText,
  findDecorations,
  findQueryError,
  searchOptions,
} from "./find";

const tokens: Record<string, string> = { "--term-background": "#ffffff", "--warning": "#c27d04" };
const readToken = (token: string) => tokens[token] ?? "";

function key(keyName: string, code: string, modifiers: Partial<FindKey> = {}): FindKey {
  return { key: keyName, code, shiftKey: false, altKey: false, metaKey: false, ctrlKey: false, ...modifiers };
}

describe("searchOptions", () => {
  it("maps the toggles to xterm's names", () => {
    const decorations = findDecorations(readToken);
    expect(searchOptions({ matchCase: true, wholeWords: false, regex: true }, decorations)).toEqual({
      caseSensitive: true,
      wholeWord: false,
      regex: true,
      decorations,
    });
    expect(searchOptions(DEFAULT_FIND_OPTIONS, decorations, true).incremental).toBe(true);
  });
});

describe("findDecorations", () => {
  it("gives opaque #rrggbb colors, as the search addon needs", () => {
    const decorations = findDecorations(readToken);
    for (const color of Object.values(decorations)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(decorations.activeMatchBackground).not.toBe(decorations.matchBackground);
  });

  it("still gives colors when the tokens are missing", () => {
    const decorations = findDecorations(() => "");
    expect(decorations.matchBackground).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("findQueryError", () => {
  it("reports a broken regex only when Regex is on", () => {
    expect(findQueryError("a(", { ...DEFAULT_FIND_OPTIONS, regex: true })).toBe("Invalid regular expression");
    expect(findQueryError("a(", DEFAULT_FIND_OPTIONS)).toBeNull();
    expect(findQueryError("a.+b", { ...DEFAULT_FIND_OPTIONS, regex: true })).toBeNull();
    expect(findQueryError("", { ...DEFAULT_FIND_OPTIONS, regex: true })).toBeNull();
  });
});

describe("findCounterText", () => {
  it("counts like the editor's find bar", () => {
    expect(findCounterText("", null, null)).toBe("");
    expect(findCounterText("main", null, null)).toBe("");
    expect(findCounterText("main", { resultIndex: -1, resultCount: 0 }, null)).toBe("No results");
    expect(findCounterText("main", { resultIndex: 2, resultCount: 12 }, null)).toBe("3 of 12");
    expect(findCounterText("main", { resultIndex: -1, resultCount: 4 }, null)).toBe("4 found");
    expect(findCounterText("a", { resultIndex: 0, resultCount: FIND_HIGHLIGHT_LIMIT }, null)).toBe(`1 of ${FIND_HIGHLIGHT_LIMIT}+`);
    expect(findCounterText("a(", null, "Invalid regular expression")).toBe("Invalid regular expression");
  });
});

describe("findBarKey", () => {
  it("goes up with Enter and down with Shift+Enter, like VS Code's terminal", () => {
    expect(findBarKey(key("Enter", "Enter"))).toBe("previous");
    expect(findBarKey(key("Enter", "Enter", { shiftKey: true }))).toBe("next");
    expect(findBarKey(key("Escape", "Escape"))).toBe("close");
  });

  it("toggles the options with Option and the physical key", () => {
    expect(findBarKey(key("ç", "KeyC", { altKey: true }))).toBe("toggleCase");
    expect(findBarKey(key("∑", "KeyW", { altKey: true }))).toBe("toggleWords");
    expect(findBarKey(key("≈", "KeyX", { altKey: true }))).toBe("toggleRegex");
    expect(findBarKey(key("c", "KeyC", { altKey: true, metaKey: true }))).toBeNull();
  });

  it("leaves typing alone", () => {
    expect(findBarKey(key("a", "KeyA"))).toBeNull();
    expect(findBarKey(key("Enter", "Enter", { metaKey: true }))).toBeNull();
  });
});
