// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { releaseMedia } from "./releaseMedia";

describe("releaseMedia", () => {
  it("blanks a PDF frame and drops an image's source when destroyed", () => {
    const frame = document.createElement("iframe");
    frame.src = "gmpreview://localhost/a.pdf";
    releaseMedia(frame).destroy();
    expect(frame.getAttribute("src")).toBe("about:blank");

    const image = document.createElement("img");
    image.src = "gmpreview://localhost/a.png";
    releaseMedia(image).destroy();
    expect(image.hasAttribute("src")).toBe(false);
  });
});
