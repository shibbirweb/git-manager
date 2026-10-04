import { describe, expect, it } from "vitest";
import { rawBody } from "./rawBody";

const decoder = new TextDecoder();

function split(body: Uint8Array): [unknown, string] {
  const newline = body.indexOf(10);
  return [JSON.parse(decoder.decode(body.subarray(0, newline))), decoder.decode(body.subarray(newline + 1))];
}

describe("rawBody", () => {
  it("puts the arguments on the first line and the text after it", () => {
    const body = rawBody({ repoPath: "/repo\nwith newline", filePath: "a.txt" }, "line 1\nline 2\n");
    expect(split(body)).toEqual([{ repoPath: "/repo\nwith newline", filePath: "a.txt" }, "line 1\nline 2\n"]);
  });

  it("encodes text that is not ASCII", () => {
    const text = `${"x".repeat(50)}é😀\nnaïve ${"日本語".repeat(20)}`;
    const body = rawBody({ eol: "lf" }, text);
    expect(split(body)).toEqual([{ eol: "lf" }, text]);
    expect(body.length).toBe(new TextEncoder().encode(`${JSON.stringify({ eol: "lf" })}\n${text}`).length);
  });

  it("handles empty text", () => {
    expect(split(rawBody({}, ""))).toEqual([{}, ""]);
  });
});
