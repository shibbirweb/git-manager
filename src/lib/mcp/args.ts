// Reading the arguments of a UI tool call. The server checks nothing for UI tools, so every
// value is validated here and a bad one becomes a plain error the agent can act on.

import { fromNativePath, isAbsolutePath } from "$lib/stores/workspacePaths";

export class ToolArgError extends Error {}

export type ToolArgs = Record<string, unknown>;

/** The call's arguments as an object; anything else counts as no arguments. */
export function toolArgs(value: unknown): ToolArgs {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ToolArgs) : {};
}

export function optionalString(args: ToolArgs, key: string, maxLength = 4096): string | null {
  const value = args[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ToolArgError(`"${key}" must be a string`);
  }
  if (value.length > maxLength) {
    throw new ToolArgError(`"${key}" is longer than ${maxLength} characters`);
  }
  return value;
}

export function requiredString(args: ToolArgs, key: string, maxLength = 4096): string {
  const value = optionalString(args, key, maxLength);
  if (value === null || value === "") {
    throw new ToolArgError(`"${key}" is required`);
  }
  return value;
}

export function optionalInteger(args: ToolArgs, key: string, min: number, max: number): number | null {
  const value = args[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ToolArgError(`"${key}" must be a whole number`);
  }
  if (value < min || value > max) {
    throw new ToolArgError(`"${key}" must be between ${min} and ${max}`);
  }
  return value;
}

export function requiredInteger(args: ToolArgs, key: string, min: number, max: number): number {
  const value = optionalInteger(args, key, min, max);
  if (value === null) {
    throw new ToolArgError(`"${key}" is required`);
  }
  return value;
}

export function optionalBoolean(args: ToolArgs, key: string): boolean | null {
  const value = args[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "boolean") {
    throw new ToolArgError(`"${key}" must be true or false`);
  }
  return value;
}

export function optionalEnum<T extends string>(args: ToolArgs, key: string, allowed: readonly T[]): T | null {
  const value = args[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ToolArgError(`"${key}" must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

export function requiredEnum<T extends string>(args: ToolArgs, key: string, allowed: readonly T[]): T {
  const value = optionalEnum(args, key, allowed);
  if (value === null) {
    throw new ToolArgError(`"${key}" is required (one of: ${allowed.join(", ")})`);
  }
  return value;
}

/**
 * An absolute path with "/" separators and no "." or ".." parts, so a prefix check
 * against the workspace folders cannot be walked around. A trailing "/" is dropped.
 * On Windows a drive path is taken too, with backslashes turned into "/" first.
 */
export function normalizeAbsolutePath(value: string, key: string, windows?: boolean): string {
  const path = fromNativePath(value, windows);
  if (!isAbsolutePath(path) || path.includes("\0") || path.includes("\\")) {
    throw new ToolArgError(`"${key}" must be an absolute path`);
  }
  const root = /^[A-Za-z]:\//.test(path) ? path.slice(0, 3) : "/";
  const rest = path.slice(root.length);
  if (rest.split("/").some((part) => part === "." || part === "..")) {
    throw new ToolArgError(`"${key}" must not contain "." or ".." parts`);
  }
  return `${root}${rest.replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "")}`;
}

export function optionalPath(args: ToolArgs, key: string): string | null {
  const value = optionalString(args, key);
  return value === null || value === "" ? null : normalizeAbsolutePath(value, key);
}

export function requiredPath(args: ToolArgs, key: string): string {
  return normalizeAbsolutePath(requiredString(args, key), key);
}

/** Cuts long text, saying how much was left out, so a result stays a sensible size. */
export function capText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxChars), truncated: true };
}
