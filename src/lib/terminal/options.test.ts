import { describe, expect, it } from "vitest";
import { defaultPreferences } from "$lib/stores/settingsData";
import {
  applyChangedOptions,
  changesMetrics,
  releasesGpuWhenHidden,
  SMOOTH_SCROLL_MS,
  terminalAddonPlan,
  terminalDisplayOptions,
} from "./options";

describe("terminalDisplayOptions", () => {
  it("maps the defaults to xterm options", () => {
    const options = terminalDisplayOptions(defaultPreferences);
    expect(options.fontFamily.startsWith("'JetBrains Mono', Menlo, Monaco, 'Courier New', 'Symbols Nerd Font Mono'")).toBe(true);
    expect(options.fontFamily.endsWith(", monospace")).toBe(true);
    expect(options).toMatchObject({
      fontSize: 13,
      lineHeight: 1.2,
      letterSpacing: 0,
      fontWeight: "normal",
      fontWeightBold: "bold",
      cursorStyle: "block",
      cursorBlink: true,
      scrollback: 5000,
      macOptionIsMeta: false,
      smoothScrollDuration: 0,
    });
  });

  it("follows every terminal setting", () => {
    const options = terminalDisplayOptions({
      ...defaultPreferences,
      terminalFontFamily: "Hack, monospace",
      terminalNerdFontIcons: false,
      terminalFontSize: 15,
      terminalLineHeight: 1.4,
      terminalLetterSpacing: 2,
      terminalFontWeight: "medium",
      terminalFontWeightBold: "normal",
      terminalCursorStyle: "bar",
      terminalCursorBlink: false,
      terminalScrollback: 20000,
      terminalOptionAsMeta: true,
      terminalSmoothScrolling: true,
    });
    expect(options).toEqual({
      fontFamily: "Hack, monospace",
      fontSize: 15,
      lineHeight: 1.4,
      letterSpacing: 2,
      fontWeight: "500",
      fontWeightBold: "normal",
      cursorStyle: "bar",
      cursorBlink: false,
      scrollback: 20000,
      macOptionIsMeta: true,
      smoothScrollDuration: SMOOTH_SCROLL_MS,
    });
  });

  it("never blinks once the shell has exited", () => {
    expect(terminalDisplayOptions(defaultPreferences, true).cursorBlink).toBe(false);
  });
});

describe("applyChangedOptions", () => {
  it("writes only what changed and reports it", () => {
    const current = terminalDisplayOptions(defaultPreferences);
    const target: Record<string, unknown> = { ...current };
    expect(applyChangedOptions(target, current)).toEqual([]);
    const next = { ...current, cursorStyle: "underline" as const, fontSize: 16 };
    expect(applyChangedOptions(target, next)).toEqual(["fontSize", "cursorStyle"]);
    expect(target.fontSize).toBe(16);
    expect(target.cursorStyle).toBe("underline");
  });
});

describe("changesMetrics", () => {
  it("re-fits only for options that change the cell size", () => {
    expect(changesMetrics(["fontFamily"])).toBe(true);
    expect(changesMetrics(["lineHeight", "cursorBlink"])).toBe(true);
    expect(changesMetrics(["letterSpacing"])).toBe(true);
    expect(changesMetrics(["cursorStyle", "cursorBlink", "scrollback"])).toBe(false);
    expect(changesMetrics(["macOptionIsMeta", "smoothScrollDuration"])).toBe(false);
    expect(changesMetrics([])).toBe(false);
  });
});

describe("terminalAddonPlan", () => {
  it("loads the default parts", () => {
    expect(terminalAddonPlan(defaultPreferences)).toEqual({ webgl: true, unicode11: true, search: true, fileLinks: true });
  });

  it("leaves out every part that is off", () => {
    expect(
      terminalAddonPlan({
        ...defaultPreferences,
        terminalGpuAcceleration: false,
        terminalUnicode11: false,
        terminalFind: false,
        terminalFileLinks: false,
      }),
    ).toEqual({ webgl: false, unicode11: false, search: false, fileLinks: false });
  });

  it("draws ligatures with the DOM renderer, since they are CSS", () => {
    expect(terminalAddonPlan({ ...defaultPreferences, terminalLigatures: true }).webgl).toBe(false);
  });
});

describe("releasesGpuWhenHidden", () => {
  it("frees the GPU of hidden terminals only while they would draw with it", () => {
    expect(releasesGpuWhenHidden(terminalAddonPlan(defaultPreferences), defaultPreferences)).toBe(true);
    expect(releasesGpuWhenHidden(terminalAddonPlan(defaultPreferences), { terminalFreeGpuWhenHidden: false })).toBe(false);
    const noGpu = terminalAddonPlan({ ...defaultPreferences, terminalGpuAcceleration: false });
    expect(releasesGpuWhenHidden(noGpu, defaultPreferences)).toBe(false);
  });
});
