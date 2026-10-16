// Find in a terminal (Cmd+F): the query and its toggles, the match count from the search addon, and searching up
// (toward older output) or down. TerminalView shows it with TerminalFindBar.
import type { Terminal } from "@xterm/xterm";
import { tick } from "svelte";
import { settings } from "$lib/stores/settings.svelte";
import type { TerminalAddons } from "./addons";
import {
  DEFAULT_FIND_OPTIONS,
  findCounterText,
  findDecorations,
  findQueryError,
  type FindResults,
  searchOptions,
  type TerminalFindOptions,
} from "./find";

export class TerminalFind {
  open = $state(false);
  query = $state("");
  options = $state<TerminalFindOptions>({ ...DEFAULT_FIND_OPTIONS });
  results = $state.raw<FindResults | null>(null);
  readonly counter = $derived(findCounterText(this.query, this.results, findQueryError(this.query, this.options)));
  readonly problem = $derived(
    findQueryError(this.query, this.options) !== null || (this.query !== "" && this.results?.resultCount === 0),
  );

  constructor(
    private readonly addons: () => TerminalAddons | null,
    private readonly focusBar: () => void,
    private readonly focusTerminal: () => void,
  ) {}

  /** Cmd+F: opens the bar with a one-line selection as the query, loading the search addon the first time. */
  async show(instance: Terminal): Promise<void> {
    const addons = this.addons();
    if (!settings.terminalFind || !addons) {
      return;
    }
    const selection = instance.hasSelection() ? instance.getSelection() : "";
    if (selection && !selection.includes("\n") && selection.length <= 200) {
      this.query = selection;
    }
    this.open = true;
    await tick();
    this.focusBar();
    const addon = await addons.loadSearch();
    if (addon && this.open && this.query) {
      this.run("previous", true);
    }
  }

  /** Searches up ("previous", toward older output) or down; typing searches again from the current match. */
  run(direction: "previous" | "next", incremental = false): void {
    const addon = this.addons()?.searchAddon ?? null;
    if (!addon) {
      return;
    }
    if (!this.query || findQueryError(this.query, this.options)) {
      addon.clearDecorations();
      this.results = null;
      return;
    }
    const readToken = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token);
    const options = searchOptions(this.options, findDecorations(readToken), incremental);
    if (direction === "previous") {
      addon.findPrevious(this.query, options);
    } else {
      addon.findNext(this.query, options);
    }
  }

  setQuery(query: string): void {
    this.query = query;
    this.run("previous", true);
  }

  toggle(option: keyof TerminalFindOptions): void {
    this.options = { ...this.options, [option]: !this.options[option] };
    this.run("previous", true);
  }

  /** Esc or x: the highlights go and the terminal takes the keys again. */
  close(refocus = true): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.results = null;
    this.addons()?.searchAddon?.clearDecorations();
    if (refocus) {
      this.focusTerminal();
    }
  }
}
