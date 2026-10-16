// Diff view preferences shared by every DiffView instance, kept in localStorage. The pane counts live in settings.json
// (settings.changesDiffPanes, settings.mergeDiffPanes) because Settings > Git shows them.

const STORAGE_KEY = "git-manager:diff";

interface DiffPrefsData {
  collapseUnchanged: boolean;
}

function load(): DiffPrefsData {
  const fallback: DiffPrefsData = { collapseUnchanged: true };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<DiffPrefsData>) : {};
    return {
      collapseUnchanged:
        typeof parsed.collapseUnchanged === "boolean" ? parsed.collapseUnchanged : fallback.collapseUnchanged,
    };
  } catch {
    return fallback;
  }
}

class DiffPrefs {
  #loaded = load();
  collapseUnchanged = $state(this.#loaded.collapseUnchanged);

  toggleCollapse(): void {
    this.collapseUnchanged = !this.collapseUnchanged;
    this.#save();
  }

  #save(): void {
    try {
      const data: DiffPrefsData = { collapseUnchanged: this.collapseUnchanged };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable: keep the in-memory values only.
    }
  }
}

export const diffPrefs = new DiffPrefs();
