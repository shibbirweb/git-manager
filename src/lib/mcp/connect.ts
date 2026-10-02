// What Settings > Automation shows for connecting tools: the Claude Code command, a JSON
// config for other harnesses and example `git-manager cli` commands.

import { shellQuote } from "$lib/scripts/scriptsModel";
import type { McpStatus } from "$lib/types";

export const MCP_SERVER_NAME = "git-manager";

/** The line that puts ~/.local/bin on PATH, for ~/.zshrc. */
export const LOCAL_BIN_PATH_LINE = 'export PATH="$HOME/.local/bin:$PATH"';

export function claudeAddCommand(url: string, token: string): string {
  return `claude mcp add --transport http ${MCP_SERVER_NAME} ${url} --header "Authorization: Bearer ${token}"`;
}

/** The `mcpServers` block most harnesses (Cursor, Claude Desktop with a bridge, VS Code...) read. */
export function mcpJsonConfig(url: string, token: string): string {
  const config = {
    mcpServers: {
      [MCP_SERVER_NAME]: {
        type: "http",
        url,
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  };
  return JSON.stringify(config, null, 2);
}

/** Dots instead of the token, keeping its length readable. */
export function maskToken(token: string): string {
  return "•".repeat(Math.min(token.length, 24));
}

/**
 * How to start the command line tool: `git-manager cli` once it is installed, else the full
 * binary path (quoted for the shell, since the app may live in a folder with spaces).
 */
export function cliPrefix(status: Pick<McpStatus, "cliCommand" | "cliInstalledPath" | "cliOnPath">): string {
  if (status.cliInstalledPath && status.cliOnPath) {
    return "git-manager cli";
  }
  if (status.cliInstalledPath) {
    return `${shellQuote(status.cliInstalledPath)} cli`;
  }
  const binary = status.cliCommand.replace(/\s+cli$/, "");
  return binary ? `${shellQuote(binary)} cli` : "git-manager cli";
}

export function cliExamples(prefix: string): { command: string; hint: string }[] {
  return [
    { command: `${prefix} status`, hint: "Is the app running and the server on?" },
    { command: `${prefix} tools`, hint: "Every tool that is on, with its arguments." },
    { command: `${prefix} call get_app_state`, hint: "Call one tool; arguments go as name=value." },
    { command: `${prefix} screenshot ~/Desktop/gm.png`, hint: "Save a picture of the window." },
  ];
}
