# Editing Code

The editor is small, but it has the everyday tools of a code editor: syntax colors, multiple cursors, line commands in a **Code** menu, folding, and a few settings for how text looks. Tabs, saving and change markers are on [Editor and Tabs](Editor-and-Tabs.md).

## The basics

The editor has line numbers, syntax colors for common languages (JavaScript, TypeScript, JSX, Rust, PHP, HTML, Vue, Svelte, Blade, CSS, SCSS, Less, JSON, Markdown, Python, YAML, SQL), bracket matching, and Tab to indent.

**Edit > Undo** (Cmd+Z) and **Redo** (Shift+Cmd+Z) work on the editor that has the focus, with its own history per tab.

To find text in the file, press Cmd+F. See [Find and Replace](Find-and-Replace.md).

## Multiple cursors

You can type in several places at once:

- **Option+Shift+click** adds a cursor where you click.
- **Cmd+D** (Select Next Occurrence) selects the word at the cursor, then adds the next place where it appears, one at a time.
- **Ctrl+Cmd+G** (Edit > Select All Occurrences) selects every place at once.

Press Esc to go back to one cursor.

## The Code menu

The **Code** menu in the menu bar acts on the editor that has the focus. Its keys work without the menu, too.

| Item | Key | What it does |
| --- | --- | --- |
| Comment with Line Comment | Cmd+/ | Comments the lines out, or back in |
| Comment with Block Comment | Option+Cmd+/ (or Ctrl+Shift+A) | Wraps the selection in a block comment |
| Duplicate Line or Selection | Shift+Cmd+D | Copies the selection right after itself, or the line below |
| Delete Line | Shift+Cmd+K | Deletes the line |
| Join Lines | Ctrl+Shift+J | Joins the line with the next one, with one space between |
| Move Line Up / Down | Option+Up / Option+Down | Moves the line, or the selected lines |
| Indent Line / Unindent Line | Cmd+] / Cmd+[ | Moves the lines one indent level right or left |
| Toggle Case | Shift+Cmd+U | Upper case, or lower case if it already is |
| Sort Lines | | Sorts the selected lines, or the whole file |
| Folding > Expand / Collapse | Option+Cmd+] / Option+Cmd+[ | Opens or folds the block at the cursor |
| Folding > Expand All / Collapse All | Ctrl+Option+] / Ctrl+Option+[ | Opens or folds every block |
| Go to Line... | Cmd+L | Jumps to a line |
| Select Next Occurrence | Cmd+D | Adds the next match to the selection |

Items that change the text are greyed out while no editor has the focus, or in a read-only pane (one you can read but not type in, such as a diff). Folding, Go to Line and Select Next Occurrence also work in read-only panes.

Duplicate takes Shift+Cmd+D because Cmd+D adds the next occurrence, as in VS Code. Option+Shift+Up and Down copy the line up or down.

### Go to Line

**Code > Go to Line...** (Cmd+L) asks for a line number. Type `42`, or `42:7` for line 42 at column 7, and press **Go**. The field starts with where the cursor is now. The older key Option+Cmd+G still opens a small line field too.

## How text looks

These settings are in [Settings](Settings.md#editor), **Editor**. They apply to editors, diffs and the merge tool alike.

### Line spacing

**Line spacing** sets the space between lines of code, as a multiple of the font size. Drag the slider from 1.00 (tight) to 2.50 (airy), in steps of 0.05. The default is 1.55. Double-click the slider to go back to it. Open editors change at once.

### Render whitespace

![Spaces and tabs drawn in the editor](../images/editor-whitespace.png)

*Render whitespace set to All: a dot for each space and an arrow for each tab.*

**Render whitespace** draws spaces as small dots and tabs as arrows, so you can see stray spaces and mixed indentation. Pick one:

- **None**: nothing is drawn.
- **Boundary**: all spaces and tabs except single spaces between words.
- **Selection** (the default): only inside the text you select.
- **Trailing**: only the spaces and tabs at the end of lines.
- **All**: every space and tab.

The change reaches open editors right away.

### The cursor

The cursor settings work like VS Code's, plus Sublime Text's extra caret height:

- **Cursor style**: **Line** (the default), **Line thin**, **Block**, **Block outline**, **Underline** or **Underline thin**. A block is see-through, so you can still read the character under it.
- **Cursor width**: how thick the Line cursor is, from 1 to 6 pixels (2 by default). It shows only while the style is Line.
- **Cursor blinking**: **Blink** (on and off), **Smooth** (fades), **Phase** (fades slowly), **Expand** (shrinks to its middle and grows back) or **Solid** (never blinks). Whatever you pick, the cursor stays visible while you type and move it.
- **Smooth caret animation**: the cursor glides to its new place instead of jumping.
- **Caret extra top** and **Caret extra bottom**: make the cursor taller than the text by up to 10 pixels above and below, so it is easier to spot. Double-click a slider to set it back to 0.

Open editors change at once.

### The current line

The line with the cursor has a soft background. While you select text, the highlight steps aside, so a selection inside one line is always easy to see.

### Word wrap

**Word wrap** breaks long lines at the edge of the editor, so you can read every line without scrolling sideways. Turn it on or off with **View > Word Wrap** or **Option+Z**, like VS Code, or with the switch in Settings. Every open file changes at once, and the line at the top of the editor stays where it is. Diffs and the merge tool never wrap, so their sides stay lined up.

### Tab size

**Tab size** sets the spaces per indent level. It applies to files you open afterwards.

## Zoom

**View > Zoom In** (Cmd+=) and **Zoom Out** (Cmd+-) make the code font one pixel bigger or smaller, everywhere at once. **Reset Zoom** (Cmd+0) goes back to the default size.

You can also turn on **Change font size with Ctrl + mouse wheel** in Settings, Editor. Then hold Control (or Command) and scroll over an editor, diff or merge pane to make the code bigger or smaller. A trackpad pinch works too. A small badge shows the new size.

## Related

- [Editor and Tabs](Editor-and-Tabs.md)
- [Find and Replace](Find-and-Replace.md)
- [Menus](Menus.md)
- [Keyboard Shortcuts](Keyboard-Shortcuts.md)
- [How editing code works (developer)](../developer/How-Editing-Code-Works.md)
