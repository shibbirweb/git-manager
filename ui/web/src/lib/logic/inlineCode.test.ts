import { describe, expect, it } from "vitest";
import { inlineCodeParts } from "./inlineCode";

describe("inlineCodeParts", () => {
  it("splits code words out of the text", () => {
    expect(inlineCodeParts("Add `--signoff` to `git commit`.")).toEqual([
      { text: "Add ", code: false },
      { text: "--signoff", code: true },
      { text: " to ", code: false },
      { text: "git commit", code: true },
      { text: ".", code: false },
    ]);
  });

  it("keeps text without backticks whole", () => {
    expect(inlineCodeParts("Plain words.")).toEqual([{ text: "Plain words.", code: false }]);
  });

  it("leaves a lone backtick as text", () => {
    expect(inlineCodeParts("a `b` c ` d")).toEqual([
      { text: "a ", code: false },
      { text: "b", code: true },
      { text: " c ", code: false },
      { text: "` d", code: false },
    ]);
  });

  it("returns nothing for empty text", () => {
    expect(inlineCodeParts("")).toEqual([]);
  });
});
