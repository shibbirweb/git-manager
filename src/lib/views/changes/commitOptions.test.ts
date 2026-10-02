import { describe, expect, it } from "vitest";
import {
  changedOptionCount,
  commitOptionArgs,
  commitOptionsTooltip,
  commitRequest,
  DEFAULT_COMMIT_OPTIONS,
  validateAuthor,
} from "./commitOptions";

describe("commit options", () => {
  it("maps each option to its git argument", () => {
    expect(commitOptionArgs(DEFAULT_COMMIT_OPTIONS)).toEqual([]);
    const all = { signOff: true, author: " Ann Lee <ann@example.com> ", gpgSign: "noSign" as const, noVerify: true };
    expect(commitOptionArgs(all)).toEqual(["--signoff", "--author=Ann Lee <ann@example.com>", "--no-gpg-sign", "--no-verify"]);
    expect(commitOptionArgs({ ...DEFAULT_COMMIT_OPTIONS, gpgSign: "sign" })).toEqual(["-S"]);
    expect(changedOptionCount(all)).toBe(4);
    expect(commitOptionsTooltip(DEFAULT_COMMIT_OPTIONS)).toBe("Commit Options");
    expect(commitOptionsTooltip({ ...DEFAULT_COMMIT_OPTIONS, signOff: true })).toBe("Commit Options: --signoff");
  });

  it("sends no author when it is blank", () => {
    expect(commitRequest({ ...DEFAULT_COMMIT_OPTIONS, author: "   " }).author).toBeNull();
    expect(commitRequest({ ...DEFAULT_COMMIT_OPTIONS, author: " A <a@b> " }).author).toBe("A <a@b>");
  });

  it("validates the author like the backend", () => {
    expect(validateAuthor("")).toBeNull();
    expect(validateAuthor("Ann Lee <ann@example.com>")).toBeNull();
    for (const bad of ["Ann", "<ann@example.com>", "Ann <>", "Ann <ann>", "-x <a@b>", "Ann <a@b", "Ann <a b@c>", "A <b> <c@d>"]) {
      expect(validateAuthor(bad), bad).not.toBeNull();
    }
  });
});
