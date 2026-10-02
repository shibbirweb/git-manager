import { describe, expect, it } from "vitest";
import { terminalDrawingSummary, webglLabel } from "./gpuStatus";

const on = { gpuSetting: true, ligatures: false };

describe("terminalDrawingSummary", () => {
  it("says no, with the reason", () => {
    expect(terminalDrawingSummary({ drawings: ["gpu"], gpuSetting: false, ligatures: false })).toBe("No, turned off in Settings");
    expect(terminalDrawingSummary({ drawings: ["normal"], gpuSetting: true, ligatures: true })).toBe("No, font ligatures need normal drawing");
    expect(terminalDrawingSummary({ drawings: [], ...on })).toBe("No terminal open");
    expect(terminalDrawingSummary({ drawings: ["fallback"], ...on })).toBe("No, the GPU failed, normal drawing");
    expect(terminalDrawingSummary({ drawings: ["fallback", "fallback"], ...on })).toBe("No, the GPU failed in 2 terminals");
  });

  it("says yes and counts the terminals on the GPU", () => {
    expect(terminalDrawingSummary({ drawings: ["gpu"], ...on })).toBe("Yes, in 1 terminal");
    expect(terminalDrawingSummary({ drawings: ["gpu", "gpu"], ...on })).toBe("Yes, in 2 terminals");
    expect(terminalDrawingSummary({ drawings: ["gpu", "normal"], ...on })).toBe("Yes, in 1 of 2 terminals");
    expect(terminalDrawingSummary({ drawings: ["gpu", "fallback"], ...on })).toBe("Yes, in 1 of 2 terminals (1 fell back)");
  });

  it("waits for hidden terminals", () => {
    expect(terminalDrawingSummary({ drawings: ["normal"], ...on })).toBe("Not yet, starts when a terminal is shown");
  });
});

describe("webglLabel", () => {
  it("says whether the web view supports WebGL, naming the chip when it can", () => {
    expect(webglLabel({ available: true, renderer: "Apple M1 Pro" })).toBe("Yes (Apple M1 Pro)");
    expect(webglLabel({ available: true, renderer: null })).toBe("Yes");
    expect(webglLabel({ available: false, renderer: null })).toBe("No");
    expect(webglLabel(null)).toBe("Checking...");
  });
});
