// Code completion's language sources for the native app, from the current app's grammars (src/lib/editor/
// languages.ts): the keywords, snippets and scope names each @codemirror/lang-* package gives through its language
// data. The native app asks for them at the cursor (gmComplete), keeps the results, and filters, sorts and shows
// them itself, with the document's words added. gmApplyCompletion runs an option's apply function (a snippet) and
// answers the edit it makes, with the snippet's fields.
//
// The last file's state is kept and updated by the changed span only, so the syntax tree is parsed incrementally,
// as the page's editor does while typing.

import { CompletionContext, completeFromList, type Completion, type CompletionResult } from "@codemirror/autocomplete";
import { ensureSyntaxTree, indentUnit } from "@codemirror/language";
import { EditorSelection, EditorState, Transaction, type TransactionSpec } from "@codemirror/state";
import { languageFor } from "../../src/lib/editor/languages";

/** The longest the parse up to the cursor may take, in milliseconds. */
const PARSE_BUDGET_MS = 500;

interface Cached {
  filePath: string;
  unit: string;
  text: string;
  state: EditorState;
}

let cached: Cached | null = null;
const applyIds = new WeakMap<object, number>();
const appliers = new Map<number, Completion["apply"]>();
let nextApplyId = 1;

/** The state of `text`, from the kept one when it is the same file. */
async function stateFor(filePath: string, text: string, unit: string, tabSize: number): Promise<EditorState> {
  if (cached && cached.filePath === filePath && cached.unit === unit) {
    if (cached.text !== text) {
      const old = cached.text;
      let start = 0;
      const shortest = Math.min(old.length, text.length);
      while (start < shortest && old.charCodeAt(start) === text.charCodeAt(start)) {
        start++;
      }
      let endOld = old.length;
      let endNew = text.length;
      while (endOld > start && endNew > start && old.charCodeAt(endOld - 1) === text.charCodeAt(endNew - 1)) {
        endOld--;
        endNew--;
      }
      const insert = text.slice(start, endNew);
      cached.state = cached.state.update({ changes: { from: start, to: endOld, insert } }).state;
      cached.text = text;
    }
    return cached.state;
  }
  const language = await languageFor(filePath);
  const extensions = [language, indentUnit.of(unit), EditorState.tabSize.of(tabSize)];
  const state = EditorState.create({ doc: text, extensions });
  cached = { filePath, unit, text, state };
  return state;
}

/** The state with its syntax tree parsed up to `pos` (an empty update stores the parsed tree in the state). */
function parsedUpTo(state: EditorState, pos: number): EditorState {
  ensureSyntaxTree(state, pos, PARSE_BUDGET_MS);
  const parsed = state.update({}).state;
  if (cached) {
    cached.state = parsed;
  }
  return parsed;
}

function applyField(apply: Completion["apply"]): unknown {
  if (typeof apply === "string") {
    return { text: apply };
  }
  if (typeof apply === "function") {
    let id = applyIds.get(apply);
    if (id === undefined) {
      id = nextApplyId++;
      applyIds.set(apply, id);
      appliers.set(id, apply);
    }
    return { handle: id };
  }
  return null;
}

function serialize(result: CompletionResult): unknown {
  const pattern = result.validFor;
  const validFor = pattern instanceof RegExp ? { source: pattern.source, flags: pattern.flags } : null;
  return {
    from: result.from,
    to: result.to ?? null,
    filter: result.filter !== false,
    validFor,
    options: result.options.map((option) => ({
      label: option.label,
      displayLabel: option.displayLabel ?? null,
      detail: option.detail ?? null,
      type: option.type ?? null,
      boost: option.boost ?? null,
      sortText: option.sortText ?? null,
      info: Boolean(option.info),
      apply: applyField(option.apply),
    })),
  };
}

/**
 * The language's completion results at `pos`, one entry per source in the page's order (null when a source has
 * nothing to say), as JSON.
 */
async function gmComplete(
  filePath: string,
  text: string,
  pos: number,
  explicit: boolean,
  unit: string,
  tabSize: number,
) {
  const state = parsedUpTo(await stateFor(filePath, text, unit, tabSize), pos);
  const sources = state.languageDataAt<unknown>("autocomplete", pos);
  const results: unknown[] = [];
  for (const source of sources) {
    const run = typeof source === "function" ? source : completeFromList(source as readonly (string | Completion)[]);
    const result = await run(new CompletionContext(state, pos, explicit));
    results.push(result ? serialize(result) : null);
  }
  return JSON.stringify(results);
}

interface AppliedEdit {
  changes: [number, number, string][];
  selection: [number, number][] | null;
  main: number;
  fields: { field: number; from: number; to: number }[] | null;
  active: number;
}

/** What an apply function's transaction does: its changes, its selection and the fields of a snippet it starts. */
function editOf(tr: Transaction): AppliedEdit {
  const changes: [number, number, string][] = [];
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    changes.push([fromA, toA, inserted.toString()]);
  });
  let fields: AppliedEdit["fields"] = null;
  let active = 0;
  for (const effect of tr.effects) {
    const value = effect.value as { ranges?: { field: number; from: number; to: number }[]; active?: number } | null;
    if (value && Array.isArray(value.ranges) && typeof value.active === "number") {
      fields = value.ranges.map((range) => ({ field: range.field, from: range.from, to: range.to }));
      active = value.active;
    }
  }
  const selection = tr.selection
    ? tr.selection.ranges.map((range): [number, number] => [range.anchor, range.head])
    : null;
  return { changes, selection, main: tr.selection?.mainIndex ?? 0, fields, active };
}

/**
 * Runs the apply function kept under `handle` for the option `label` over `from`..`to`, with the editor's
 * selection, and answers its edits as JSON (null when the handle is unknown).
 */
async function gmApplyCompletion(
  filePath: string,
  text: string,
  unit: string,
  tabSize: number,
  handle: number,
  label: string,
  from: number,
  to: number,
  ranges: [number, number][],
  mainIndex: number,
) {
  const apply = appliers.get(handle);
  if (typeof apply !== "function") {
    return "null";
  }
  const selection = EditorSelection.create(
    ranges.map(([anchor, head]) => EditorSelection.range(anchor, head)),
    mainIndex,
  );
  let state = (await stateFor(filePath, text, unit, tabSize)).update({ selection }).state;
  const edits: AppliedEdit[] = [];
  const view = {
    get state() {
      return state;
    },
    dispatch(...specs: (Transaction | TransactionSpec)[]) {
      const tr = specs[0] instanceof Transaction ? specs[0] : state.update(...(specs as TransactionSpec[]));
      edits.push(editOf(tr));
      state = tr.state;
    },
  };
  (apply as (view: unknown, completion: Completion, from: number, to: number) => void)(view, { label }, from, to);
  return JSON.stringify(edits);
}

(globalThis as Record<string, unknown>).gmComplete = gmComplete;
(globalThis as Record<string, unknown>).gmApplyCompletion = gmApplyCompletion;
