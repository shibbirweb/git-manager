// Diff view preferences shared by every DiffView instance, kept in localStorage.

const STORAGE_KEY = "git-manager:diff";

interface DiffPrefsData {
  collapseUnchanged: boolean;
}

function load(): DiffPrefsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<DiffPrefsData>) : {};
    return { collapseUnchanged: parsed.collapseUnchanged ?? true };
  } catch {
    return { collapseUnchanged: true };
  }
}

class DiffPrefs {
  collapseUnchanged = $state(load().collapseUnchanged);

  toggleCollapse(): void {
    this.collapseUnchanged = !this.collapseUnchanged;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ collapseUnchanged: this.collapseUnchanged }));
    } catch {
      // Storage unavailable: keep the in-memory value only.
    }
  }
}

export const diffPrefs = new DiffPrefs();
