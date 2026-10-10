# Parity scenarios (continued)

## terminal: Terminal panel (runs in both apps)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click Terminal at the bottom of the left activity bar.

Note: gm-measure writes a .zshrc into each app's throwaway HOME: a "$ " prompt, fixed text in the theme's colors and
styles, and the cursor hidden, as a blinking cursor differs by the moment of capture.

Measured: light 99.5% (270 MB / 44 MB, 2026-10-09), dark 99.38% (271 MB / 49 MB, 2026-10-09).

- Integrated terminal (`terminal`, partial): The terminal panel with its header and several terminals. Native lacks:
  one terminal: the shell menu, Split, Move into Editor Area, the terminal list and renaming do nothing; selection,
  find, file links, the scrollbar, dropping files and terminals in editor tabs; Settings, Terminal (font, cursor,
  scrollback) and the Shelf tab's view.

## scripts: Scripts panel (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click the play button in the left activity bar (View > Scripts): the scripts of package.json.

- Scripts tool window (`scripts`, missing): The scripts of package.json with run buttons and the Node version.

## update-dialog: Update available (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Run a build older than the newest release on its channel and wait about 30 seconds.
2. Click Update available in the status bar: the update window.

- Updates and release channels (`updates`, missing): Update available in the status bar and the update window.

## edit: Editing src/catalog.ts with the Code menu (runs in both apps)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront and open src/catalog.ts at line 2, column 3.
2. Code > Move Line Down, Code > Duplicate, Code > Comment with Line Comment.
3. Code > Select Next Occurrence twice: "id" is selected in two places, with the change markers in the gutter.

Measured: light 99.5% (175 MB / 44 MB, 2026-10-09), dark 99.48% (173 MB / 41 MB, 2026-10-09).

- Editing code (`code-editing`, partial): Multiple cursors, the Code menu, Go to Line, folding and completion. Native
  lacks: completion, Go to Line and the find bar; column selection and dragging text; Settings > Editor (font, cursor,
  word wrap) keep their defaults.

## memory-breakdown: Memory breakdown (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click the memory readout at the right of the status bar.

- Memory readout and memory log (`memory`, partial): The readout in the status bar and its breakdown. Native lacks:
  the breakdown popup; the memory log and the memory marks in Settings.
- Clear Cache (`clear-cache`, missing): The brush right of the readout: the window blinks and comes back as it was.
  Native lacks: the brush is drawn but does nothing (the native app has no WebKit cache to clear).
