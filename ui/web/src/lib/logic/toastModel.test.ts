import { describe, expect, it } from "vitest";
import { kindIcon, kindLabel, kindTone, toastTimeout, type ToastKind } from "./toastModel";

describe("toastTimeout", () => {
  it("keeps errors longest and toasts with a button longer than plain ones", () => {
    expect(toastTimeout("error")).toBe(9000);
    expect(toastTimeout("warning")).toBe(6000);
    expect(toastTimeout("success")).toBe(3500);
    expect(toastTimeout("info")).toBe(3500);
    expect(toastTimeout("success", true)).toBe(8000);
  });
});

describe("kinds", () => {
  it("gives each kind its own icon, color and name", () => {
    expect(["info", "success", "warning", "error"].map((kind) => kindIcon(kind as ToastKind))).toEqual([
      "info",
      "circle-check",
      "alert",
      "circle-alert",
    ]);
    expect(kindTone("info")).toBe("accent");
    expect(kindTone("success")).toBe("success");
    expect(kindTone("warning")).toBe("warning");
    expect(kindTone("error")).toBe("danger");
    expect(kindLabel("success")).toBe("Done");
    expect(kindLabel("error")).toBe("Error");
  });
});
