import { describe, expect, it } from "vitest";
import { claudeAddCommand, cliExamples, cliPrefix, maskToken, mcpJsonConfig } from "./connect";

const url = "http://127.0.0.1:48731/mcp";

describe("connecting tools", () => {
  it("builds the Claude Code command", () => {
    expect(claudeAddCommand(url, "abc")).toBe(
      'claude mcp add --transport http git-manager http://127.0.0.1:48731/mcp --header "Authorization: Bearer abc"',
    );
  });

  it("builds a JSON config with the token header", () => {
    const config = JSON.parse(mcpJsonConfig(url, "abc"));
    expect(config).toEqual({
      mcpServers: { "git-manager": { type: "http", url, headers: { Authorization: "Bearer abc" } } },
    });
  });

  it("hides the token", () => {
    expect(maskToken("abcdef")).toBe("\u2022".repeat(6));
    expect(maskToken("a".repeat(64))).toHaveLength(24);
  });
});

describe("cliPrefix", () => {
  const binary = "/Applications/Git Manager.app/Contents/MacOS/git-manager";

  it("uses the short name once installed on PATH", () => {
    expect(cliPrefix({ cliCommand: `${binary} cli`, cliInstalledPath: "/Users/me/.local/bin/git-manager", cliOnPath: true })).toBe(
      "git-manager cli",
    );
  });

  it("uses the link's full path when its folder is not on PATH", () => {
    expect(cliPrefix({ cliCommand: `${binary} cli`, cliInstalledPath: "/Users/me/.local/bin/git-manager", cliOnPath: false })).toBe(
      "/Users/me/.local/bin/git-manager cli",
    );
  });

  it("quotes the app's own path when it is not installed", () => {
    expect(cliPrefix({ cliCommand: `${binary} cli`, cliInstalledPath: null, cliOnPath: true })).toBe(`'${binary}' cli`);
    expect(cliPrefix({ cliCommand: "", cliInstalledPath: null, cliOnPath: false })).toBe("git-manager cli");
  });

  it("gives the examples with that prefix", () => {
    const commands = cliExamples("git-manager cli").map((example) => example.command);
    expect(commands).toEqual([
      "git-manager cli status",
      "git-manager cli tools",
      "git-manager cli call get_app_state",
      "git-manager cli screenshot ~/Desktop/gm.png",
    ]);
  });
});
