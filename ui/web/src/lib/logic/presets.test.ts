import { describe, expect, it } from "vitest";
import { scales } from "../styles/tokens";
import { controlWidth, GRID_COLUMNS, iconPx, presetVar } from "./presets";

describe("presets", () => {
  it("resolve icon sizes from the tokens", () => {
    expect(iconPx("large")).toBe(scales.iconSize.large);
    expect(iconPx("medium")).toBe(13);
  });

  it("name CSS variables for scales", () => {
    expect(presetVar("controlWidth", "medium")).toBe("var(--control-width-medium)");
    expect(presetVar("panelDefault", "sidebar")).toBe("var(--panel-default-sidebar)");
  });

  it("give control widths, including auto and fill", () => {
    expect(controlWidth("auto")).toBe("auto");
    expect(controlWidth("fill")).toBe("100%");
    expect(controlWidth("small")).toBe("var(--control-width-small)");
  });

  it("count grid columns by name", () => {
    expect(GRID_COLUMNS.three).toBe(3);
  });
});
