// Names typed into New File, New Folder and Rename. The backend checks them again; these
// checks only make the dialog explain a problem before the user presses the button. Both
// follow the rule table in nameRules.cases.json, which the tests on each side read.

/** File systems limit one name to 255 bytes (UTF-8), not 255 characters. */
export const MAX_NAME_BYTES = 255;

/** The length of a name as the file system counts it. */
export function nameBytes(name: string): number {
  return new TextEncoder().encode(name).length;
}

export interface NameRules {
  /** New File and New Folder accept "folder/file.ts" and create the folders on the way. */
  nested: boolean;
  /** Names already in the folder. */
  taken: ReadonlySet<string>;
  /** The folder, as the message names it ("src", "storefront"). */
  folderLabel: string;
  /** Rename: the current name, which may stay as it is. */
  current?: string;
  /** macOS and Windows see "Cart.ts" and "cart.ts" as one name, so a taken name is matched without case. */
  ignoreCase?: boolean;
}

function partProblem(part: string): string | null {
  if (part === "." || part === "..") {
    return `"${part}" is not a valid name`;
  }
  if (part.includes("\0")) {
    return "A name cannot contain a null character";
  }
  if (nameBytes(part) > MAX_NAME_BYTES) {
    return "The name is too long";
  }
  return null;
}

/** Why `value` cannot be used, or null when it can. */
export function nameProblem(value: string, rules: NameRules): string | null {
  const name = value.trim();
  if (name === "") {
    return "Enter a name";
  }
  if (rules.current !== undefined && name === rules.current) {
    return null;
  }
  if (!rules.nested && name.includes("/")) {
    return "A name cannot contain /";
  }
  const parts = name.split("/");
  if (parts.some((part) => part.trim() === "")) {
    return "Each part between slashes needs a name";
  }
  for (const part of parts) {
    const problem = partProblem(part);
    if (problem) {
      return problem;
    }
  }
  // "lib/x.ts" may go into an existing "lib"; only a whole name that is there already clashes.
  const existing = parts.length === 1 ? takenName(name, rules) : null;
  if (existing !== null) {
    return `${existing} already exists in ${rules.folderLabel}`;
  }
  return null;
}

/** The entry already in the folder that `name` would clash with; a case change of the current name is a rename. */
function takenName(name: string, rules: NameRules): string | null {
  if (rules.taken.has(name)) {
    return name;
  }
  if (!rules.ignoreCase) {
    return null;
  }
  const folded = name.toLowerCase();
  for (const taken of rules.taken) {
    if (taken !== rules.current && taken.toLowerCase() === folded) {
      return taken;
    }
  }
  return null;
}

/**
 * What Rename selects at first: the name without its extension ("cart" of "cart.ts",
 * "archive.tar" of "archive.tar.gz"), the whole name for folders and dot files.
 */
export function renameSelection(name: string, isDir: boolean): [number, number] {
  const dot = name.lastIndexOf(".");
  if (isDir || dot <= 0) {
    return [0, name.length];
  }
  return [0, dot];
}
