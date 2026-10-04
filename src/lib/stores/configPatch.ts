// Config files written by several windows: each window sends only what it changed since it
// last wrote or heard of the file, as a list of values set and keys removed by key path. The
// backend applies that to the file as it is on disk (src-tauri/src/config.rs), so a window
// never writes back another window's older values, and tells the other windows, which apply
// the same patch on top of their own unsaved changes. Pure, so it is tested.

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface PatchSet {
  path: string[];
  value: JsonValue;
}

/** Mirrors `ConfigPatch` in src-tauri/src/config.rs. */
export interface ConfigPatch {
  set: PatchSet[];
  remove: string[][];
}

export const EMPTY_PATCH: ConfigPatch = { set: [], remove: [] };

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

/** A copy that shares nothing with `value`, through JSON (undefined and functions drop out). */
export function cloneJson<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export function isEmptyPatch(patch: ConfigPatch): boolean {
  return patch.set.length === 0 && patch.remove.length === 0;
}

/**
 * What changed from `base` to `next`: objects on both sides are compared key by key (so two
 * windows changing different entries of `openTabs` keep both); anything else is set whole.
 */
export function diffJson(base: JsonObject, next: JsonObject): ConfigPatch {
  const patch: ConfigPatch = { set: [], remove: [] };
  const walk = (before: JsonObject, after: JsonObject, path: string[]) => {
    for (const key of Object.keys(before)) {
      if (!(key in after) || after[key] === undefined) {
        patch.remove.push([...path, key]);
      }
    }
    for (const [key, value] of Object.entries(after)) {
      if (value === undefined) {
        continue;
      }
      const previous = before[key];
      if (sameJson(previous, value)) {
        continue;
      }
      if (isPlainObject(previous) && isPlainObject(value)) {
        walk(previous, value, [...path, key]);
      } else {
        patch.set.push({ path: [...path, key], value: cloneJson(value) });
      }
    }
  };
  walk(base, next, []);
  return patch;
}

/** `value` with `patch` applied (removals first, then sets), as the backend applies it. Never changes `value`. */
export function applyPatch(value: JsonObject, patch: ConfigPatch): JsonObject {
  const result = cloneJson(value);
  for (const path of patch.remove) {
    let current: JsonValue = result;
    for (const key of path.slice(0, -1)) {
      current = isPlainObject(current) ? current[key] : null;
    }
    const last = path[path.length - 1];
    if (last !== undefined && isPlainObject(current)) {
      delete current[last];
    }
  }
  for (const { path, value: setValue } of patch.set) {
    if (path.length === 0) {
      if (isPlainObject(setValue)) {
        for (const key of Object.keys(result)) {
          delete result[key];
        }
        Object.assign(result, cloneJson(setValue));
      }
      continue;
    }
    let current: JsonObject = result;
    for (const key of path.slice(0, -1)) {
      const next = current[key];
      if (!isPlainObject(next)) {
        current[key] = {};
      }
      current = current[key] as JsonObject;
    }
    current[path[path.length - 1]] = cloneJson(setValue);
  }
  return result;
}

/** The patch without changes under these top-level keys. */
export function withoutKeys(patch: ConfigPatch, keys: readonly string[]): ConfigPatch {
  const kept = (path: string[]) => path.length === 0 || !keys.includes(path[0]);
  return {
    set: patch.set.filter((entry) => kept(entry.path)),
    remove: patch.remove.filter(kept),
  };
}

/**
 * Another window changed the file. `base` is what this window last wrote or heard of, `local`
 * what it holds now (with changes not written yet). Returns the new base (the incoming patch
 * applied) and the new local value: the incoming patch with this window's own unsaved
 * changes on top, so they still win when they are written a moment later.
 */
export function rebaseIncoming(
  base: JsonObject,
  local: JsonObject,
  incoming: ConfigPatch,
): { base: JsonObject; local: JsonObject } {
  const pending = diffJson(base, local);
  const nextBase = applyPatch(base, incoming);
  return { base: nextBase, local: applyPatch(nextBase, pending) };
}

/** Reads a patch from an event payload; anything malformed is left out. */
export function parsePatch(value: unknown): ConfigPatch {
  const data = isPlainObject(value) ? value : {};
  const isPath = (path: unknown): path is string[] =>
    Array.isArray(path) && path.every((key) => typeof key === "string");
  const set = Array.isArray(data.set)
    ? data.set
        .filter((entry): entry is { path: string[]; value: JsonValue } => isPlainObject(entry) && isPath(entry.path) && "value" in entry)
        .map((entry) => ({ path: entry.path, value: entry.value }))
    : [];
  const remove = Array.isArray(data.remove) ? data.remove.filter(isPath) : [];
  return { set, remove };
}
