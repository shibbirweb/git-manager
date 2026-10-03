// Keyboard shortcuts as data: parsed from menu accelerators ("CmdOrCtrl+Shift+P") or
// CodeMirror keys ("Mod-Shift-d"), matched against key events and written back for the
// menu or for display. Pure, so the Command Palette and custom shortcuts share one notation.

import { formatKeys } from "$lib/help/shortcuts";
import type { MenuPlatform } from "$lib/menu/menuIds";

export interface Keybinding {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** Cmd on macOS, the Windows or Super key elsewhere. */
  meta: boolean;
  /** The physical key, as `KeyboardEvent.code` names it ("KeyP", "Backquote", "ArrowUp", "F7"). */
  code: string;
}

/** The parts of a KeyboardEvent matching needs. */
export interface KeyPress {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Accelerator key names and characters, by their `KeyboardEvent.code`. */
const CODE_FOR_KEY: Record<string, string> = {
  "`": "Backquote",
  "-": "Minus",
  "=": "Equal",
  "[": "BracketLeft",
  "]": "BracketRight",
  "\\": "Backslash",
  ";": "Semicolon",
  "'": "Quote",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  enter: "Enter",
  return: "Enter",
  escape: "Escape",
  esc: "Escape",
  tab: "Tab",
  space: "Space",
  backspace: "Backspace",
  delete: "Delete",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
};

/** The accelerator name of a code, the way menuSpec.ts writes keys. */
const KEY_FOR_CODE: Record<string, string> = {
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

const MODIFIER_CODES = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "OSLeft",
  "OSRight",
]);

/** The code of an accelerator key part ("P", "`", "Up", "F7"), or null when unknown. */
export function codeForKey(keyName: string): string | null {
  if (/^[a-z]$/i.test(keyName)) {
    return `Key${keyName.toUpperCase()}`;
  }
  if (/^[0-9]$/.test(keyName)) {
    return `Digit${keyName}`;
  }
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(keyName)) {
    return keyName.toUpperCase();
  }
  return CODE_FOR_KEY[keyName.toLowerCase()] ?? CODE_FOR_KEY[keyName] ?? null;
}

/** Splits "CmdOrCtrl+Shift+P" or "Mod-Shift-d"; a doubled separator at the end is the key itself ("CmdOrCtrl+-"). */
function splitParts(accelerator: string): string[] {
  const separator = accelerator.includes("+") ? "+" : "-";
  if (accelerator.length > 1 && accelerator.endsWith(`${separator}${separator}`)) {
    return [...accelerator.slice(0, -2).split(separator), separator];
  }
  if (accelerator === separator) {
    return [separator];
  }
  return accelerator.split(separator);
}

/** Reads an accelerator for `platform`; null when it is empty or names an unknown key. */
export function parseAccelerator(accelerator: string, platform: MenuPlatform): Keybinding | null {
  const binding: Keybinding = { ctrl: false, alt: false, shift: false, meta: false, code: "" };
  for (const part of splitParts(accelerator.trim())) {
    switch (part.toLowerCase()) {
      case "cmdorctrl":
      case "commandorcontrol":
      case "mod":
        if (platform === "macos") {
          binding.meta = true;
        } else {
          binding.ctrl = true;
        }
        break;
      case "cmd":
      case "command":
      case "meta":
      case "super":
        binding.meta = true;
        break;
      case "ctrl":
      case "control":
        binding.ctrl = true;
        break;
      case "alt":
      case "option":
        binding.alt = true;
        break;
      case "shift":
        binding.shift = true;
        break;
      default: {
        if (binding.code !== "") {
          return null;
        }
        const code = codeForKey(part);
        if (code === null) {
          return null;
        }
        binding.code = code;
      }
    }
  }
  return binding.code === "" ? null : binding;
}

/** The binding a key press makes; null for a lone modifier. */
export function keybindingFromEvent(event: KeyPress): Keybinding | null {
  if (MODIFIER_CODES.has(event.code) || event.code === "") {
    return null;
  }
  return { ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey, code: event.code };
}

/**
 * Whether a key press is `binding`. Letters match by the typed key so other keyboard layouts
 * work like the menu, except with Option, which changes the typed character on macOS: then
 * (and for every other key) the physical key decides.
 */
export function matchesKeybinding(event: KeyPress, binding: Keybinding): boolean {
  if (
    event.ctrlKey !== binding.ctrl ||
    event.altKey !== binding.alt ||
    event.shiftKey !== binding.shift ||
    event.metaKey !== binding.meta
  ) {
    return false;
  }
  const letter = /^Key([A-Z])$/.exec(binding.code);
  if (letter && !binding.alt && event.key.length === 1) {
    return event.key.toUpperCase() === letter[1];
  }
  return event.code === binding.code;
}

/** Whether a key press is the shortcut written as `accelerator`. */
export function matchesAccelerator(event: KeyPress, accelerator: string, platform: MenuPlatform): boolean {
  const binding = parseAccelerator(accelerator, platform);
  return binding !== null && matchesKeybinding(event, binding);
}

function keyName(code: string): string {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) {
    return letter[1];
  }
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) {
    return digit[1];
  }
  return KEY_FOR_CODE[code] ?? code;
}

/** A binding as a menu accelerator; the platform's main modifier becomes "CmdOrCtrl". */
export function toAccelerator(binding: Keybinding, platform: MenuPlatform): string {
  const mac = platform === "macos";
  const parts: string[] = [];
  if (mac ? binding.meta : binding.ctrl) {
    parts.push("CmdOrCtrl");
  }
  if (mac ? binding.ctrl : binding.meta) {
    parts.push(mac ? "Ctrl" : "Super");
  }
  if (binding.alt) {
    parts.push("Alt");
  }
  if (binding.shift) {
    parts.push("Shift");
  }
  parts.push(keyName(binding.code));
  return parts.join("+");
}

/** An accelerator the way the platform shows keys: "⇧⌘P" on macOS, "Ctrl+Shift+P" elsewhere. */
export function formatAccelerator(accelerator: string, platform: MenuPlatform): string {
  return formatKeys(accelerator, platform);
}

/** Two accelerators press the same keys on `platform` ("CmdOrCtrl+P" and "Cmd+P" on macOS). */
export function sameShortcut(first: string, second: string, platform: MenuPlatform): boolean {
  const a = parseAccelerator(first, platform);
  const b = parseAccelerator(second, platform);
  return a !== null && b !== null && a.code === b.code && a.ctrl === b.ctrl && a.alt === b.alt && a.shift === b.shift && a.meta === b.meta;
}

/** One string per set of keys ("ctrl+shift:KeyP"), so bindings compare and group in maps. */
export function bindingId(binding: Keybinding): string {
  const modifiers = [binding.ctrl ? "ctrl" : "", binding.alt ? "alt" : "", binding.shift ? "shift" : "", binding.meta ? "meta" : ""];
  return `${modifiers.filter(Boolean).join("+")}:${binding.code}`;
}

/** The binding's id on `platform`; null when the accelerator does not parse. */
export function acceleratorId(accelerator: string, platform: MenuPlatform): string | null {
  const binding = parseAccelerator(accelerator, platform);
  return binding ? bindingId(binding) : null;
}

/** CodeMirror's names for the keys whose `KeyboardEvent.key` differs from the accelerator name. */
const CODEMIRROR_KEYS: Record<string, string> = {
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Space: "Space",
};

/** An accelerator in CodeMirror notation for `platform` ("Meta-Shift-k"); null when it does not parse. */
export function codeMirrorKey(accelerator: string, platform: MenuPlatform): string | null {
  const binding = parseAccelerator(accelerator, platform);
  if (!binding) {
    return null;
  }
  const parts: string[] = [];
  if (binding.ctrl) {
    parts.push("Ctrl");
  }
  if (binding.alt) {
    parts.push("Alt");
  }
  if (binding.shift) {
    parts.push("Shift");
  }
  if (binding.meta) {
    parts.push("Meta");
  }
  const name = CODEMIRROR_KEYS[binding.code] ?? keyName(binding.code);
  parts.push(/^[A-Z]$/.test(name) ? name.toLowerCase() : name);
  return parts.join("-");
}
