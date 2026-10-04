import { describe, expect, it } from "vitest";
import { FILE_TOOLBAR_SWITCHES, SETTINGS_SECTIONS, type SettingsSection } from "$lib/stores/settingsData";
import dialogSource from "../SettingsDialog.svelte?raw";
import { CARET_EXTRA_ROWS, EDITOR_FEATURE_ROWS, SAVE_CLEANUP_ROWS } from "./settingsRows";
import { highlightSpans, matchingEntries, type SearchBlock, SETTINGS_SEARCH_INDEX, searchWords, textMatches, visibleBlocks } from "./settingsSearch";

const LABELS: Record<SettingsSection, string> = {
  appearance: "Appearance",
  editor: "Editor",
  merge: "Git",
  layout: "Layout",
  terminal: "Terminal",
  keyboard: "Keyboard Shortcuts",
  github: "GitHub",
  automation: "Automation",
  updates: "Updates",
  files: "Settings Files",
  about: "About",
};

/** A warning, not a setting. */
const NOT_INDEXED = new Set(["~/.local/bin is not on your PATH"]);

/** The literal row labels, group titles and About links of each section in SettingsDialog.svelte. */
function dialogLabels(): Map<SettingsSection, Set<string>> {
  const template = dialogSource.slice(dialogSource.indexOf('<div class="rows"'));
  const parts = template.split(/\{(?:#if|:else if) section === "(\w+)"\}/);
  const labels = new Map<SettingsSection, Set<string>>();
  for (let index = 1; index < parts.length; index += 2) {
    const body = parts[index + 1];
    const found = [
      ...body.matchAll(/<div class="label">\s*<span>([^<{]+)/g),
      ...body.matchAll(/<h4 class="group-title">([^<]+)<\/h4>/g),
      ...body.matchAll(/<strong>([^<{]+)<\/strong>/g),
    ].map((match) => match[1].trim());
    labels.set(parts[index] as SettingsSection, new Set(found.filter((label) => !NOT_INDEXED.has(label))));
  }
  return labels;
}

const LIST_LABELS = new Set([...FILE_TOOLBAR_SWITCHES, ...CARET_EXTRA_ROWS, ...EDITOR_FEATURE_ROWS, ...SAVE_CLEANUP_ROWS].map((row) => row.label));

describe("settings search index", () => {
  const fromDialog = dialogLabels();

  it("finds every section of the dialog", () => {
    expect([...fromDialog.keys()].sort()).toEqual([...SETTINGS_SECTIONS].sort());
  });

  it("lists every row and group title the dialog shows", () => {
    for (const [section, labels] of fromDialog) {
      const indexed = new Set(SETTINGS_SEARCH_INDEX.filter((entry) => entry.section === section).map((entry) => entry.label));
      for (const label of labels) {
        expect(indexed.has(label), `${section}: "${label}" is missing from settingsSearch.ts`).toBe(true);
      }
    }
  });

  it("lists nothing the dialog does not show", () => {
    for (const entry of SETTINGS_SEARCH_INDEX) {
      const known = fromDialog.get(entry.section)?.has(entry.label) || LIST_LABELS.has(entry.label);
      expect(known, `${entry.section}: "${entry.label}" is not in SettingsDialog.svelte`).toBe(true);
    }
  });

  it("points sub-rows at a row of the same section", () => {
    for (const entry of SETTINGS_SEARCH_INDEX.filter((item) => item.parent !== null)) {
      const parentFound = SETTINGS_SEARCH_INDEX.some((item) => item.section === entry.section && item.label === entry.parent);
      expect(parentFound, `${entry.section}: parent "${entry.parent}" of "${entry.label}"`).toBe(true);
    }
  });

  it("has each label once per section", () => {
    const keys = SETTINGS_SEARCH_INDEX.map((entry) => `${entry.section}/${entry.label}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("searchWords", () => {
  it("lowercases, splits on punctuation and drops repeats", () => {
    expect(searchWords("  Cmd+E  font FONT ")).toEqual(["cmd", "e", "font"]);
    expect(searchWords("   ")).toEqual([]);
  });
});

describe("textMatches", () => {
  it("needs every word to start a word of the text", () => {
    expect(textMatches("Editor font size", ["fon", "siz"])).toBe(true);
    expect(textMatches("Editor font size", ["ont"])).toBe(false);
    expect(textMatches("Editor font size", ["font", "weight"])).toBe(false);
  });

  it("matches nothing without words", () => {
    expect(textMatches("Editor font size", [])).toBe(false);
  });
});

describe("matchingEntries", () => {
  it("finds rows by label in every section that has them", () => {
    const found = matchingEntries(searchWords("ligatures"), LABELS);
    expect(found.map((entry) => `${entry.section}/${entry.label}`)).toEqual(["editor/Font ligatures", "terminal/Font ligatures"]);
  });

  it("finds rows by their extra words", () => {
    const found = matchingEntries(searchWords("ruler"), LABELS);
    expect(found.map((entry) => entry.label)).toEqual(["Right margin line", "Margin column"]);
  });

  it("lets the section name narrow a search", () => {
    const found = matchingEntries(searchWords("terminal cursor"), LABELS);
    expect(new Set(found.map((entry) => entry.section))).toEqual(new Set(["terminal"]));
    expect(found.map((entry) => entry.label)).toContain("Cursor style");
  });

  it("finds nothing for an empty search", () => {
    expect(matchingEntries([], LABELS)).toEqual([]);
  });
});

describe("highlightSpans", () => {
  it("marks the matched start of each word", () => {
    expect(highlightSpans("Editor font size", ["fo", "si"])).toEqual([
      [7, 9],
      [12, 14],
    ]);
  });

  it("uses the longest word that fits and skips words inside other words", () => {
    expect(highlightSpans("Font ligatures", ["f", "font", "atures"])).toEqual([[0, 4]]);
  });

  it("marks every word a search word starts", () => {
    expect(highlightSpans("Trim trailing whitespace", ["tr"])).toEqual([
      [0, 2],
      [5, 7],
    ]);
  });

  it("returns nothing without words", () => {
    expect(highlightSpans("Editor font size", [])).toEqual([]);
  });
});

describe("visibleBlocks", () => {
  const block = (kind: SearchBlock["kind"], matched = false): SearchBlock => ({ kind, matched });

  it("keeps matched rows and hides the rest", () => {
    expect(visibleBlocks([block("row", true), block("row"), block("row", true)])).toEqual([true, false, true]);
  });

  it("keeps a group title and its hint while one of its rows shows", () => {
    const blocks = [block("group"), block("hint"), block("row"), block("row", true), block("group"), block("row")];
    expect(visibleBlocks(blocks)).toEqual([true, true, false, true, false, false]);
  });

  it("keeps a whole group when its title matches", () => {
    const blocks = [block("group", true), block("hint"), block("row"), block("subRow"), block("group"), block("row")];
    expect(visibleBlocks(blocks)).toEqual([true, true, true, true, false, false]);
  });

  it("keeps the sub-rows of a matched row and matched sub-rows alone", () => {
    const blocks = [block("row", true), block("subRow"), block("row"), block("subRow", true), block("subRow")];
    expect(visibleBlocks(blocks)).toEqual([true, true, false, true, false]);
  });

  it("shows other blocks with the block before them, and first ones always", () => {
    expect(visibleBlocks([block("other"), block("row"), block("other"), block("row", true), block("other")])).toEqual([
      true,
      false,
      false,
      true,
      true,
    ]);
  });

  it("hides every row when nothing matches", () => {
    expect(visibleBlocks([block("group"), block("row"), block("subRow")])).toEqual([false, false, false]);
  });
});
