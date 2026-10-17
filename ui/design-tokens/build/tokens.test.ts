import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { argbHex, parseShadow, parseTokenColor } from "./color";
import { componentValue } from "./css";
import { buildTokens, camelName, designTokens, kebabName, parseReference, resolved } from "./model";
import { tokenOutputs } from "./outputs";

const uiRoot = join(__dirname, "../..");
const colorsCssFile = readFileSync(join(uiRoot, "web/src/lib/styles/colors.css"), "utf8");

/** The custom properties and color-scheme of the CSS block that starts with `selector {`. */
function blockTokens(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("}", start);
  const found: Record<string, string> = {};
  for (const match of css.slice(start, end).matchAll(/(--[a-z0-9-]+|color-scheme):\s*([^;]+);/g)) {
    found[match[1].replace(/^--/, "")] = match[2].trim();
  }
  return found;
}

describe("the token files", () => {
  it("write every color, the popup shadow and the color scheme into each block of styles/colors.css", () => {
    const blocks = {
      light: blockTokens(colorsCssFile, ":root"),
      dark: blockTokens(colorsCssFile, ':root[data-theme="dark"]'),
    } as const;
    for (const mode of ["light", "dark"] as const) {
      for (const [name, color] of Object.entries(designTokens.colors)) {
        expect([mode, name, blocks[mode][name]]).toEqual([mode, name, color[mode]]);
      }
      expect(blocks[mode].shadow).toBe(designTokens.shadows.popup[mode]);
      expect(blocks[mode]["color-scheme"]).toBe(mode);
    }
    expect(blockTokens(colorsCssFile, ':root:not([data-theme="light"])')).toEqual(blocks.dark);
  });

  it("are written out: every generated file is up to date (bun run ui:tokens)", () => {
    for (const output of tokenOutputs()) {
      expect([output.path, readFileSync(join(uiRoot, output.path), "utf8")]).toEqual([output.path, output.content]);
    }
  });

  it("keep generated files under 300 lines and 120 columns", () => {
    for (const output of tokenOutputs()) {
      const lines = output.content.split("\n");
      expect([output.path, lines.length <= 301]).toEqual([output.path, true]);
      expect(lines.filter((line) => line.length > 120)).toEqual([]);
    }
  });
});

describe("references", () => {
  it("point at scale tokens and resolve to their numbers", () => {
    expect(parseReference("{size.control}")).toEqual({ group: "size", name: "control" });
    expect(parseReference(12)).toBeNull();
    expect(resolved(designTokens, { group: "size", name: "control" })).toBe(28);
  });

  it("refuse a missing token or a stray string", () => {
    expect(() => buildTokens({}, { size: {} }, { button: { height: "{size.nope}" } })).toThrow("does not exist");
    expect(() => buildTokens({}, {}, { button: { height: "28px" } })).toThrow("neither a number");
  });
});

describe("component values", () => {
  it("give sizes px and leave stacking layers plain numbers", () => {
    expect(componentValue(24, "height")).toBe("24px");
    expect(componentValue(5, "layer")).toBe("5");
    expect(componentValue(20, "splitterLayer")).toBe("20");
    expect(componentValue({ group: "size", name: "control" }, "height")).toBe("var(--size-control)");
  });
});

describe("names and colors", () => {
  it("convert between platforms' naming styles", () => {
    expect(camelName("panel-alt")).toBe("panelAlt");
    expect(camelName("1")).toBe("s1");
    expect(kebabName("controlSmall")).toBe("control-small");
  });

  it("parse token colors and shadows", () => {
    expect(parseTokenColor("#3574f0")).toEqual({ red: 53, green: 116, blue: 240, alpha: 1 });
    expect(parseTokenColor("rgba(0, 0, 0, 0.28)")).toEqual({ red: 0, green: 0, blue: 0, alpha: 0.28 });
    expect(argbHex(parseTokenColor("rgba(0, 0, 0, 0.5)"))).toBe("#80000000");
    expect(parseShadow("0 8px 28px rgba(0, 0, 0, 0.16)")).toMatchObject({ x: 0, y: 8, blur: 28 });
    expect(() => parseTokenColor("red")).toThrow();
  });
});
