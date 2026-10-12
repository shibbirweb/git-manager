import { describe, expect, it } from "vitest";
import { bottomPanelMax, clampPanel, sidePanelMax } from "./shellLayout";

describe("shell layout", () => {
  it("leaves the editor area its minimum width", () => {
    expect(sidePanelMax(1400, 80, 260, 360, 200)).toBe(700);
  });

  it("never offers less than the panel minimum in a narrow window", () => {
    expect(sidePanelMax(600, 80, 260, 360, 200)).toBe(200);
    expect(bottomPanelMax(150, 120, 80)).toBe(80);
  });

  it("leaves the editors their minimum height", () => {
    expect(bottomPanelMax(700, 120, 80)).toBe(580);
  });

  it("clamps a stored size to the limits", () => {
    expect(clampPanel(900, 200, 700)).toBe(700);
    expect(clampPanel(100, 200, 700)).toBe(200);
    expect(clampPanel(260, 200, 700)).toBe(260);
  });

  it("keeps the stored size before the shell is measured", () => {
    expect(clampPanel(900, 200, 0)).toBe(900);
  });
});
