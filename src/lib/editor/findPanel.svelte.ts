// The editor find and replace bar, replacing CodeMirror's default search
// panel in every editor (setup.ts). The bar is FindBar.svelte mounted as a CodeMirror panel;
// matching, highlighting, Next / Previous and Replace come from @codemirror/search.
// Read-only editors get the find row only.

import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  gotoLine,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  type SearchQuery,
  searchPanelOpen,
  selectMatches,
  selectNextOccurrence,
  selectSelectionMatches,
  setSearchQuery,
} from "@codemirror/search";
import { EditorSelection, type Extension, StateEffect, StateField, Transaction } from "@codemirror/state";
import { type Command, EditorView, type KeyBinding, keymap, type Panel, runScopeHandlers, type ViewUpdate } from "@codemirror/view";
import { mount, tick, unmount } from "svelte";
import { toast } from "$lib/ui/toast.svelte";
import FindBar from "./FindBar.svelte";
import {
  buildQuery,
  COUNT_CAP,
  countMatches,
  counterView,
  type CounterView,
  DEFAULT_FIND_OPTIONS,
  type FindOptions,
  firstMatchFrom,
  isExcluded,
  type MatchTest,
  occurrenceRanges,
  optionsOf,
  regexError,
  SELECT_CAP,
  selectionQuery,
  type Span,
} from "./findModel";

export type FindField = "find" | "replace";

/** What the bar shows; written by the panel, read by FindBar.svelte. */
export class FindBarState {
  search = $state("");
  replace = $state("");
  options = $state<FindOptions>({ ...DEFAULT_FIND_OPTIONS });
  replaceOpen = $state(false);
  readOnly = $state(false);
  counter = $state<CounterView>({ text: "", problem: false });
  /** Shown in place of the counter until the next change (after Replace All). */
  notice = $state<string | null>(null);
  error = $state<string | null>(null);
}

export interface FindBarActions {
  setSearch(text: string): void;
  setReplace(text: string): void;
  toggle(option: keyof FindOptions): void;
  toggleReplace(): void;
  next(): void;
  previous(): void;
  selectAll(): void;
  replaceOne(): void;
  replaceAll(): void;
  exclude(): void;
  close(): void;
  keydown(event: KeyboardEvent, field: FindField): void;
}

export interface FindBarHandle {
  focus(field: FindField, select: boolean): void;
}

// Exclude ------------------------------------------------------------------

const addExcluded = StateEffect.define<Span>();
const clearExcluded = StateEffect.define<null>();

/** Matches skipped with Exclude, kept in place through edits until the query changes. */
const excludedField = StateField.define<readonly Span[]>({
  create: () => [],
  update(value, transaction) {
    let next = value;
    if (transaction.docChanged && next.length > 0) {
      next = next
        .map((span) => ({ from: transaction.changes.mapPos(span.from, 1), to: transaction.changes.mapPos(span.to, -1) }))
        .filter((span) => span.to > span.from);
    }
    for (const effect of transaction.effects) {
      if (effect.is(addExcluded)) {
        next = [...next, effect.value];
      } else if (effect.is(clearExcluded)) {
        next = [];
      }
    }
    return next;
  },
});

/** One function for every query, since queries compare their test by identity. */
const notExcluded: MatchTest = (_match, state, from, to) => !isExcluded(state.field(excludedField, false) ?? [], from, to);

function hasExclusions(view: EditorView): boolean {
  return (view.state.field(excludedField, false) ?? []).length > 0;
}

// Panel --------------------------------------------------------------------

/** The user event of the jump while typing, which keeps the typing anchor in place. */
const TYPING_EVENT = "select.search.typing";
/** Larger documents count matches after a pause instead of on every keystroke. */
const SYNC_COUNT_CHARS = 200_000;
const COUNT_DELAY_MS = 120;

const panels = new WeakMap<EditorView, FindPanel>();
/** Whether the panel about to open shows the Replace row. */
const pendingReplace = new WeakMap<EditorView, boolean>();

class FindPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;
  private readonly view: EditorView;
  private readonly bar = new FindBarState();
  private readonly handle: FindBarHandle;
  private query: SearchQuery;
  /** Typing jumps to the first match from here: where the caret was before the search moved it. */
  private anchor: number;
  private countTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(view: EditorView) {
    this.view = view;
    this.dom = document.createElement("div");
    this.dom.className = "cm-find-bar";
    this.query = getSearchQuery(view.state);
    this.anchor = view.state.selection.main.from;
    this.syncFields(this.query);
    this.bar.readOnly = view.state.readOnly;
    this.bar.replaceOpen = !this.bar.readOnly && (pendingReplace.get(view) ?? false);
    pendingReplace.delete(view);
    this.handle = mount(FindBar, { target: this.dom, props: { bar: this.bar, actions: this.actions() } });
    panels.set(view, this);
  }

  mount(): void {
    this.focus("find", true);
    this.count();
  }

  update(update: ViewUpdate): void {
    const query = getSearchQuery(update.state);
    const queryChanged = !query.eq(this.query);
    if (queryChanged) {
      this.query = query;
      this.syncFields(query);
    }
    if (update.state.readOnly !== this.bar.readOnly) {
      this.bar.readOnly = update.state.readOnly;
      this.bar.replaceOpen = this.bar.replaceOpen && !this.bar.readOnly;
    }
    const typed = update.transactions.some((transaction) => transaction.annotation(Transaction.userEvent) === TYPING_EVENT);
    if (update.selectionSet && !typed) {
      this.anchor = update.state.selection.main.from;
    }
    const excludedChanged = update.state.field(excludedField, false) !== update.startState.field(excludedField, false);
    if (queryChanged || update.docChanged || update.selectionSet || excludedChanged) {
      this.scheduleCount();
    }
  }

  destroy(): void {
    clearTimeout(this.countTimer);
    void unmount(this.handle);
    if (panels.get(this.view) === this) {
      panels.delete(this.view);
    }
  }

  focus(field: FindField, select: boolean): void {
    this.handle.focus(field === "replace" && this.bar.replaceOpen ? "replace" : "find", select);
  }

  /** Shows or hides the Replace row (never in a read-only editor). */
  setReplaceOpen(open: boolean): void {
    this.bar.replaceOpen = open && !this.bar.readOnly;
  }

  hasFocus(): boolean {
    return this.dom.contains(document.activeElement);
  }

  private syncFields(query: SearchQuery): void {
    this.bar.search = query.search;
    this.bar.replace = query.replace;
    this.bar.options = optionsOf(query);
    this.bar.error = regexError(query.search, query.regexp);
  }

  private scheduleCount(): void {
    clearTimeout(this.countTimer);
    if (this.view.state.doc.length <= SYNC_COUNT_CHARS) {
      this.count();
      return;
    }
    this.countTimer = setTimeout(() => this.count(), COUNT_DELAY_MS);
  }

  private count(): void {
    this.bar.notice = null;
    this.bar.counter = counterView(this.bar.search, countMatches(this.view.state, this.query, COUNT_CAP), this.bar.error);
  }

  /** Puts the fields and toggles into the editor's query; typing also jumps to the first match. */
  private apply(jump: boolean): void {
    const { search: text, replace, options } = this.bar;
    const query = buildQuery(text, replace, options, notExcluded);
    this.bar.error = regexError(text, options.regex);
    const previous = this.query;
    const searchChanged =
      previous.search !== text ||
      previous.caseSensitive !== options.matchCase ||
      previous.wholeWord !== options.wholeWords ||
      previous.regexp !== options.regex;
    const effects: StateEffect<unknown>[] = [setSearchQuery.of(query)];
    if (searchChanged && hasExclusions(this.view)) {
      effects.push(clearExcluded.of(null));
    }
    let selection: EditorSelection | undefined;
    if (jump && searchChanged && query.valid) {
      // Exclusions are cleared by this change, so the jump ignores them.
      const match = firstMatchFrom(this.view.state, buildQuery(text, replace, options), this.anchor);
      if (match) {
        selection = EditorSelection.single(match.from, match.to);
        effects.push(EditorView.scrollIntoView(EditorSelection.range(match.from, match.to), { yMargin: 48 }));
      }
    }
    this.view.dispatch({ effects, selection, userEvent: selection ? TYPING_EVENT : undefined });
  }

  /** Selects every match (Select All Occurrences) and hands the carets to the editor. */
  selectAllMatches(): void {
    if (!this.query.valid) {
      return;
    }
    if (selectMatches(this.view)) {
      this.view.focus();
      return;
    }
    if (countMatches(this.view.state, this.query, SELECT_CAP).capped) {
      toast.info("Too many matches to select", `Select All Occurrences works up to ${SELECT_CAP.toLocaleString()} matches.`);
    }
  }

  private replaceAllMatches(): void {
    if (this.bar.readOnly || !this.query.valid) {
      return;
    }
    const total = countMatches(this.view.state, this.query, Number.MAX_SAFE_INTEGER).total;
    if (replaceAll(this.view)) {
      this.bar.notice = `${total.toLocaleString()} replaced`;
    }
  }

  /** Skips the selected match for this search (Replace All leaves it too) and goes to the next. */
  private exclude(): void {
    const { from, to } = this.view.state.selection.main;
    if (this.query.valid && from < to) {
      const found = this.query.getCursor(this.view.state, from, to).next();
      if (!found.done && found.value.from === from && found.value.to === to) {
        this.view.dispatch({ effects: addExcluded.of({ from, to }) });
      }
    }
    findNext(this.view);
  }

  private close(): void {
    closeFind(this.view);
  }

  private keydown(event: KeyboardEvent, field: FindField): void {
    if (event.isComposing) {
      return;
    }
    const mod = event.metaKey || event.ctrlKey;
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }
    // Option+C / W / X toggle Match Case, Words and Regex (by the physical key: Option types other characters).
    if (event.altKey && !mod && !event.shiftKey) {
      const option = event.code === "KeyC" ? "matchCase" : event.code === "KeyW" ? "wholeWords" : event.code === "KeyX" ? "regex" : null;
      if (option) {
        event.preventDefault();
        this.toggle(option);
        return;
      }
    }
    if (event.key === "Enter") {
      if (field === "find" && event.altKey && !mod) {
        event.preventDefault();
        this.selectAllMatches();
        return;
      }
      if (field === "replace" && mod && event.shiftKey) {
        event.preventDefault();
        this.replaceAllMatches();
        return;
      }
      if (!mod && !event.altKey) {
        event.preventDefault();
        if (event.shiftKey) {
          findPrevious(this.view);
        } else if (field === "replace") {
          replaceNext(this.view);
        } else {
          findNext(this.view);
        }
        return;
      }
    }
    if (event.key === "Tab" && !mod && !event.altKey && this.bar.replaceOpen) {
      event.preventDefault();
      this.handle.focus(field === "find" ? "replace" : "find", true);
      return;
    }
    // Cmd+G, Cmd+F, Cmd+R, Ctrl+Cmd+G and the merge tool's Cmd+Enter work from the fields too.
    if (runScopeHandlers(this.view, event, "search-panel")) {
      event.preventDefault();
    }
  }

  private toggle(option: keyof FindOptions): void {
    this.bar.options = { ...this.bar.options, [option]: !this.bar.options[option] };
    this.apply(true);
  }

  private actions(): FindBarActions {
    return {
      setSearch: (text) => {
        this.bar.search = text;
        this.apply(true);
      },
      setReplace: (text) => {
        this.bar.replace = text;
        this.apply(false);
      },
      toggle: (option) => this.toggle(option),
      toggleReplace: () => {
        this.setReplaceOpen(!this.bar.replaceOpen);
        this.focus(this.bar.replaceOpen ? "replace" : "find", false);
      },
      next: () => {
        findNext(this.view);
      },
      previous: () => {
        findPrevious(this.view);
      },
      selectAll: () => this.selectAllMatches(),
      replaceOne: () => {
        replaceNext(this.view);
      },
      replaceAll: () => this.replaceAllMatches(),
      exclude: () => this.exclude(),
      close: () => this.close(),
      keydown: (event, field) => this.keydown(event, field),
    };
  }
}

// Commands -----------------------------------------------------------------

/**
 * Cmd+F (find) and Cmd+R (find and replace): opens the bar, or switches it, seeded with a short
 * one-line selection, and focuses the find field with its text selected.
 */
export function openFind(view: EditorView, replace: boolean): boolean {
  const state = view.state;
  const previous = getSearchQuery(state);
  const main = state.selection.main;
  const seeded = selectionQuery(state.sliceDoc(main.from, main.to), previous.regexp);
  const existing = panels.get(view);
  // Cmd+F inside the bar only selects the field text.
  const fromBar = existing?.hasFocus() ?? false;
  if (existing) {
    existing.setReplaceOpen(replace);
  } else {
    pendingReplace.set(view, replace);
    openSearchPanel(view);
  }
  const search = seeded !== null && !fromBar ? seeded : previous.search;
  const query = buildQuery(search, previous.replace, optionsOf(previous), notExcluded);
  if (!query.eq(getSearchQuery(view.state))) {
    const effects: StateEffect<unknown>[] = [setSearchQuery.of(query)];
    if (search !== previous.search && hasExclusions(view)) {
      effects.push(clearExcluded.of(null));
    }
    view.dispatch({ effects });
  }
  panels.get(view)?.focus("find", true);
  return true;
}

/** Esc: closes the bar, forgets the exclusions and gives the editor its focus back. */
export function closeFind(view: EditorView): boolean {
  if (!searchPanelOpen(view.state)) {
    return false;
  }
  closeSearchPanel(view);
  if (hasExclusions(view)) {
    view.dispatch({ effects: clearExcluded.of(null) });
  }
  view.focus();
  return true;
}

/**
 * Select All Occurrences (Ctrl+Cmd+G): every match of the open bar's query, otherwise every
 * occurrence of the selection or of the word at the caret.
 */
export function selectAllOccurrences(view: EditorView): boolean {
  const panel = panels.get(view);
  if (panel && searchPanelOpen(view.state) && getSearchQuery(view.state).valid) {
    panel.selectAllMatches();
    return true;
  }
  const found = occurrenceRanges(view.state);
  if (!found) {
    return false;
  }
  if (found.tooMany) {
    toast.info("Too many occurrences to select", `Select All Occurrences works up to ${SELECT_CAP.toLocaleString()} matches.`);
    return true;
  }
  view.dispatch({
    selection: EditorSelection.create(
      found.ranges.map((range) => EditorSelection.range(range.from, range.to)),
      found.main,
    ),
    userEvent: "select.search.matches",
  });
  return true;
}

/** Cmd+F. */
export const findCommand: Command = (view) => openFind(view, false);

/** Cmd+R: find and replace, or just find in a read-only editor. */
export const replaceCommand: Command = (view) => openFind(view, !view.state.readOnly);

const scope = "editor search-panel";

/** Replaces @codemirror/search's searchKeymap: same keys, plus Cmd+R and Ctrl+Cmd+G. */
export const findKeymap: readonly KeyBinding[] = [
  { key: "Mod-f", run: findCommand, scope, preventDefault: true },
  { key: "Mod-r", run: replaceCommand, scope, preventDefault: true },
  { key: "F3", run: findNext, shift: findPrevious, scope, preventDefault: true },
  { key: "Mod-g", run: findNext, shift: findPrevious, scope, preventDefault: true },
  { key: "Escape", run: closeFind, scope },
  // Ctrl+Cmd+G on macOS, Ctrl+Alt+Shift+J elsewhere.
  { mac: "Ctrl-Meta-g", key: "Ctrl-Alt-Shift-j", run: selectAllOccurrences, scope, preventDefault: true },
  { key: "Mod-Shift-l", run: selectSelectionMatches },
  { key: "Mod-Alt-g", run: gotoLine },
  { key: "Mod-d", run: selectNextOccurrence, preventDefault: true },
];

/** The find bar, its keys and the Exclude state for one editor. */
export function findBar(): Extension {
  return [
    search({ top: true, literal: true, createPanel: (view) => new FindPanel(view) }),
    excludedField,
    keymap.of(findKeymap),
  ];
}

/** Waits for Svelte to render, then focuses a field (the Replace row may have just appeared). */
export function focusLater(input: () => HTMLInputElement | null, select: boolean): void {
  void tick().then(() => {
    const element = input();
    if (element) {
      element.focus();
      if (select) {
        element.select();
      }
    }
  });
}
