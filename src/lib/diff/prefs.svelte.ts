// Diff view preferences shared by every DiffView instance, kept in localStorage.

const STORAGE_KEY = "git-manager:diff";

interface DiffPrefsData {
  collapseUnchanged: boolean;
  /** A merge commit's file changed on both sides shows three panes (parent 1, result, parent 2). */
  threePanes: boolean;
  /** The Changes diff shows three panes: HEAD, the index and the work tree. */
  stagingThreePanes: boolean;
}

function load(): DiffPrefsData {
  const fallback: DiffPrefsData = { collapseUnchanged: true, threePanes: true, stagingThreePanes: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<DiffPrefsData>) : {};
    return {
      collapseUnchanged:
        typeof parsed.collapseUnchanged === "boolean" ? parsed.collapseUnchanged : fallback.collapseUnchanged,
      threePanes: typeof parsed.threePanes === "boolean" ? parsed.threePanes : fallback.threePanes,
      stagingThreePanes:
        typeof parsed.stagingThreePanes === "boolean" ? parsed.stagingThreePanes : fallback.stagingThreePanes,
    };
  } catch {
    return fallback;
  }
}

class DiffPrefs {
  #loaded = load();
  collapseUnchanged = $state(this.#loaded.collapseUnchanged);
  threePanes = $state(this.#loaded.threePanes);
  stagingThreePanes = $state(this.#loaded.stagingThreePanes);

  toggleCollapse(): void {
    this.collapseUnchanged = !this.collapseUnchanged;
    this.#save();
  }

  setThreePanes(on: boolean): void {
    this.threePanes = on;
    this.#save();
  }

  setStagingThreePanes(on: boolean): void {
    this.stagingThreePanes = on;
    this.#save();
  }

  #save(): void {
    try {
      const data: DiffPrefsData = {
        collapseUnchanged: this.collapseUnchanged,
        threePanes: this.threePanes,
        stagingThreePanes: this.stagingThreePanes,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable: keep the in-memory values only.
    }
  }
}

export const diffPrefs = new DiffPrefs();
