# File Icons

Git Manager can show an icon for each file's type, like PhpStorm and VS Code do. A PHP file gets the PHP logo, a Dockerfile gets the Docker whale, and a lock file gets a lock. Icons are **off by default**, because every icon set uses some memory.

[TODO:file-icons.png]

## Choose a level

Open **Settings > Appearance > File icons**, or use **View > File Icons** in the menu bar. There are three levels:

| Level | What you see | Memory |
| --- | --- | --- |
| **No icons** | One plain file icon for every file, as before. | Nothing extra is loaded. |
| **Minimal** | Simple shapes, colored by type: code, JSON, Markdown, images, archives, lock files and more. The colors follow your color theme. | A small icon set is loaded. |
| **Material Icons** | Full colored icons for over 1,000 file types, from the Material Icon Theme that many VS Code users know. | A bigger icon set is loaded. Uses the most memory. |

The level applies at once. You do not need to restart.

## Where icons show

- The **Files panel**, in place of the plain file icon. Folders keep their folder icons.
- The **Changes** list, before each file name.
- The changed files of a commit: in the **Log**, a commit tab, File History and the Reflog.

## How an icon is picked

Git Manager looks at the file name first, then at the end of the name (the extension):

- Some names have their own icon, such as `package.json`, `Dockerfile`, `README.md` and `.gitignore`.
- Otherwise the longest matching extension wins: `cart.spec.ts` gets the test icon before the TypeScript icon.
- Case does not matter: `LOGO.PNG` is an image.
- A file type the set does not know gets the plain file icon.

With **Material Icons**, a few icons have a light version that is used with a light color theme, so they stay easy to see.

## Memory

Memory matters in Git Manager, so each level loads only its own icons:

- With **No icons**, no icon set is loaded at all.
- With **Minimal**, only the Minimal set is loaded.
- With **Material Icons**, only the Material set is loaded, and the Minimal set is dropped.
- When you switch to another level, the icons of the level you left are released.

Material Icons loads its list of file types when you choose it. Each icon picture is loaded the first time a file of that type is on screen. A list with thousands of files of a few types still loads only those few pictures.

In our test with 2,400 changed files in the Changes list, Minimal used about 2 to 10 MB more than No icons, and Material Icons about 10 to 15 MB more than Minimal. With fewer files the cost is smaller. The web view gives memory back on its own schedule, so the number may not drop the moment you switch back. You can watch it in the status bar: see [Memory Use](Memory-Use.md).

## Credits

The Material Icons level uses icons from [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme), under the MIT license. The license file ships with the app.

## Related

- [Files Panel](Files-Panel.md)
- [Changes and Commits](Changes-and-Commits.md)
- [Settings](Settings.md)
- [Menus](Menus.md)
