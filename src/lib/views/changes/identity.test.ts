import { describe, expect, it } from "vitest";
import type { Identity } from "$lib/types";
import { identityLabel, identityPrefill, validateIdentityEmail, validateIdentityName } from "./identity";

function identity(local: Identity["local"], global: Identity["global"]): Identity {
  return { local, global, complete: false, globalFile: null };
}

describe("commit identity", () => {
  it("checks names", () => {
    expect(validateIdentityName("Ann Lee", true)).toBeNull();
    expect(validateIdentityName("  ", true)).toBe("Enter your name");
    expect(validateIdentityName("  ", false)).toBeNull();
    expect(validateIdentityName("Ann <x>", true)).not.toBeNull();
    expect(validateIdentityName("Ann\nLee", true)).not.toBeNull();
    expect(validateIdentityName("a".repeat(201), true)).toBe("The name is too long");
  });

  it("checks emails lightly", () => {
    expect(validateIdentityEmail("ann@example.com", true)).toBeNull();
    expect(validateIdentityEmail("ann@localhost", true)).toBeNull();
    expect(validateIdentityEmail("", true)).toBe("Enter your email");
    expect(validateIdentityEmail("", false)).toBeNull();
    for (const bad of ["ann", "@example.com", "ann@", "ann lee@example.com", "<ann@example.com>"]) {
      expect(validateIdentityEmail(bad, true), bad).toBe("Not a valid email address");
    }
  });

  it("starts the dialog from what is set, the repository first", () => {
    expect(identityPrefill(null)).toEqual({ name: "", email: "", scope: "global" });
    expect(identityPrefill(identity({ name: null, email: null }, { name: "Ann", email: null }))).toEqual({
      name: "Ann",
      email: "",
      scope: "global",
    });
    expect(identityPrefill(identity({ name: null, email: "work@example.com" }, { name: "Ann", email: "ann@example.com" }))).toEqual({
      name: "Ann",
      email: "work@example.com",
      scope: "local",
    });
  });

  it("labels an identity", () => {
    expect(identityLabel("Ann", "ann@example.com")).toBe("Ann <ann@example.com>");
    expect(identityLabel("Ann", null)).toBe("Ann, no email");
    expect(identityLabel(null, "ann@example.com")).toBe("<ann@example.com>, no name");
    expect(identityLabel(null, null)).toBe("Not set");
  });
});
