import { describe, expect, it } from "vitest";
import appCss from "../../app.css?raw";
import committedCss from "../../../static/file-icons/minimal/minimal.css?raw";
import committedMap from "../../../static/file-icons/minimal/map.json";
import { FILE_ICON_GLYPHS, FILE_ICON_TONES, minimalCss, minimalFiles, minimalMap } from "./minimalSource";

describe("minimalSource", () => {
  it("matches the committed static/file-icons/minimal (run bun scripts/file-icons.ts)", () => {
    expect(committedCss).toBe(minimalCss());
    expect(committedMap).toEqual(minimalMap());
    const svgs = Object.keys(import.meta.glob("/static/file-icons/minimal/*.svg")).sort();
    expect(svgs).toEqual(FILE_ICON_GLYPHS.map((glyph) => `/static/file-icons/minimal/${glyph}.svg`).sort());
  });

  it("maps only to glyphs and tones it has", () => {
    const map = minimalMap();
    for (const value of [map.file, ...Object.values(map.extensions), ...Object.values(map.names)]) {
      const [glyph, tone] = value.split(" ");
      expect(FILE_ICON_GLYPHS).toContain(glyph);
      expect(Object.keys(FILE_ICON_TONES)).toContain(tone);
    }
  });

  it("has a rule per glyph and tone, colored only with tokens app.css defines", () => {
    const css = minimalCss();
    for (const glyph of FILE_ICON_GLYPHS) {
      expect(css).toContain(`.fi-g-${glyph}{-webkit-mask-image:url(${glyph}.svg)`);
      expect(minimalFiles()[`${glyph}.svg`]).toContain("<svg");
    }
    for (const [tone, token] of Object.entries(FILE_ICON_TONES)) {
      expect(css).toContain(`.fi-t-${tone}{background-color:var(${token})}`);
      expect(appCss).toContain(`${token}:`);
    }
  });
});
