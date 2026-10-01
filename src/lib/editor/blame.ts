// Git blame in CodeMirror, like VS Code with GitLens: an inline note at the
// end of the cursor line ("Author, 3 months ago - summary") and an optional
// gutter column with the commit, author and age of every block of lines.

import { Compartment, type EditorState, type Extension, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  gutter,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { api, errorMessage } from "$lib/api";
import { fullDate, relativeTime } from "$lib/log/format";
import type { NavLocation } from "$lib/stores/navHistory";
import type { BlameCommit, Eol } from "$lib/types";
import { navigation } from "$lib/stores/navigation.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { toast } from "$lib/ui/toast.svelte";
import {
  ageRanks,
  allUncommitted,
  type BlameState,
  commitAt,
  commitLineTarget,
  fromInfo,
  isUncommitted,
  mapBlame,
} from "./blameModel";

export const setBlame = StateEffect.define<BlameState | null>();

export const blameField = StateField.define<BlameState | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setBlame)) {
        return effect.value;
      }
    }
    if (value && tr.docChanged) {
      return mapBlame(value, tr.changes, tr.startState.doc, tr.state.doc);
    }
    return value;
  },
});

function describe(commit: BlameCommit | null): { label: string; title: string } {
  if (!commit || commit.uncommitted) {
    return { label: "You, Uncommitted changes", title: "Not committed yet. Click to show your changes." };
  }
  const summary = commit.summary || "(no message)";
  return {
    label: `${commit.authorName}, ${relativeTime(commit.authorTime)} • ${summary}`,
    title: `${summary}\n\n${commit.authorName} <${commit.authorEmail}>\n${fullDate(commit.authorTime)}\ncommit ${commit.id}\n\nClick to show this commit in the Log, Option-click to copy its hash`,
  };
}

async function copyHash(commit: BlameCommit | null): Promise<void> {
  if (!commit || commit.uncommitted) {
    return;
  }
  try {
    await navigator.clipboard.writeText(commit.id);
    toast.success(`Copied ${commit.shortId}`);
  } catch (error) {
    toast.error("Could not copy", errorMessage(error));
  }
}

/**
 * Click on a blame note or gutter block: open the commit in the Log on the
 * same line of its version of the file (Option-click copies the hash). The
 * clicked line is recorded first so the Back button returns to it.
 */
function openBlame(
  view: EditorView,
  blame: BlameState | null,
  commit: BlameCommit | null,
  event: MouseEvent,
  line: number,
): void {
  if (!commit || commit.uncommitted) {
    settings.setLeftPanel("changes");
    return;
  }
  if (event.altKey || !blame?.repoRoot) {
    void copyHash(commit);
    return;
  }
  const from = blame.origin?.(line) ?? null;
  const doc = view.state.doc;
  const lineText = line < doc.lines ? doc.line(line + 1).text : "";
  void navigation.openCommit(
    {
      repoRoot: blame.repoRoot,
      commitId: commit.id,
      filePath: blame.filePath ?? null,
      ...commitLineTarget(blame, line, lineText),
    },
    from,
  );
}

class InlineBlameWidget extends WidgetType {
  constructor(
    readonly commit: BlameCommit | null,
    readonly label: string,
    readonly title: string,
    readonly blame: BlameState | null,
    readonly line: number,
  ) {
    super();
  }

  eq(other: InlineBlameWidget): boolean {
    return (
      other.label === this.label &&
      other.title === this.title &&
      other.line === this.line &&
      other.blame?.repoRoot === this.blame?.repoRoot &&
      other.blame?.origin === this.blame?.origin
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement("span");
    element.className = "cm-inline-blame";
    element.textContent = this.label;
    element.title = this.title;
    element.addEventListener("mousedown", (event) => event.preventDefault());
    element.addEventListener("click", (event) => openBlame(view, this.blame, this.commit, event, this.line));
    return element;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function inlineDecorations(view: EditorView): DecorationSet {
  const state = view.state.field(blameField, false);
  if (!state) {
    return Decoration.none;
  }
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const index = line.number - 1;
  const commit = isUncommitted(state, index) ? null : commitAt(state, index);
  const { label, title } = describe(commit);
  return Decoration.set([
    Decoration.widget({ widget: new InlineBlameWidget(commit, label, title, state, index), side: 1 }).range(line.to),
  ]);
}

const inlineBlame = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = inlineDecorations(view);
    }

    update(update: ViewUpdate): void {
      const blameChanged = update.startState.field(blameField, false) !== update.state.field(blameField, false);
      if (update.docChanged || update.selectionSet || blameChanged) {
        this.decorations = inlineDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

class BlameGutterMarker extends GutterMarker {
  constructor(
    readonly text: string,
    readonly heat: number,
    readonly first: boolean,
    readonly uncommitted: boolean,
    readonly tooltip: string,
  ) {
    super();
  }

  eq(other: BlameGutterMarker): boolean {
    return (
      other.text === this.text &&
      other.heat === this.heat &&
      other.first === this.first &&
      other.uncommitted === this.uncommitted &&
      other.tooltip === this.tooltip
    );
  }

  toDOM(): Node {
    const cell = document.createElement("div");
    cell.className = `cm-blame-cell${this.first ? " first" : ""}${this.uncommitted ? " uncommitted" : ""}`;
    cell.style.setProperty("--blame-heat", `${Math.round(20 + this.heat * 75)}%`);
    cell.textContent = this.first ? this.text : "";
    if (this.first) {
      cell.title = this.tooltip;
    }
    return cell;
  }
}

function gutterText(commit: BlameCommit | null): string {
  if (!commit || commit.uncommitted) {
    return "Uncommitted";
  }
  return `${commit.shortId.slice(0, 7)}  ${commit.authorName}  ${relativeTime(commit.authorTime)}`;
}

// Per-state caches so scrolling does not rebuild markers.
const rankCache = new WeakMap<BlameState, number[]>();

function markerFor(state: EditorState, lineIndex: number): BlameGutterMarker | null {
  const blame = state.field(blameField, false);
  if (!blame) {
    return null;
  }
  let ranks = rankCache.get(blame);
  if (!ranks) {
    ranks = ageRanks(blame.commits);
    rankCache.set(blame, ranks);
  }
  const owner = blame.lines[lineIndex] ?? -1;
  const first = lineIndex === 0 || blame.lines[lineIndex - 1] !== owner;
  const uncommitted = isUncommitted(blame, lineIndex);
  const commit = uncommitted ? null : commitAt(blame, lineIndex);
  const heat = owner >= 0 ? (ranks[owner] ?? 1) : 1;
  return new BlameGutterMarker(gutterText(commit), heat, first, uncommitted, describe(commit).title);
}

const blameGutter = gutter({
  class: "cm-blame-gutter",
  lineMarker: (view, line) => markerFor(view.state, view.state.doc.lineAt(line.from).number - 1),
  lineMarkerChange: (update) =>
    update.docChanged || update.startState.field(blameField, false) !== update.state.field(blameField, false),
  initialSpacer: () => new BlameGutterMarker("0000000  Someone Name  12 months ago", 1, true, false, ""),
  domEventHandlers: {
    click: (view, line, event) => {
      const blame = view.state.field(blameField, false);
      if (!blame) {
        return false;
      }
      const index = view.state.doc.lineAt(line.from).number - 1;
      openBlame(view, blame, isUncommitted(blame, index) ? null : commitAt(blame, index), event as MouseEvent, index);
      return true;
    },
  },
});

const blameTheme = EditorView.theme({
  ".cm-inline-blame": {
    marginLeft: "3em",
    color: "var(--text-faint)",
    fontFamily: "var(--font-ui)",
    fontSize: "0.9em",
    fontStyle: "italic",
    whiteSpace: "pre",
    cursor: "pointer",
  },
  ".cm-inline-blame:hover": {
    color: "var(--text-dim)",
  },
  ".cm-blame-gutter": {
    width: "236px",
    borderRight: "1px solid var(--border)",
  },
  ".cm-blame-gutter .cm-gutterElement": {
    padding: "0",
  },
  ".cm-blame-cell": {
    height: "100%",
    padding: "0 8px 0 7px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-ui)",
    fontSize: "0.88em",
    color: "var(--text-dim)",
    borderLeft: "3px solid color-mix(in srgb, var(--accent) var(--blame-heat), transparent)",
    cursor: "pointer",
  },
  ".cm-blame-cell.first": {
    borderTop: "1px solid var(--border)",
  },
  ".cm-blame-cell.uncommitted": {
    borderLeftColor: "var(--warning)",
    fontStyle: "italic",
  },
});

const inlineCompartment = new Compartment();
const gutterCompartment = new Compartment();

export interface BlameDisplay {
  inline: boolean;
  gutter: boolean;
}

/** Blame support for an editor; nothing shows until `loadBlame` delivers data. */
export function blameExtension(display: BlameDisplay): Extension {
  return [
    blameField,
    blameTheme,
    inlineCompartment.of(display.inline ? inlineBlame : []),
    gutterCompartment.of(display.gutter ? blameGutter : []),
  ];
}

/** Switches the inline note and the gutter on or off without rebuilding the editor. */
export function setBlameDisplay(view: EditorView, display: BlameDisplay): void {
  view.dispatch({
    effects: [
      inlineCompartment.reconfigure(display.inline ? inlineBlame : []),
      gutterCompartment.reconfigure(display.gutter ? blameGutter : []),
    ],
  });
}

export interface BlameTarget {
  repoRoot: string;
  /** Repo-relative path. */
  filePath: string;
  /** Commit to blame at; null blames the given text against the work tree history. */
  revision: string | null;
  /** Builds the Back / Forward step for a clicked line, so Back returns to this view. */
  origin?: (line: number) => NavLocation;
}

/**
 * Fetches blame for the editor's current text. Results for text that changed
 * while the request ran are dropped; the caller asks again later.
 */
export async function loadBlame(view: EditorView, target: BlameTarget, eol: Eol): Promise<void> {
  const doc = view.state.doc;
  let contents: string | null = null;
  if (target.revision === null) {
    const text = doc.toString();
    contents = eol === "crlf" ? text.replace(/\n/g, "\r\n") : text;
  }
  let blame: BlameState;
  try {
    const info = await api.blameFile(target.repoRoot, target.filePath, target.revision, contents);
    blame = fromInfo(info, doc.lines);
  } catch {
    // Typically a file git does not track yet: all of it is uncommitted work.
    blame = allUncommitted(doc.lines);
  }
  blame = { ...blame, repoRoot: target.repoRoot, filePath: target.filePath, origin: target.origin };
  if (view.state.doc !== doc) {
    return;
  }
  view.dispatch({ effects: setBlame.of(blame) });
}
