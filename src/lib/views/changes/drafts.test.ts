import { describe, expect, it } from "vitest";
import { DraftBook } from "./drafts";

interface Draft {
  message: string;
}

describe("DraftBook", () => {
  it("creates one draft per repository on first use", () => {
    const book = new DraftBook<Draft>(() => ({ message: "" }));
    const web = book.get("/work/web");
    web.message = "fix: web";
    expect(book.get("/work/web")).toBe(web);
    expect(book.get("/work/api").message).toBe("");
    expect(book.size).toBe(2);
  });

  it("peeks without creating", () => {
    const book = new DraftBook<Draft>(() => ({ message: "" }));
    expect(book.peek("/work/web")).toBeNull();
    expect(book.size).toBe(0);
  });

  it("prunes drafts of repositories that are gone and keeps the rest", () => {
    const book = new DraftBook<Draft>(() => ({ message: "" }));
    book.get("/work/web").message = "keep";
    book.get("/work/api");
    expect(book.prune(["/work/web"])).toBe(1);
    expect(book.peek("/work/api")).toBeNull();
    expect(book.peek("/work/web")?.message).toBe("keep");
    expect(book.prune(["/work/web"])).toBe(0);
  });

  it("clears everything", () => {
    const book = new DraftBook<Draft>(() => ({ message: "" }));
    book.get("/work/web");
    book.clear();
    expect(book.size).toBe(0);
  });
});
