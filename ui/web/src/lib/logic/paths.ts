// Absolute paths in the page's form: "/" separators on every platform ("C:/Users/me" on Windows), so a path never
// needs the platform's own separator. The app's workspace mapping (src/lib/stores/workspacePaths.ts) builds on these.

const DRIVE_ROOT = /^[A-Za-z]:\//;
const UNC_ROOT = /^\/\/[^/]+\/[^/]+(\/|$)/;

export function onWindows(): boolean {
  return typeof navigator !== "undefined" && /Windows/.test(navigator.userAgent);
}

/** A path from the system (a dialog, a drop) in the page's form: on Windows "/" separators and an upper case drive. */
export function fromNativePath(nativePath: string, windows = onWindows()): string {
  if (!windows) {
    return nativePath;
  }
  const slashed = nativePath.replace(/\\/g, "/");
  return /^[a-z]:\//.test(slashed) ? `${slashed[0].toUpperCase()}${slashed.slice(1)}` : slashed;
}

/** "/x", "C:/x" or "//server/share/x". */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || DRIVE_ROOT.test(path);
}

/** The part of an absolute path ".." never goes above: "/", "C:/" or (on Windows) "//server/share/". */
export function rootOf(absolute: string, windows = onWindows()): string {
  if (DRIVE_ROOT.test(absolute)) {
    return absolute.slice(0, 3);
  }
  const unc = windows ? UNC_ROOT.exec(absolute) : null;
  if (unc) {
    return unc[0].endsWith("/") ? unc[0] : `${unc[0]}/`;
  }
  return "/";
}

export function joinPath(root: string, relative: string): string {
  if (!relative) {
    return root;
  }
  return root.endsWith("/") ? `${root}${relative}` : `${root}/${relative}`;
}

export function parentOf(absolute: string): string {
  const root = rootOf(absolute);
  const slash = absolute.lastIndexOf("/");
  return slash < root.length ? root : absolute.slice(0, slash);
}

export function baseName(absolute: string): string {
  return absolute.slice(absolute.lastIndexOf("/") + 1);
}

/** Resolves "." and ".." segments and repeated slashes of an absolute path; ".." never goes above its root. */
export function normalizePath(absolute: string): string {
  const root = rootOf(absolute);
  const parts: string[] = [];
  for (const part of absolute.slice(root.length).split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return `${root}${parts.join("/")}`;
}
