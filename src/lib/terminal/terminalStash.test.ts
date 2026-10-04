import { describe, expect, it } from "vitest";
import {
  describeLayout,
  describeTerminal,
  fittedLayout,
  parseDescriptor,
  parseLayout,
  restoredTerminals,
  type TerminalDescriptor,
  type TerminalLayout,
} from "./terminalStash";

const shell: TerminalDescriptor = {
  key: 3,
  name: "zsh",
  renamed: false,
  shellId: null,
  cwd: "/work/app",
  exited: false,
  exitCode: null,
  location: "panel",
  run: null,
  group: 2,
  bell: false,
};

const run: TerminalDescriptor = {
  ...shell,
  key: 5,
  name: "dev",
  location: "run",
  run: { runId: "npm:dev", program: "npm", args: ["run", "dev"], cwd: "/work/app", nodeBinDir: null, description: "npm run dev" },
  group: 4,
};

const layout: TerminalLayout = {
  activeKey: 3,
  runActiveKey: 5,
  panelOpen: true,
  panelTab: "run",
  started: true,
  groupSizes: { 2: [0.4, 0.6] },
};

describe("terminal descriptors", () => {
  it("round-trip shells and runs", () => {
    expect(parseDescriptor(describeTerminal(shell))).toEqual(shell);
    expect(parseDescriptor(describeTerminal(run))).toEqual(run);
    expect(parseDescriptor(describeTerminal({ ...shell, location: "editor", renamed: true, exited: true, exitCode: 2 }))).toEqual({
      ...shell,
      location: "editor",
      renamed: true,
      exited: true,
      exitCode: 2,
    });
  });

  it("refuse what cannot be rebuilt", () => {
    expect(parseDescriptor("not json")).toBeNull();
    expect(parseDescriptor(JSON.stringify({ ...shell, key: 0 }))).toBeNull();
    expect(parseDescriptor(JSON.stringify({ ...shell, location: "sidebar" }))).toBeNull();
    expect(parseDescriptor(JSON.stringify({ ...shell, name: 4 }))).toBeNull();
    expect(parseDescriptor(JSON.stringify({ ...run, run: { program: "npm" } }))).toBeNull();
  });
});

describe("the panel layout", () => {
  it("round-trips and falls back to a closed panel", () => {
    expect(parseLayout(describeLayout(layout))).toEqual(layout);
    expect(parseLayout("{}")).toEqual({
      activeKey: null,
      runActiveKey: null,
      panelOpen: false,
      panelTab: "terminal",
      started: false,
      groupSizes: {},
    });
    expect(parseLayout(JSON.stringify({ ...layout, panelTab: "nope", groupSizes: { 2: [3] } })).panelTab).toBe("terminal");
    expect(parseLayout(JSON.stringify({ ...layout, groupSizes: { 2: [3] } })).groupSizes).toEqual({});
  });

  it("only shows terminals that came back", () => {
    const { terminals } = restoredTerminals({
      layout: "",
      terminals: [{ terminalId: 11, descriptor: describeTerminal({ ...shell, key: 8 }), snapshot: "" }],
    });
    expect(fittedLayout({ ...layout, started: false }, terminals)).toEqual({ ...layout, activeKey: 8, runActiveKey: null, started: true });
  });
});

describe("restoredTerminals", () => {
  it("keeps order, live shells and screens, and drops what cannot come back", () => {
    const result = restoredTerminals({
      layout: describeLayout(layout),
      terminals: [
        { terminalId: 21, descriptor: describeTerminal(shell), snapshot: "$ ls" },
        { terminalId: 22, descriptor: "broken", snapshot: "" },
        { terminalId: 23, descriptor: describeTerminal(shell), snapshot: "duplicate key" },
        { terminalId: null, descriptor: describeTerminal({ ...run, exited: true, exitCode: 1 }), snapshot: "failed" },
      ],
    });
    expect(result.dropped).toEqual([22, 23]);
    expect(result.terminals.map((terminal) => [terminal.descriptor.key, terminal.terminalId, terminal.snapshot])).toEqual([
      [3, 21, "$ ls"],
      [5, null, "failed"],
    ]);
  });
});
