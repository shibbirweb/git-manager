// Run With: the package manager picked for a package.json instead of the detected one.
// Kept for the session only, like a JetBrains run configuration that was never saved.

import { SvelteMap } from "svelte/reactivity";

class RunnerOverrides {
  private byFile = new SvelteMap<string, string>();

  get(filePath: string): string | null {
    return this.byFile.get(filePath) ?? null;
  }

  /** null goes back to the detected package manager. */
  set(filePath: string, runner: string | null): void {
    if (runner === null) {
      this.byFile.delete(filePath);
    } else {
      this.byFile.set(filePath, runner);
    }
  }
}

export const runnerOverrides = new RunnerOverrides();
