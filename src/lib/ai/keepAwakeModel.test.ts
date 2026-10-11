import { describe, expect, it } from "vitest";
import { AWAKE_MODES, lidNote, modeLabel, statusText, wantsAwake } from "./keepAwakeModel";

describe("wantsAwake", () => {
  it("holds the computer awake always when On, never when Off", () => {
    expect(wantsAwake("on", [])).toBe(true);
    expect(wantsAwake("off", ["working", "working"])).toBe(false);
  });

  it("holds it in Agent mode only while an agent starts or works", () => {
    expect(wantsAwake("agent", [])).toBe(false);
    expect(wantsAwake("agent", ["ready", "done", "waiting", "exited"])).toBe(false);
    expect(wantsAwake("agent", ["done", "working"])).toBe(true);
    expect(wantsAwake("agent", ["starting"])).toBe(true);
  });
});

describe("words", () => {
  it("follow Orca's", () => {
    expect(AWAKE_MODES.map((mode) => [mode.label, mode.description])).toEqual([
      ["On", "Keep this computer awake continuously"],
      ["Agent", "Stay awake while an agent is working"],
      ["Off", "Allow normal system sleep behavior"],
    ]);
    expect(modeLabel("agent")).toBe("Agent");
    expect(statusText("agent", true)).toBe("Agent · Active");
    expect(statusText("off", false)).toBe("Off · Inactive");
  });

  it("say what a closed lid does on each system", () => {
    expect(lidNote("macOS")).toContain("closing the lid still puts this Mac to sleep");
    expect(lidNote("Windows")).toContain("power settings");
    expect(lidNote("Linux")).toContain("systemd-inhibit");
  });
});
