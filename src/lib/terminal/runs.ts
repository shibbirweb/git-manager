// Run sessions, like JetBrains' Run window: a script started as its own process (no shell),
// shown in the bottom panel's Run tab with Rerun and Stop. They reuse the terminal's xterm
// view and PTY backend, so colors, progress bars and input work as in a terminal.

/** What a run starts. Kept on the session, so Rerun starts the same thing again. */
export interface RunSpec {
  /** One session per script: running it again reuses its tab. */
  runId: string;
  /** The tool, looked up on the login shell's PATH: "pnpm", "composer"... */
  program: string;
  args: string[];
  cwd: string;
  /** A Node version's bin folder, put first on the process's PATH. */
  nodeBinDir: string | null;
  /** Shown above the output: the command and, for Node, the version. */
  description: string;
}

/** Written above a run's output, dimmed, like the command line JetBrains prints. */
export function runHeader(spec: RunSpec): string {
  return `\x1b[2m${spec.description}\x1b[0m\r\n\r\n`;
}

/** Written after a run's output. */
export function runFinishedMessage(exitCode: number | null): string {
  const text = exitCode === null ? "Process stopped" : `Process finished with exit code ${exitCode}`;
  return `\r\n\x1b[2m${text}\x1b[0m\r\n`;
}

/** The session the Run tab shows after `closedKey` closes: its right neighbor, else its left. */
export function runAfterClose(runKeys: number[], closedKey: number, activeKey: number | null): number | null {
  const remaining = runKeys.filter((runKey) => runKey !== closedKey);
  if (remaining.length === 0) {
    return null;
  }
  if (activeKey !== closedKey && activeKey !== null && remaining.includes(activeKey)) {
    return activeKey;
  }
  const index = runKeys.indexOf(closedKey);
  return remaining[Math.min(Math.max(index, 0), remaining.length - 1)];
}
