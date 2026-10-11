// Keep computer awake, like Orca: Off, Agent (awake while an agent works) or On. When to hold the computer awake and
// the words the status bar and Settings use, which follow Orca's. Pure, so it is tested directly.

import type { ComputerAwakeMode } from "$lib/stores/settingsData";
import type { AgentState } from "./projects";

export const AWAKE_TITLE = "Keep computer awake";

/** The modes in Orca's order, with its labels and descriptions. */
export const AWAKE_MODES: readonly { value: ComputerAwakeMode; label: string; description: string }[] = [
  { value: "on", label: "On", description: "Keep this computer awake continuously" },
  { value: "agent", label: "Agent", description: "Stay awake while an agent is working" },
  { value: "off", label: "Off", description: "Allow normal system sleep behavior" },
];

export function modeLabel(mode: ComputerAwakeMode): string {
  return AWAKE_MODES.find((choice) => choice.value === mode)?.label ?? "Off";
}

/** An agent at work keeps the computer awake in Agent mode; one that waits for the user or has finished does not. */
function working(state: AgentState): boolean {
  return state === "working" || state === "starting";
}

/** Whether the computer should be held awake now. */
export function wantsAwake(mode: ComputerAwakeMode, agentStates: readonly AgentState[]): boolean {
  return mode === "on" || (mode === "agent" && agentStates.some(working));
}

/** "Agent · Active", as Orca's menu and tooltip put it. */
export function statusText(mode: ComputerAwakeMode, active: boolean): string {
  return `${modeLabel(mode)} · ${active ? "Active" : "Inactive"}`;
}

/** What a closed lid does, per system (Orca's notes, with ours: the display stays on too). */
export function lidNote(platform: "macOS" | "Windows" | "Linux" | string): string {
  if (platform === "macOS") {
    return "Keeps the screen on and stops idle sleep and the screen lock while the lid is open; closing the lid still puts this Mac to sleep.";
  }
  if (platform === "Windows") {
    return "Keeps the screen on and stops idle sleep and the screen lock; lid-close behavior follows this device's power settings.";
  }
  return "Stops idle sleep while active, through systemd-inhibit; lid-close behavior follows this device's power settings.";
}
