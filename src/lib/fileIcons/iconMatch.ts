// Which icon a file name gets from an icon set's type map, matched the way VS Code does it: the
// whole name first, then the longest extension ("app.spec.ts" tries "spec.ts", then "ts").
// The maps themselves are static files (static/file-icons/<set>/map.json), fetched only while
// that set is chosen, so this matcher is the only icon code in the app bundle.

export interface IconMap {
  source: string;
  /** The icon for a file nothing else matches. */
  file: string;
  extensions: Record<string, string>;
  names: Record<string, string>;
  /** Overrides for light themes. */
  lightExtensions: Record<string, string>;
  lightNames: Record<string, string>;
}

function isTable(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function table(value: unknown): Record<string, string> {
  return isTable(value) ? value : {};
}

/** A fetched map with every part defaulted, so a damaged file gives plain icons instead of errors. */
export function normalizeIconMap(value: unknown): IconMap {
  const data = isTable(value) ? (value as Record<string, unknown>) : {};
  return {
    source: typeof data.source === "string" ? data.source : "",
    file: typeof data.file === "string" ? data.file : "",
    extensions: table(data.extensions),
    names: table(data.names),
    lightExtensions: table(data.lightExtensions),
    lightNames: table(data.lightNames),
  };
}

// Own string values only, so a file named "constructor" is not looked up on Object.prototype.
function lookup(entries: Record<string, string>, key: string): string | null {
  const value = Object.hasOwn(entries, key) ? entries[key] : null;
  return typeof value === "string" ? value : null;
}

/** The icon for a file name; `light` picks light-theme variants. */
export function iconFor(map: IconMap, fileName: string, light: boolean): string {
  const name = fileName.toLowerCase();
  const byName = (light ? lookup(map.lightNames, name) : null) ?? lookup(map.names, name);
  if (byName) {
    return byName;
  }
  for (let dot = name.indexOf("."); dot >= 0; dot = name.indexOf(".", dot + 1)) {
    const extension = name.slice(dot + 1);
    if (!extension) {
      break;
    }
    const byExtension = (light ? lookup(map.lightExtensions, extension) : null) ?? lookup(map.extensions, extension);
    if (byExtension) {
      return byExtension;
    }
  }
  return map.file;
}
