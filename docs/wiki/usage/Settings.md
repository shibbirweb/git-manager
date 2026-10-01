# Settings

Settings let you change how Git Manager looks and behaves: theme, fonts, the editor, the merge tool and the layout. Every change applies right away and is saved for next time.

## Open Settings

- Click the gear at the top right of the header.
- Or press Cmd+,.
- Or click **Settings** on the welcome screen.

Settings opens on **Appearance** (the **Spaces** item in the status bar opens **Editor**); the other sections are on the left. Press Esc or click the x to close. You can drag the dialog by its **Settings** title or the section heading to see the app behind it, and double-click either to center it again.

**Reset to Defaults** at the bottom left puts every setting in `settings.json` back to its default, after asking (**Reset Settings**). The Layout choices and sidebar widths are kept.

## Appearance

![Appearance settings](../images/settings-appearance.png)

*Theme and interface font size.*

| Setting | What it does | Default |
| --- | --- | --- |
| Theme | **System** follows the macOS appearance, or pick **Light** or **Dark**. | System |
| Interface font size | Size of menus, lists and buttons, 11 to 16 px in half steps. | 13 px |

The sun button in the header (**Toggle light/dark theme**) switches between light and dark in one click. It sets **Light** or **Dark**, so the theme stops following macOS until you pick **System** again.

![Dark theme](../images/dark-theme.png)

*Git Manager in the dark theme.*

## Editor

![Editor settings](../images/settings-editor.png)

*The top of the Editor section: font family, font size and mouse wheel zoom.*

| Setting | What it does | Default |
| --- | --- | --- |
| Editor font family | A comma-separated list of fonts, like VS Code's `editor.fontFamily`. The first one installed is used, and `monospace` is always added last. Click a font name below the box to use it; a preview shows the result. | Menlo, Monaco, 'Courier New', monospace |
| Editor font size | Code in the editor, diffs and the merge tool, 10 to 20 px in half steps. | 12.5 px |
| Change font size with Ctrl + mouse wheel | Hold Control (or Command) and scroll over an editor, diff or merge pane to zoom. A trackpad pinch works too. A badge shows the new size, such as **Editor font size 14px**. | Off |
| Font ligatures | Draws `=>`, `!=` and `===` as single symbols. Needs a font that has them, such as Fira Code, JetBrains Mono or Cascadia Code. | Off |
| Tab size | Spaces per indent level: 2, 4 or 8. Applies to files opened afterwards. | 4 |
| Word wrap | Wraps long lines in the file editor. Diffs and the merge tool never wrap. | Off |
| Current line blame | Author, age and commit at the end of the cursor line, like GitLens in VS Code. Click it to open the commit in the Log; Option-click copies the hash. See [Blame](Blame.md). | On |
| Blame gutter | A blame column beside the line numbers. Also the **Blame** button in the editor and diff toolbars. | Off |

The Editor section scrolls. Further down are the rest of its settings:

![More editor settings](../images/settings-editor-more.png)

*The lower part of the Editor section: ligatures, tab size, word wrap and blame.*

Type a font list and press Enter, or click outside the box, to apply it. The box suggests the listed fonts as you type. Clicking a font name puts it first, in front of the default list. Once you changed the font, a **Reset** button next to the box goes back to the default.

## Merge and Log

![Merge and Log settings](../images/settings-merge.png)

*Defaults for the merge tool and the Log.*

| Setting | What it does | Default |
| --- | --- | --- |
| Ignore whitespace in the merge tool | Starts merges with whitespace-only differences hidden. The **Ignore whitespace** button in the [Merge Tool](Merge-Tool.md) changes this setting too. | Off |
| Show all branches in the log | Includes every local and remote branch in the [Log](History-and-Log.md), like `git log --all`. Same as the **All branches** button there. | On |

## Layout

![Layout settings](../images/settings-layout.png)

*Which sidebars are shown.*

| Setting | What it does | Default |
| --- | --- | --- |
| Files panel | Shows the file tree on the right (also Option+Cmd+B and the Files button on the right edge). | On |
| Left sidebar | **Changes**, **Branches** or **Hidden** (also Cmd+B and the activity bar). | Changes |

These two are saved in `state.json`, not `settings.json`, together with the sidebar widths. Drag a sidebar's edge to resize it, and double-click the edge to reset it.

## Updates and About

**Updates** controls the update check and the release channel; see [Updates](Updates.md). **About** has the version and the links to star the project, report a bug or request a feature; see [Status Bar and Help](Status-Bar-and-Help.md).

## Where settings are saved

![Settings Files section](../images/settings-files.png)

*The settings folder and the list of settings changed from their defaults.*

Like VS Code keeps its files in `~/.vscode`, Git Manager keeps its own in a folder in your home folder:

```
~/.gitmanager/
  settings.json   your preferences, safe to edit by hand
  state.json      recent folders, open workspace, active repositories, sidebar layout and widths
```

The folder is created the first time a setting is saved. The **Settings Files** section shows the **Settings folder** path, a **Copy settings.json Path** button, and **Changed from defaults**: each setting you changed, such as `tabSize: 2`, or **Nothing yet**.

### Editing settings.json by hand

The keys match the settings above: `theme`, `uiFontSize`, `editorFontSize`, `editorFontFamily`, `fontLigatures`, `tabSize`, `wordWrap`, `currentLineBlame`, `blameGutter`, `mouseWheelZoom`, `checkForUpdates`, `updateChannel`, `ignoreWhitespace` and `logAllRefs`. For example:

```json
{
  "theme": "dark",
  "editorFontFamily": "'JetBrains Mono', Menlo, monospace",
  "fontLigatures": true,
  "tabSize": 2
}
```

Git Manager checks every value when it loads. A value it does not understand falls back to the default, and sizes are kept within their ranges. Keys it does not know are kept when it saves. If saving fails, a note says **Could not save settings**.

If the file is not valid JSON (a missing comma, say), Git Manager uses the defaults, shows **settings.json could not be read** at the top of Settings, and does not overwrite your file. Fix the file, then click **Try Again**.

The same goes for `state.json`. Recent folders, the last session and panel sizes then start empty, and the file is left alone. A note at start and a banner at the top of Settings say **state.json could not be read**, and the welcome screen says why recent folders are missing (its **Open Settings** link opens **Settings Files**). Fix the file and click **Try Again**, or click **Reset** to start a fresh one. Reset asks first, because what the old file held is lost.

![The state.json banner](../images/settings-state-error.png)

*The state.json banner in Settings Files: Try Again rereads the file, Reset replaces it with a fresh one.*

## Related

- [Updates](Updates.md)
- [Status Bar and Help](Status-Bar-and-Help.md)
- [Editor and Tabs](Editor-and-Tabs.md)
- [Troubleshooting](Troubleshooting.md)
- [How settings work (developer)](../developer/How-Settings-Work.md)
