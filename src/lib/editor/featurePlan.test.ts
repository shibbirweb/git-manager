import { describe, expect, it } from "vitest";
import { defaultPreferences } from "$lib/stores/settingsData";
import {
  changedFeatures,
  EDITOR_FEATURES,
  type EditorFeatureOptions,
  featureApplies,
  featureOptions,
  needsAutocomplete,
  wordsWhileTyping,
} from "./featurePlan";

const defaults = featureOptions(defaultPreferences);

describe("editor features", () => {
  it("turns every feature but the margin line and the minimap on by default", () => {
    expect(defaults).toEqual({
      autoCloseBrackets: true,
      completion: true,
      completionOnTyping: true,
      foldGutter: true,
      indentGuides: true,
      highlightWord: true,
      scrollPastEnd: true,
      columnSelection: true,
      rulerColumn: 0,
      stickyScroll: true,
      minimap: false,
      bracketPairColors: true,
      matchBrackets: true,
    });
  });

  it("keeps sticky scroll and the minimap to the file editor and colors brackets everywhere", () => {
    const all = { ...defaults, minimap: true };
    for (const feature of ["stickyScroll", "minimap"] as const) {
      expect(featureApplies(feature, "file", all), feature).toBe(true);
      expect(featureApplies(feature, "diff", all), feature).toBe(false);
      expect(featureApplies(feature, "merge", all), feature).toBe(false);
    }
    for (const feature of ["bracketPairColors", "matchBrackets"] as const) {
      expect(featureApplies(feature, "diff", all), feature).toBe(true);
      expect(featureApplies(feature, "merge", all), feature).toBe(true);
    }
    expect(changedFeatures(defaults, { ...defaults, minimap: true, matchBrackets: false })).toEqual(["minimap", "matchBrackets"]);
  });

  it("keeps typing aids, folding and scrolling past the end to the file editor", () => {
    for (const feature of ["autoCloseBrackets", "completion", "foldGutter", "scrollPastEnd"] as const) {
      expect(featureApplies(feature, "file", defaults), feature).toBe(true);
      expect(featureApplies(feature, "diff", defaults), feature).toBe(false);
      expect(featureApplies(feature, "merge", defaults), feature).toBe(false);
    }
    for (const feature of ["indentGuides", "highlightWord", "columnSelection"] as const) {
      expect(featureApplies(feature, "diff", defaults), feature).toBe(true);
      expect(featureApplies(feature, "merge", defaults), feature).toBe(true);
    }
  });

  it("draws the margin line only with a column", () => {
    expect(featureApplies("ruler", "file", defaults)).toBe(false);
    expect(featureApplies("ruler", "merge", { ...defaults, rulerColumn: 120 })).toBe(true);
  });

  it("leaves a switched-off feature out everywhere", () => {
    const off: EditorFeatureOptions = { ...defaults, indentGuides: false, completion: false };
    expect(featureApplies("indentGuides", "file", off)).toBe(false);
    expect(featureApplies("completion", "file", off)).toBe(false);
  });

  it("rebuilds only the features that changed", () => {
    expect(changedFeatures(defaults, defaults)).toEqual([]);
    expect(changedFeatures(defaults, { ...defaults, foldGutter: false, rulerColumn: 80 })).toEqual(["foldGutter", "ruler"]);
    expect(changedFeatures(defaults, { ...defaults, completionOnTyping: false })).toEqual(["completion"]);
    // While completion is off, its typing option changes nothing in the editors.
    const noCompletion = { ...defaults, completion: false };
    expect(changedFeatures(noCompletion, { ...noCompletion, completionOnTyping: false })).toEqual([]);
  });

  it("offers words while typing only in code", () => {
    expect(wordsWhileTyping("javascript")).toBe(true);
    expect(wordsWhileTyping("markdown")).toBe(false);
    expect(wordsWhileTyping(null)).toBe(false);
  });

  it("loads the autocomplete package only for auto-close and completion", () => {
    expect(EDITOR_FEATURES.filter(needsAutocomplete)).toEqual(["autoCloseBrackets", "completion"]);
  });
});
