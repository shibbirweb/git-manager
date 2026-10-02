import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  buildQuery,
  countMatches,
  counterView,
  DEFAULT_FIND_OPTIONS,
  firstMatchFrom,
  isExcluded,
  NO_MATCHES,
  occurrenceRanges,
  optionsOf,
  regexError,
  selectionQuery,
} from "./findModel";

function state(doc: string, anchor = 0, head = anchor): EditorState {
  return EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: EditorState.allowMultipleSelections.of(true),
  });
}

const regex = { ...DEFAULT_FIND_OPTIONS, regex: true };

describe("buildQuery", () => {
  it("maps the toggles and keeps plain text literal", () => {
    const query = buildQuery("a\\nb", "x", { matchCase: true, wholeWords: true, regex: false });
    expect(query.caseSensitive).toBe(true);
    expect(query.wholeWord).toBe(true);
    expect(query.regexp).toBe(false);
    expect(query.literal).toBe(true);
    // Without Regex a typed \n is two characters, as in JetBrains.
    expect(countMatches(state("a\\nb a\nb"), query).total).toBe(1);
    expect(optionsOf(query)).toEqual({ matchCase: true, wholeWords: true, regex: false });
  });

  it("is case-insensitive by default and honours Words", () => {
    const doc = "Cart cart carts";
    expect(countMatches(state(doc), buildQuery("cart", "", DEFAULT_FIND_OPTIONS)).total).toBe(3);
    expect(countMatches(state(doc), buildQuery("cart", "", { ...DEFAULT_FIND_OPTIONS, matchCase: true })).total).toBe(2);
    expect(countMatches(state(doc), buildQuery("cart", "", { ...DEFAULT_FIND_OPTIONS, wholeWords: true })).total).toBe(2);
  });

  it("uses regex groups in the replacement", () => {
    const query = buildQuery("(\\w+)@(\\w+)", "$2 at $1\\t", regex);
    expect(query.valid).toBe(true);
    expect(query.literal).toBe(false);
    expect(countMatches(state("ada@home bob@work"), query).total).toBe(2);
  });

  it("applies the test function", () => {
    const query = buildQuery("a", "", DEFAULT_FIND_OPTIONS, (_match, _state, from) => from !== 0);
    expect(countMatches(state("a a a"), query).total).toBe(2);
  });
});

describe("regexError", () => {
  it("reports invalid patterns only with Regex on", () => {
    expect(regexError("add(", true)).not.toBeNull();
    expect(regexError("add(", false)).toBeNull();
    expect(regexError("add\\(", true)).toBeNull();
    expect(regexError("", true)).toBeNull();
  });
});

describe("selectionQuery", () => {
  it("seeds the field with a short one-line selection", () => {
    expect(selectionQuery("cart", false)).toBe("cart");
    expect(selectionQuery("", false)).toBeNull();
    expect(selectionQuery("a\nb", false)).toBeNull();
    expect(selectionQuery("a\r\nb", false)).toBeNull();
    expect(selectionQuery("x".repeat(501), false)).toBeNull();
  });

  it("escapes the selection when Regex is on", () => {
    expect(selectionQuery("a.b(c)", true)).toBe("a\\.b\\(c\\)");
  });
});

describe("countMatches", () => {
  it("finds the selected match", () => {
    const query = buildQuery("ab", "", DEFAULT_FIND_OPTIONS);
    expect(countMatches(state("ab ab ab", 3, 5), query)).toEqual({ total: 3, capped: false, current: 2 });
    expect(countMatches(state("ab ab ab", 1), query)).toEqual({ total: 3, capped: false, current: null });
  });

  it("stops at the cap", () => {
    const query = buildQuery("a", "", DEFAULT_FIND_OPTIONS);
    expect(countMatches(state("a".repeat(50), 0, 1), query, 10)).toEqual({ total: 10, capped: true, current: 1 });
    expect(countMatches(state("a".repeat(50), 30, 31), query, 10)).toEqual({ total: 10, capped: true, current: null });
  });

  it("counts nothing for an invalid or empty query", () => {
    expect(countMatches(state("abc"), buildQuery("(", "", regex))).toEqual(NO_MATCHES);
    expect(countMatches(state("abc"), buildQuery("", "", DEFAULT_FIND_OPTIONS))).toEqual(NO_MATCHES);
  });
});

describe("counterView", () => {
  it("shows the position, the total, no results and the cap", () => {
    expect(counterView("", NO_MATCHES, null)).toEqual({ text: "", problem: false });
    expect(counterView("x", NO_MATCHES, null)).toEqual({ text: "0 results", problem: true });
    expect(counterView("x", { total: 12, capped: false, current: 3 }, null)).toEqual({ text: "3/12", problem: false });
    expect(counterView("x", { total: 12, capped: false, current: null }, null).text).toBe("12 results");
    expect(counterView("x", { total: 1, capped: false, current: null }, null).text).toBe("1 result");
    expect(counterView("x", { total: 10000, capped: true, current: null }, null).text).toBe("10000+");
    expect(counterView("x", { total: 10000, capped: true, current: 7 }, null).text).toBe("7/10000+");
    expect(counterView("(", NO_MATCHES, "bad")).toEqual({ text: "Invalid regex", problem: true });
  });
});

describe("occurrenceRanges", () => {
  it("selects every occurrence of the selection, case-sensitively", () => {
    const found = occurrenceRanges(state("cart Cart cart carts", 5, 9));
    expect(found).toEqual({ ranges: [{ from: 5, to: 9 }], main: 0, tooMany: false });
    const lower = occurrenceRanges(state("cart Cart cart carts", 10, 14));
    expect(lower?.ranges).toEqual([
      { from: 0, to: 4 },
      { from: 10, to: 14 },
      { from: 15, to: 19 },
    ]);
    expect(lower?.main).toBe(1);
  });

  it("uses the whole word at the caret without a selection", () => {
    const found = occurrenceRanges(state("cart carts cart", 1));
    expect(found?.ranges).toEqual([
      { from: 0, to: 4 },
      { from: 11, to: 15 },
    ]);
    expect(occurrenceRanges(state("   ", 1))).toBeNull();
  });

  it("gives up over the cap", () => {
    expect(occurrenceRanges(state("a a a a", 0, 1), 2)).toEqual({ ranges: [], main: 0, tooMany: true });
  });
});

describe("firstMatchFrom", () => {
  it("finds the first match after the anchor and wraps", () => {
    const query = buildQuery("ab", "", DEFAULT_FIND_OPTIONS);
    expect(firstMatchFrom(state("ab xx ab"), query, 1)).toEqual({ from: 6, to: 8 });
    expect(firstMatchFrom(state("ab xx ab"), query, 7)).toEqual({ from: 0, to: 2 });
    expect(firstMatchFrom(state("ab xx ab"), buildQuery("zz", "", DEFAULT_FIND_OPTIONS), 0)).toBeNull();
  });
});

describe("isExcluded", () => {
  it("matches exact spans only", () => {
    expect(isExcluded([{ from: 2, to: 4 }], 2, 4)).toBe(true);
    expect(isExcluded([{ from: 2, to: 4 }], 2, 5)).toBe(false);
    expect(isExcluded([], 0, 1)).toBe(false);
  });
});
