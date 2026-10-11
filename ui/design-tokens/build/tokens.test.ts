import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { argbHex, parseShadow, parseTokenColor } from "./color";
import { buildTokens, camelName, designTokens, kebabName, parseReference, resolved } from "./model";
import { tokenOutputs } from "./outputs";

const uiRoot = join(__dirname, "../..");
const appCss = readFileSync(join(uiRoot, "../src/app.css"), "utf8");

/** The custom properties of the CSS block that starts with `selector {`. */
function blockTokens(selector: string): Record<string, string> {
  const start = appCss.indexOf(`${selector} {`);
  const end = appCss.indexOf("\n}", start);
  const found: Record<string, string> = {};
  for (const match of appCss.slice(start, end).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    found[match[1]] = match[2].trim();
  }
  return found;
}

describe("the token files", () => {
  it("have the colors of src/app.css, light and dark", () => {
    const light = blockTokens(":root");
    const dark = { ...light, ...blockTokens(":root[data-theme=\"dark\"]") };
    for (const [name, color] of Object.entries(designTokens.colors)) {
      expect([name, color.light]).toEqual([name, light[name]]);
      expect([name, color.dark]).toEqual([name, dark[name]]);
    }
    const plainColors = Object.entries(light).filter(([, value]) => /^(#[0-9a-f]{6}|rgba?\()/i.test(value));
    expect(Object.keys(designTokens.colors).sort()).toEqual(plainColors.map(([name]) => name).sort());
  });

  it("have the popup shadow of src/app.css", () => {
    expect(designTokens.shadows.popup.light).toBe(blockTokens(":root").shadow);
    expect(designTokens.shadows.popup.dark).toBe(blockTokens(":root[data-theme=\"dark\"]").shadow);
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
