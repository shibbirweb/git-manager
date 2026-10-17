import { describe, expect, it } from "vitest";
import { claudeAddCommand, cliExamples, cliPrefix, maskToken, mcpJsonConfig } from "./connect";

const url = "http://127.0.0.1:48731/mcp";

describe("connecting tools", () => {
  it("builds the Claude Code command", () => {
    expect(claudeAddCommand(url, "abc")).toBe(
      'claude mcp add --transport http nibtree http://127.0.0.1:48731/mcp --header "Authorization: Bearer abc"',
    );
  });

  it("builds a JSON config with the token header", () => {
    const config = JSON.parse(mcpJsonConfig(url, "abc"));
    expect(config).toEqual({
      mcpServers: { nibtree: { type: "http", url, headers: { Authorization: "Bearer abc" } } },
    });
  });

  it("hides the token", () => {
    expect(maskToken("abcdef")).toBe("\u2022".repeat(6));
    expect(maskToken("a".repeat(64))).toHaveLength(24);
  });
});

describe("cliPrefix", () => {
  // A folder with a space, so the path needs quotes.
  const binary = "/Users/me/My Apps/Nibtree.app/Contents/MacOS/nibtree";

  it("uses the short name once installed on PATH", () => {
    expect(
      cliPrefix(
        { cliCommand: `${binary} cli`, cliInstalledPath: "/Users/me/.local/bin/nibtree", cliOnPath: true },
        false,
      ),
    ).toBe("nibtree cli");
  });

  it("uses the link's full path when its folder is not on PATH", () => {
    expect(
      cliPrefix(
        { cliCommand: `${binary} cli`, cliInstalledPath: "/Users/me/.local/bin/nibtree", cliOnPath: false },
        false,
      ),
    ).toBe("/Users/me/.local/bin/nibtree cli");
  });

  it("quotes the app's own path when it is not installed", () => {
    expect(cliPrefix({ cliCommand: `${binary} cli`, cliInstalledPath: null, cliOnPath: true }, false)).toBe(
      `'${binary}' cli`,
    );
    expect(cliPrefix({ cliCommand: "", cliInstalledPath: null, cliOnPath: false }, false)).toBe("nibtree cli");
  });

  it("writes Windows paths for PowerShell", () => {
    const windowsBinary = "C:/Users/me/AppData/Local/Nibtree/nibtree-cli.exe";
    expect(cliPrefix({ cliCommand: `${windowsBinary} cli`, cliInstalledPath: null, cliOnPath: true }, true)).toBe(
      `& "${windowsBinary}" cli`,
    );
    const shim = "C:/Users/me/AppData/Local/Microsoft/WindowsApps/nibtree.cmd";
    expect(cliPrefix({ cliCommand: `${windowsBinary} cli`, cliInstalledPath: shim, cliOnPath: false }, true)).toBe(
      `& "${shim}" cli`,
    );
    expect(cliPrefix({ cliCommand: `${windowsBinary} cli`, cliInstalledPath: shim, cliOnPath: true }, true)).toBe(
      "nibtree cli",
    );
    expect(cliExamples("nibtree cli", true).at(-1)?.command).toBe("nibtree cli screenshot $HOME\\Desktop\\gm.png");
  });

  it("gives the examples with that prefix", () => {
    const commands = cliExamples("nibtree cli", false).map((example) => example.command);
    expect(commands).toEqual([
      "nibtree cli status",
      "nibtree cli tools",
      "nibtree cli call get_app_state",
      "nibtree cli screenshot ~/Desktop/gm.png",
    ]);
  });
});
