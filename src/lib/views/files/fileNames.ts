// Names typed into New File, New Folder and Rename. The backend checks them again; these
// checks only make the dialog explain a problem before the user presses the button.

/** File systems limit one name to 255 bytes. */
const MAX_NAME_BYTES = 255;

export interface NameRules {
  /** New File and New Folder accept "folder/file.ts" and create the folders on the way. */
  nested: boolean;
  /** Names already in the folder. */
  taken: ReadonlySet<string>;
  /** The folder, as the message names it ("src", "storefront"). */
  folderLabel: string;
  /** Rename: the current name, which may stay as it is. */
  current?: string;
}

function partProblem(part: string): string | null {
  if (part === "." || part === "..") {
    return `"${part}" is not a valid name`;
  }
  if (part.includes("\0")) {
    return "A name cannot contain a null character";
  }
  if (new TextEncoder().encode(part).length > MAX_NAME_BYTES) {
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
  if (parts.some((part) => part === "")) {
    return "Each part between slashes needs a name";
  }
  for (const part of parts) {
    const problem = partProblem(part);
    if (problem) {
      return problem;
    }
  }
  // "lib/x.ts" may go into an existing "lib"; only a whole name that is there already clashes.
  if (parts.length === 1 && rules.taken.has(name)) {
    return `${name} already exists in ${rules.folderLabel}`;
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
