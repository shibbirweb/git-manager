// The editors' cursor, like VS Code's cursor settings plus Sublime Text's extra caret height:
// its shape, width, blinking, smooth movement and how far it reaches above and below the text.
// Open editors follow the settings through a compartment, like the whitespace setting.

import { Compartment, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import type { EditorCursorBlinking, EditorCursorStyle, Preferences } from "$lib/stores/settingsData";

export interface CursorOptions {
  style: EditorCursorStyle;
  /** Width of the Line cursor in pixels. */
  width: number;
  blinking: EditorCursorBlinking;
  smoothCaret: boolean;
  extraTop: number;
  extraBottom: number;
}

/** The settings that shape the cursor. */
export type CursorPreferences = Pick<
  Preferences,
  | "editorCursorStyle"
  | "editorCursorWidth"
  | "editorCursorBlinking"
  | "editorCursorSmoothCaret"
  | "editorCaretExtraTop"
  | "editorCaretExtraBottom"
>;

/** The cursor options in the settings. */
export function cursorOptions(preferences: CursorPreferences): CursorOptions {
  return {
    style: preferences.editorCursorStyle,
    width: preferences.editorCursorWidth,
    blinking: preferences.editorCursorBlinking,
    smoothCaret: preferences.editorCursorSmoothCaret,
    extraTop: preferences.editorCaretExtraTop,
    extraBottom: preferences.editorCaretExtraBottom,
  };
}

type Declarations = Record<string, string>;
/** Selectors to declarations; a keyframes rule maps its steps to declarations. */
type StyleSpec = Record<string, Declarations | Record<string, Declarations>>;

/** One blink cycle, CodeMirror's default rate. */
export const BLINK_MS = 1200;

/** The cursor elements CodeMirror draws (not the drop cursor of drag and drop). */
const CURSOR = ".cm-cursorLayer .cm-cursor";
/** Set by `charWidth` from the editor's measured character width. */
const CHAR_WIDTH = "var(--gm-char-width, 0.6em)";
const COLOR = "var(--editor-cursor)";

function shapeOf(style: EditorCursorStyle, width: number): Declarations {
  switch (style) {
    case "line":
    case "line-thin": {
      const pixels = style === "line-thin" ? 1 : width;
      return { borderLeft: `${pixels}px solid ${COLOR}`, marginLeft: `${-pixels / 2}px` };
    }
    case "block":
      // See-through so the character under it stays readable in every theme.
      return {
        borderLeft: "none",
        marginLeft: "0",
        width: CHAR_WIDTH,
        backgroundColor: `color-mix(in srgb, ${COLOR} 55%, transparent)`,
      };
    case "block-outline":
      return { borderLeft: "none", marginLeft: "0", width: CHAR_WIDTH, outline: `1px solid ${COLOR}`, outlineOffset: "-1px" };
    case "underline":
    case "underline-thin":
      return {
        borderLeft: "none",
        marginLeft: "0",
        width: CHAR_WIDTH,
        borderBottom: `${style === "underline-thin" ? 1 : 2}px solid ${COLOR}`,
      };
  }
}

/** Keyframes and timing of each blinking mode; the times follow VS Code. */
const BLINKS: Record<Exclude<EditorCursorBlinking, "solid">, { frames: Record<string, Declarations>; timing: string }> = {
  blink: {
    frames: { "0%": {}, "50%": { opacity: "0" }, "100%": {} },
    timing: `${BLINK_MS}ms steps(1) infinite`,
  },
  smooth: {
    frames: { "0%, 20%": { opacity: "1" }, "60%, 100%": { opacity: "0" } },
    timing: `${BLINK_MS / 2}ms ease-in-out infinite alternate`,
  },
  phase: {
    frames: { "0%, 20%": { opacity: "1" }, "90%, 100%": { opacity: "0" } },
    timing: `${BLINK_MS / 2}ms ease-in-out infinite alternate`,
  },
  expand: {
    frames: { "0%, 20%": { transform: "scaleY(1)" }, "80%, 100%": { transform: "scaleY(0)" } },
    timing: `${BLINK_MS / 2}ms ease-in-out infinite alternate`,
  },
};

/** The EditorView.theme spec for these options. */
export function cursorThemeSpec(options: CursorOptions): StyleSpec {
  const cursor: Declarations = { ...shapeOf(options.style, options.width) };
  if (options.extraTop > 0 || options.extraBottom > 0) {
    // Padding grows the element beyond the height CodeMirror sets; the border and fill cover it.
    Object.assign(cursor, {
      boxSizing: "content-box",
      paddingTop: `${options.extraTop}px`,
      paddingBottom: `${options.extraBottom}px`,
      marginTop: `${-options.extraTop}px`,
    });
  }
  if (options.smoothCaret) {
    cursor.transition = "left 80ms ease-out, top 80ms ease-out";
  }
  const spec: StyleSpec = {
    [CURSOR]: cursor,
    // CodeMirror blinks the whole layer; the cursors blink themselves instead.
    "&.cm-focused > .cm-scroller > .cm-cursorLayer": { animation: "none !important" },
  };
  if (options.blinking !== "solid") {
    const blink = BLINKS[options.blinking];
    // Two copies of the keyframes: switching between them restarts the blink after each move.
    for (const copy of ["a", "b"]) {
      const name = `gm-cursor-${options.blinking}-${copy}`;
      spec[`@keyframes ${name}`] = blink.frames;
      spec[`& .cm-scroller[data-gm-blink="${copy}"] ${CURSOR}`] = { animation: `${name} ${blink.timing}` };
    }
  }
  return spec;
}

/** Same options, same theme, so dragging a slider back and forth adds no new styles. */
const themes = new Map<string, Extension>();

function themeFor(options: CursorOptions): Extension {
  const key = JSON.stringify(options);
  let theme = themes.get(key);
  if (!theme) {
    theme = EditorView.theme(cursorThemeSpec(options));
    themes.set(key, theme);
  }
  return theme;
}

/**
 * Keeps the character width the block and underline cursors use up to date, and restarts the
 * blink when the cursor moves so it stays visible while you type. It writes to the scroller,
 * which CodeMirror's own attribute handling leaves alone.
 */
const cursorTracker = ViewPlugin.fromClass(
  class {
    private copy: "a" | "b" = "a";

    constructor(view: EditorView) {
      view.scrollDOM.dataset.gmBlink = this.copy;
      this.measure(view);
    }

    update(update: ViewUpdate): void {
      if (update.selectionSet || update.docChanged) {
        this.copy = this.copy === "a" ? "b" : "a";
        update.view.scrollDOM.dataset.gmBlink = this.copy;
      }
      if (update.geometryChanged) {
        this.measure(update.view);
      }
    }

    private measure(view: EditorView): void {
      view.scrollDOM.style.setProperty("--gm-char-width", `${view.defaultCharacterWidth}px`);
    }
  },
);

const compartment = new Compartment();
const views = new Set<EditorView>();

const registry = ViewPlugin.define((view) => {
  views.add(view);
  return {
    destroy() {
      views.delete(view);
    },
  };
});

/** The cursor extension for a new editor. */
export function editorCursor(options: CursorOptions): Extension {
  return [registry, cursorTracker, compartment.of(themeFor(options))];
}

/** Applies new cursor options to every open editor. */
export function setEditorCursor(options: CursorOptions): void {
  const effects = compartment.reconfigure(themeFor(options));
  for (const view of views) {
    view.dispatch({ effects });
  }
}
