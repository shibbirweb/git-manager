import { describe, expect, it } from "vitest";
import { languageName } from "./setup";

describe("languageName", () => {
  it("names common languages by extension", () => {
    expect(languageName("/work/src/app.ts")).toBe("TypeScript");
    expect(languageName("/work/src/main.rs")).toBe("Rust");
    expect(languageName("/work/README.MD")).toBe("Markdown");
  });

  it("falls back to plain text", () => {
    expect(languageName("/work/LICENSE")).toBe("Plain Text");
    expect(languageName("/work/data.xyz")).toBe("Plain Text");
    expect(languageName("/work/Dockerfile")).toBe("Dockerfile");
  });
});
