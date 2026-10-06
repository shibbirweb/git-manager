import { describe, expect, it } from "vitest";
import { folderLabel, parsePrompt, REMEMBER_MS, rememberedPassword } from "./askpassPrompt";

describe("parsePrompt", () => {
  it("reads git's username and password prompts", () => {
    expect(parsePrompt("Username for 'https://github.com': ")).toMatchObject({ kind: "username", host: "github.com", user: null, secret: false });
    expect(parsePrompt("Password for 'https://octocat@github.com': ")).toMatchObject({
      kind: "password",
      host: "github.com",
      user: "octocat",
      secret: true,
    });
    expect(parsePrompt("Username for 'https://gitlab.example.com:8443': ").host).toBe("gitlab.example.com:8443");
    expect(parsePrompt("Password for 'https://me%40work.com@dev.azure.com': ").user).toBe("me@work.com");
  });

  it("reads ssh's passphrase, password and new host prompts", () => {
    expect(parsePrompt("Enter passphrase for key '/Users/me/.ssh/id_ed25519': ")).toMatchObject({
      kind: "passphrase",
      keyPath: "/Users/me/.ssh/id_ed25519",
      secret: true,
    });
    expect(parsePrompt("git@example.com's password: ")).toMatchObject({ kind: "password", user: "git", host: "example.com" });
    const hostKey = parsePrompt(
      "The authenticity of host 'github.com (140.82.121.4)' can't be established.\nED25519 key fingerprint is SHA256:abc.\n" +
        "Are you sure you want to continue connecting (yes/no/[fingerprint])? ",
    );
    expect(hostKey).toMatchObject({ kind: "confirm", host: "github.com", secret: false });
  });

  it("hides the answer of other secret prompts", () => {
    expect(parsePrompt("Enter PIN for 'YubiKey': ")).toMatchObject({ kind: "other", secret: true });
    expect(parsePrompt("Which remote? ")).toMatchObject({ kind: "other", secret: false, text: "Which remote?" });
  });
});

describe("folderLabel", () => {
  it("takes the last part of a path", () => {
    expect(folderLabel("/Users/me/code/storefront")).toBe("storefront");
    expect(folderLabel("C:/code/shop/")).toBe("shop");
    expect(folderLabel("")).toBe("");
  });
});

describe("rememberedPassword", () => {
  const remembered = { host: "github.com", user: "octocat", password: "token", until: 1000 + REMEMBER_MS };
  const asked = parsePrompt("Password for 'https://octocat@github.com': ");

  it("answers git's password question for the same server and user", () => {
    expect(rememberedPassword(remembered, asked, 1000)).toBe("token");
  });

  it("keeps it to itself for another server, another user, another question or too late", () => {
    expect(rememberedPassword(remembered, parsePrompt("Password for 'https://octocat@gitlab.com': "), 1000)).toBeNull();
    expect(rememberedPassword(remembered, parsePrompt("Password for 'https://someone@github.com': "), 1000)).toBeNull();
    expect(rememberedPassword(remembered, parsePrompt("Username for 'https://github.com': "), 1000)).toBeNull();
    expect(rememberedPassword(remembered, asked, 2000 + REMEMBER_MS)).toBeNull();
    expect(rememberedPassword(null, asked, 1000)).toBeNull();
  });
});
