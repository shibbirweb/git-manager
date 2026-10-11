import { describe, expect, it } from "vitest";
import { toastTimeout } from "./toastModel";

describe("toastTimeout", () => {
  it("keeps errors longest and toasts with a button longer than plain ones", () => {
    expect(toastTimeout("error")).toBe(9000);
    expect(toastTimeout("warning")).toBe(6000);
    expect(toastTimeout("success")).toBe(3500);
    expect(toastTimeout("info")).toBe(3500);
    expect(toastTimeout("success", true)).toBe(8000);
  });
});
