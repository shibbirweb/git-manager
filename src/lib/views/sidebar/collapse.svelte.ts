// Expanded/collapsed state for sidebar sections and folders. Saved state is
// remembered in localStorage; while filtering, everything starts expanded and
// toggles go to a temporary set that is reset whenever the filter changes.

import { SvelteMap, SvelteSet } from "svelte/reactivity";

const STORAGE_KEY = "git-manager.sidebar.collapsed";
const COLLAPSED_BY_DEFAULT = new Set(["section:tags"]);

function load(): [string, boolean][] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return [];
    }
    return Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean");
  } catch {
    return [];
  }
}

class CollapseState {
  private saved = new SvelteMap<string, boolean>(load());
  private collapsedWhileFiltering = new SvelteSet<string>();

  isExpanded(key: string, filtering: boolean): boolean {
    if (filtering) {
      return !this.collapsedWhileFiltering.has(key);
    }
    return !(this.saved.get(key) ?? COLLAPSED_BY_DEFAULT.has(key));
  }

  setExpanded(key: string, filtering: boolean, expanded: boolean): void {
    if (filtering) {
      if (expanded) {
        this.collapsedWhileFiltering.delete(key);
      } else {
        this.collapsedWhileFiltering.add(key);
      }
      return;
    }
    this.saved.set(key, !expanded);
    this.persist();
  }

  toggle(key: string, filtering: boolean): void {
    this.setExpanded(key, filtering, !this.isExpanded(key, filtering));
  }

  resetFilterState(): void {
    this.collapsedWhileFiltering.clear();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.saved)));
    } catch {
      // Storage may be unavailable; state still lives in memory.
    }
  }
}

export const collapse = new CollapseState();
